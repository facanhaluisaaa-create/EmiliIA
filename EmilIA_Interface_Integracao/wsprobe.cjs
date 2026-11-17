const WebSocket = require('/tmp/claude-0/-home-user-EmiliIA/b3cbaaaa-db5a-53a1-ab46-f80dd3945e63/scratchpad/n8nrun/node_modules/ws');
const BASE='https://grupoemilia.app.n8n.cloud';
const URL_=BASE+'/webhook/emilia-g29-m5-chat/chat';
(async()=>{
 const sessionId='ui-probe-'+Date.now();
 const t0=Date.now();
 const r=await fetch(URL_,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'sendMessage',sessionId,chatInput:process.argv[2]||'Olá, o que você faz?'})});
 const j=await r.json(); console.log('POST',r.status,j);
 const ws=new WebSocket(`wss://grupoemilia.app.n8n.cloud/chat?sessionId=${sessionId}&executionId=${j.executionId}&isPublic=true&token=${encodeURIComponent(j.resumeToken||'')}`);
 ws.on('open',()=>console.log('ws open',Date.now()-t0));
 ws.on('message',m=>{console.log('MSG',Date.now()-t0,'ms:',m.toString().slice(0,600));});
 ws.on('close',(c,r)=>{console.log('close',c,r.toString(),Date.now()-t0);process.exit(0)});
 ws.on('error',e=>console.log('err',e.message));
 setTimeout(()=>{console.log('timeout');process.exit(1)},90000);
})();
