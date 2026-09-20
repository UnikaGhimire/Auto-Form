"""Train locally; never runs during API startup."""
from pathlib import Path
import csv, joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
root=Path(__file__).resolve().parents[1]
with open(root/'training'/'dataset.csv',encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
vectorizer=TfidfVectorizer(ngram_range=(1,2),lowercase=True,sublinear_tf=True)
model=LogisticRegression(max_iter=2000,class_weight='balanced',random_state=42).fit(vectorizer.fit_transform([r['text'] for r in rows]),[r['label'] for r in rows])
(root/'models').mkdir(exist_ok=True)
joblib.dump(vectorizer,root/'models'/'tfidf_vectorizer.joblib'); joblib.dump(model,root/'models'/'field_classifier.joblib')
print(f'Trained {len(model.classes_)} classes on {len(rows)} examples.')
