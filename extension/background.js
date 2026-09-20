const API='http://127.0.0.1:8000';
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.type==='classify') fetch(`${API}/fields/classify`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:message.fields})})
    .then(async r=>{if(!r.ok) throw new Error((await r.json()).detail||'Backend error');return r.json()}).then(reply).catch(e=>reply({error:e.message}));
  if(message.type==='health') fetch(`${API}/health`).then(r=>r.json()).then(reply).catch(()=>reply({status:'offline'}));
  if(message.type==='generate') fetch(`${API}/answers/generate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:message.question})})
    .then(async r=>{if(!r.ok) throw new Error((await r.json()).detail||'Generation failed');return r.json()}).then(reply).catch(e=>reply({error:e.message}));
  return true;
});
