import os
os.environ['DATABASE_URL']='sqlite:///./test.db'
from fastapi.testclient import TestClient
from app.main import app
client=TestClient(app)
def test_profile_and_classification():
    with client:
        assert client.put('/profile',json={'full_name':'Ada Lovelace','email':'ada@example.test','phone':'123'}).status_code==200
        r=client.post('/fields/classify',json={'fields':[{'id':'a','label':'Email Address'},{'id':'b','label':'University Name'}]}).json()['fields']
        assert r[0]['mapped_field']=='personal.email' and r[0]['value']=='ada@example.test'
        assert r[1]['mapped_field']=='education.institution'
def test_crud_and_unknown_field():
    with client:
        created=client.post('/education',json={'institution':'Local University','degree':'BSc'}); assert created.status_code==200
        assert client.get('/education').status_code==200
        r=client.post('/fields/classify',json={'fields':[{'id':'x','label':'Favourite colour'}]}).json()['fields'][0]
        assert r['mapped_field'] is None
        assert client.post('/cv/upload',files={'file':('not-a-cv.txt',b'hello','text/plain')}).status_code==415
        assert client.post('/settings/delete-all-data',json={'confirm':False}).status_code==422
        assert client.get('/').status_code==200
        assert client.get('/ui/ui.js').status_code==200
