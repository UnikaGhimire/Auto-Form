from pathlib import Path
import csv, joblib
from sklearn.metrics import classification_report, confusion_matrix
root=Path(__file__).resolve().parents[1]
with open(root/'training'/'dataset.csv',encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
v=joblib.load(root/'models'/'tfidf_vectorizer.joblib'); m=joblib.load(root/'models'/'field_classifier.joblib')
y=[r['label'] for r in rows]; pred=m.predict(v.transform([r['text'] for r in rows]))
print(classification_report(y,pred,zero_division=0)); print(confusion_matrix(y,pred,labels=m.classes_))
