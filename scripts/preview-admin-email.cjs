// Local UI preview with fictional records. All API calls are replaced in the bundle.
const esbuild = require('esbuild');
const http = require('http');
const path = require('path');
const root = path.resolve(__dirname, '..');
async function main() {
  const result = await esbuild.build({absWorkingDir:root, stdin:{contents:`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import AdminEmail from './src/Components/Admin/AdminEmail';
    import './src/Components/Admin/AdminWorkspace.css';
    createRoot(document.getElementById('root')).render(<main className="admin-workspace"><header><p>LOCAL PREVIEW · FICTIONAL STUDENTS · NO EMAILS ARE SENT</p><h1>Email students</h1></header><AdminEmail actorUid="demo-admin"/></main>);
  `, resolveDir:root, loader:'jsx'}, bundle:true, write:false, outdir:'email-preview-output', define:{'process.env.NODE_ENV':'"production"'}, loader:{'.js':'jsx'}, plugins:[{name:'fictional-email-api',setup(build){
    build.onResolve({filter:/Services\/AdminService$/},()=>({path:'email-fixture',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`
      const people=[{uid:'alex',name:'Alex Martin',email:'alex@example.com'},{uid:'sam',name:'Sam Rivera',email:'sam@example.com'},{uid:'jordan',name:'Jordan Lee',email:'jordan@example.com'}];
      const items=[{id:'welcome',actor:'demo-admin',status:'composing',audience:'all',subject:'A quick check-in',message:'Hi everyone, How is your studying going this week?',html:'<p>Hi everyone,</p><p>How is your studying going this week?</p>',to:'All students',createdAt:new Date().toISOString()}];
      const templates=[{id:'weekly',name:'Weekly check-in',subject:'How is your studying going?',message:'Hi, How has your study week been?',html:'<p>Hi,</p><p>How has your study week been?</p>'}];
      export async function adminRequest(path, options={}) {
        if(path.endsWith('/settings')) return {enabled:true,ready:true,testEmail:'secretary@example.com',from:'NurseQuizAI <hello@example.com>',dailyCap:50,remainingToday:50,issues:[]};
        if(path.includes('/students?')) {const q=new URL(path,'http://localhost').searchParams.get('q')||''; return {items:people.filter(p=>(p.name+' '+p.email).toLowerCase().includes(q.toLowerCase())),cursor:null};}
        if(path.endsWith('/templates')) {if(!options.method)return {items:templates};templates.push({...JSON.parse(options.body),id:String(Date.now())});return {id:templates.at(-1).id};}
        if(!options.method) return {items};
        const body=JSON.parse(options.body||'{}');
        if(path.endsWith('/test')) return {status:'sent',to:'secretary@example.com'};
        if(path.endsWith('/send')||path.endsWith('/batch')) {const item=items.find(i=>path.includes('/'+i.id+'/')); if(item)item.status='completed'; return {status:'completed',canContinue:false,counts:{sent:item?.total||1,dry_run:0,skipped:0,failed:0,pending:0}};}
        if(path.endsWith('/drafts')) {const id=body.draft_id||String(Date.now());const old=items.find(i=>i.id===id);const next={...body,id,actor:'demo-admin',status:'composing',createdAt:new Date().toISOString(),to:body.email||'Students to be confirmed'};if(old)Object.assign(old,next);else items.unshift(next);return {id};}
        if(path.endsWith('/ai-draft'))return {subject:body.subject,message:body.message,html:body.html};
        const campaign=path.endsWith('/campaign/preview');
        const recipients=(body.audience==='selected'?people.filter(p=>body.emails.includes(p.email)):people).map(p=>({uid:p.uid,to:p.email,status:'pending'}));
        const draft={id:String(Date.now()),actor:'demo-admin',status:'draft',createdAt:new Date().toISOString(),subject:body.subject,message:body.message,audience:body.audience,sendingEnabled:true,from:'NurseQuizAI <hello@example.com>',to:campaign?recipients.length+' students':body.email||people.find(p=>p.uid===body.uid)?.email,html:'<div style="padding:28px;font:16px Arial;line-height:1.7;color:#292524">'+body.html+'<hr><small>Unsubscribe · Fictional example address</small></div>',...(campaign?{kind:'campaign',total:recipients.length,excluded:0,remainingToday:50,recipients}:{uid:body.uid})};
        items.unshift(draft); return draft;
      }
    `}));
  }}]});
  const files=Object.fromEntries(result.outputFiles.map(f=>[f.path.endsWith('.css')?'/app.css':'/app.js',f.contents]));
  http.createServer((req,res)=>{
    if(files[req.url]) {res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'text/javascript');return res.end(files[req.url]);}
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#191818;color:#f4f2f0;font-family:Arial,sans-serif}</style><title>Email screen preview</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }).listen(4196,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4196'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
