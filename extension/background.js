const API='http://127.0.0.1:8000';
const request=(path,options={})=>fetch(`${API}${path}`,{headers:{'Content-Type':'application/json'},...options})
  .then(async r=>{if(!r.ok) throw new Error((await r.json().catch(()=>({}))).detail||'Backend error');return r.json()});
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.type==='classify') request('/fields/classify',{method:'POST',body:JSON.stringify({fields:message.fields})}).then(reply).catch(e=>reply({error:e.message}));
  if(message.type==='health') request('/health').then(reply).catch(()=>reply({status:'offline'}));
  if(message.type==='generate') request('/answers/generate',{method:'POST',body:JSON.stringify({question:message.question,length:message.length})}).then(reply).catch(e=>reply({error:e.message}));
  if(message.type==='save-answer') request('/answers/save',{method:'POST',body:JSON.stringify({question:message.question,answer:message.answer})}).then(reply).catch(e=>reply({error:e.message}));
  return true;
});
