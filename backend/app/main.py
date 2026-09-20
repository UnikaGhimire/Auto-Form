import shutil, uuid
from pathlib import Path
import fitz
from docx import Document
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select
from .database import Base, engine, get_db
from .models import Profile, Education, Experience, Skill, Project, PreviousAnswer
from .schemas import *
from .config import settings
from .services import classifier, get_value, field_text, OPEN_ENDED, context_for, generate_local, validate_answer

app=FastAPI(title='Automatic Form Filler',version='1.0.0')
app.mount('/ui', StaticFiles(directory=Path(__file__).parent/'static'), name='ui')
app.add_middleware(CORSMiddleware,allow_origin_regex=r'chrome-extension://.*',allow_methods=['GET','POST','PUT','DELETE'],allow_headers=['*'])
@app.on_event('startup')
def init(): Base.metadata.create_all(engine)
@app.get('/', include_in_schema=False)
def dashboard(): return FileResponse(Path(__file__).parent/'static'/'index.html')
@app.get('/health')
def health(): return {'status':'ok','model_loaded':classifier.model is not None,'ollama_url':settings.ollama_base_url}
def one(model, db):
    row=db.get(model,1)
    if not row: row=model(id=1); db.add(row); db.commit(); db.refresh(row)
    return row
@app.get('/profile')
def profile(db:Session=Depends(get_db)): return one(Profile,db)
@app.put('/profile')
def update_profile(data:ProfileIn,db:Session=Depends(get_db)):
    row=one(Profile,db)
    for k,v in data.model_dump().items(): setattr(row,k,v)
    db.commit(); db.refresh(row); return row
@app.delete('/profile')
def delete_profile(db:Session=Depends(get_db)):
    row=db.get(Profile,1)
    if row: db.delete(row); db.commit()
    return {'deleted':True}
def crud(prefix,model,schema):
    @app.get('/'+prefix)
    def list_(db:Session=Depends(get_db)): return db.scalars(select(model)).all()
    @app.post('/'+prefix)
    def create(data:schema,db:Session=Depends(get_db)):
        row=model(**data.model_dump()); db.add(row); db.commit(); db.refresh(row); return row
    @app.put('/'+prefix+'/{item_id}')
    def update(item_id:int,data:schema,db:Session=Depends(get_db)):
        row=db.get(model,item_id)
        if not row: raise HTTPException(404,'Item not found')
        for k,v in data.model_dump().items(): setattr(row,k,v)
        db.commit(); db.refresh(row); return row
    @app.delete('/'+prefix+'/{item_id}')
    def delete(item_id:int,db:Session=Depends(get_db)):
        row=db.get(model,item_id)
        if not row: raise HTTPException(404,'Item not found')
        db.delete(row);db.commit();return {'deleted':True}
crud('education',Education,EducationIn); crud('experience',Experience,ExperienceIn); crud('projects',Project,ProjectIn); crud('answers',PreviousAnswer,AnswerIn)
@app.get('/skills')
def skills(db:Session=Depends(get_db)): return db.scalars(select(Skill)).all()
@app.post('/skills')
def add_skill(data:SkillIn,db:Session=Depends(get_db)):
    if db.scalar(select(Skill).where(Skill.name==data.name)): raise HTTPException(409,'Skill already exists')
    x=Skill(**data.model_dump());db.add(x);db.commit();db.refresh(x);return x
@app.delete('/skills/{item_id}')
def delete_skill(item_id:int,db:Session=Depends(get_db)):
    x=db.get(Skill,item_id)
    if not x: raise HTTPException(404,'Skill not found')
    db.delete(x);db.commit();return {'deleted':True}
@app.post('/fields/classify')
def classify(payload:ClassifyRequest,db:Session=Depends(get_db)):
    result=[]
    for f in payload.fields:
        if OPEN_ENDED.search(field_text(f)):
            result.append({'id':f.id,'mapped_field':None,'confidence':0,'value':'','kind':'open_ended'});continue
        mapped,confidence,source=classifier.predict(f); value=get_value(db,mapped) if mapped and confidence>=settings.suggest_threshold else ''
        result.append({'id':f.id,'mapped_field':mapped if confidence>=settings.suggest_threshold else None,'confidence':confidence,'value':value,'kind':'simple','source':source,'requires_review':confidence<settings.auto_fill_threshold})
    return {'fields':result}
@app.post('/context')
def context(payload:GenerateRequest,db:Session=Depends(get_db)):
    value,sources=context_for(db,payload.question);return {'context':value,'sources':sources}
@app.post('/answers/generate')
async def generate(payload:GenerateRequest,db:Session=Depends(get_db)):
    context,sources=context_for(db,payload.question)
    if not context: raise HTTPException(422,'Add profile information before generating an answer.')
    try: answer=await generate_local(payload.question,context)
    except RuntimeError as e: raise HTTPException(503,str(e))
    valid,message=validate_answer(answer,context)
    return {'answer':answer,'confidence':.75 if valid else .25,'sources':sources,'valid':valid,'validation_message':message}
@app.post('/answers/validate')
def validate(payload:AnswerIn,db:Session=Depends(get_db)):
    context,_=context_for(db,payload.question); valid,message=validate_answer(payload.answer,context);return {'valid':valid,'message':message}
@app.post('/cv/upload')
async def upload_cv(file:UploadFile=File(...)):
    suffix=Path(file.filename or '').suffix.lower()
    if suffix not in {'.pdf','.docx'}: raise HTTPException(415,'Only PDF and DOCX files are supported.')
    content=await file.read()
    if len(content)>settings.max_cv_bytes: raise HTTPException(413,'CV exceeds the 10 MB limit.')
    dest=settings.upload_dir/f'{uuid.uuid4()}{suffix}';dest.write_bytes(content)
    try:
        text=''.join(p.get_text() for p in fitz.open(stream=content,filetype='pdf')) if suffix=='.pdf' else '\n'.join(p.text for p in Document(dest).paragraphs)
    except Exception:
        dest.unlink(missing_ok=True);raise HTTPException(422,'The CV could not be read.')
    return {'filename':file.filename,'text':text[:100000],'sections':{x:[] for x in ['education','experience','skills','projects']},'review_required':True}
@app.post('/settings/delete-all-data')
def delete_all_data(payload:ConfirmDelete,db:Session=Depends(get_db)):
    if not payload.confirm: raise HTTPException(422,'Set confirm to true to delete all local data.')
    for model in (Education,Experience,Skill,Project,PreviousAnswer,Profile): db.query(model).delete()
    db.commit()
    for path in settings.upload_dir.iterdir():
        if path.is_file(): path.unlink()
    return {'deleted':True}
