import re, json
from pathlib import Path
import httpx, joblib
from sqlalchemy.orm import Session
from sqlalchemy import select
from .config import settings
from .models import Profile, Education, Experience, Skill, Project, PreviousAnswer

CANONICAL_FIELDS={'personal.name':'full_name','personal.email':'email','personal.phone':'phone','personal.location':'location','personal.date_of_birth':'date_of_birth','personal.linkedin':'linkedin','personal.github':'github','personal.portfolio':'portfolio'}
RULES={'personal.email':r'\be-?mail\b','personal.phone':r'\b(phone|mobile|telephone|tel)\b','personal.name':r'\b(full[ -]?name|your name|name)\b','personal.location':r'\b(location|city|address)\b','personal.date_of_birth':r'\b(date of birth|dob|birth date)\b','personal.linkedin':r'\blinkedin\b','personal.github':r'\bgithub\b','personal.portfolio':r'\b(portfolio|personal website)\b','education.institution':r'\b(university|college|institution|school)\b','education.degree':r'\b(degree|qualification)\b','education.field':r'\b(field of study|major|course|subject)\b','experience.company':r'\b(company|employer|organization)\b','experience.position':r'\b(job title|position|role|current title)\b','skills':r'\b(skills?|technologies)\b','projects.name':r'\b(project name)\b'}
RULE_PRIORITIES={'personal.email':100,'personal.phone':100,'personal.date_of_birth':100,'personal.linkedin':100,'personal.github':100,'personal.portfolio':100,'education.institution':90,'education.degree':90,'education.field':90,'experience.company':90,'experience.position':90,'skills':90,'projects.name':90,'personal.name':20,'personal.location':10}
OPEN_ENDED=re.compile(r'\b(why|describe|tell us|explain|goals?|hire|motivat|interest)\b',re.I)

def field_text(f): return ' '.join(filter(None,[f.label,f.placeholder,f.name,f.id_attribute,f.aria_label,f.nearby_text])).lower()
class FieldClassifier:
    def __init__(self):
        self.vectorizer=self.model=None
        try:
            self.vectorizer=joblib.load(settings.model_dir/'tfidf_vectorizer.joblib'); self.model=joblib.load(settings.model_dir/'field_classifier.joblib')
        except Exception: pass
    def predict(self,f):
        text=field_text(f)
        matches=[(RULE_PRIORITIES[field],len(m.group(0)),field) for field, pattern in RULES.items() if (m:=re.search(pattern,text))]
        if matches:
            # Prefer the most specific phrase: "university name" must not become a generic name field.
            return max(matches)[2], .99, 'rule'
        if self.model and text:
            probabilities=self.model.predict_proba(self.vectorizer.transform([text]))[0]; i=probabilities.argmax()
            return self.model.classes_[i], float(probabilities[i]), 'ml'
        return None, 0.0, 'none'
classifier=FieldClassifier()
def get_value(db:Session, field:str):
    profile=db.get(Profile,1)
    if field in CANONICAL_FIELDS: return getattr(profile,CANONICAL_FIELDS[field],'') if profile else ''
    collection, attr=field.split('.',1) if '.' in field else ('','')
    model={'education':Education,'experience':Experience,'projects':Project}.get(collection)
    if field=='skills': return ', '.join(x.name for x in db.scalars(select(Skill)).all())
    row=db.scalars(select(model).order_by(model.id)).first() if model else None
    return getattr(row,attr,'') if row and hasattr(row,attr) else ''
def context_for(db, question):
    q=set(re.findall(r'\w+',question.lower())); parts=[]; sources=[]
    p=db.get(Profile,1)
    if p: parts.append('Profile: '+json.dumps({k:getattr(p,k) for k in CANONICAL_FIELDS.values() if getattr(p,k)})); sources.append('profile')
    skills=[s.name for s in db.scalars(select(Skill)).all()]
    if skills: parts.append('Skills: '+', '.join(skills)); sources.append('skills')
    for model,name in [(Education,'education'),(Experience,'experience'),(Project,'projects')]:
        rows=db.scalars(select(model)).all()
        if rows: parts.append(name.title()+': '+ '\n'.join(str({c.name:getattr(r,c.name) for c in r.__table__.columns if getattr(r,c.name)}) for r in rows)); sources.append(name)
    answers=db.scalars(select(PreviousAnswer)).all()
    ranked=sorted(answers,key=lambda a:len(q & set(re.findall(r'\w+',a.question.lower()))),reverse=True)[:3]
    if ranked and any(q & set(re.findall(r'\w+',a.question.lower())) for a in ranked): parts.append('Prior approved answers: '+ '\n'.join(a.answer for a in ranked)); sources.append('previous_answers')
    return '\n'.join(parts),sources
async def generate_local(question, context):
    prompt=f'''You help answer an application question. Use ONLY supplied context. Never invent experience, qualifications, companies, achievements, dates, or skills. Answer the exact question naturally. If context is insufficient, say so briefly.\n\nCONTEXT:\n{context}\n\nQUESTION: {question}'''
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response=await client.post(f'{settings.ollama_base_url}/api/generate',json={'model':settings.ollama_model,'prompt':prompt,'stream':False})
            response.raise_for_status(); return response.json().get('response','').strip()
    except httpx.HTTPError as e: raise RuntimeError('Local Ollama is unavailable. Start Ollama and verify the selected model.') from e
def validate_answer(answer, context):
    if not answer.strip(): return False,'The generated answer was empty.'
    if len(answer)>4000: return False,'The generated answer is too long.'
    # Explicit human review remains mandatory; light lexical guard catches clearly unsupported proper names.
    names=re.findall(r'\b[A-Z][a-z]{2,}\b',answer)
    unknown=[n for n in names if n.lower() not in context.lower() and n not in {'I','The','This','My'}]
    return (not bool(unknown), 'Contains details not found in local context.' if unknown else 'Passed local checks.')
