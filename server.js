import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { extractPDF } from './src/pdf.js';
import { initializeStore,load,save,remove,newId,newSession } from './src/store.js';
import { isDemo } from './src/provider.js';
import * as agent from './src/agent.js';
import { recommendResources } from './src/resources.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:2}});
const locks=new Set();const rates=new Map();const budgets=new Map();
const input=z.object({message:z.string().trim().min(1).max(4000)});
const profileEdit=z.object({bachelor_major:z.string().trim().max(200),previous_courses:z.array(z.string().trim().min(1).max(200)).max(20),learning_preferences:z.array(z.string().trim().min(1).max(200)).max(10),potential_knowledge_gaps:z.array(z.string().trim().min(1).max(200)).max(20)});
export const app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
  if(req.path.startsWith('/api/')) {
    res.set('Cache-Control','no-store');
    const origin=req.get('origin');
    if(origin){try{if(new URL(origin).host!==req.get('host'))return res.status(403).json({error:'Cross-origin requests are not permitted.'});}catch{return res.status(403).json({error:'Invalid origin.'});}}
    if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Cross-site requests are not permitted.'});
    const ip=req.ip;const now=Date.now();
    if(rates.size>1000)for(const [k,v]of rates)if(now-v.at>60000)rates.delete(k);
    const r=rates.get(ip);if(r&&now-r.at<60000){r.count++;if(r.count>90)return res.status(429).json({error:'Too many requests. Please wait a minute.'});}else rates.set(ip,{at:now,count:1});
  }
  next();
});
app.use(express.json({limit:'24kb'}));
app.get('/api/health',(req,res)=>res.json({ok:true,mode:isDemo()?'demo':'live'}));
app.use('/api',async(req,res,next)=>{
  try{
    const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(c=>c.trim().split('=')));
    let id=cookies.rb_session;
    if(!/^[a-f0-9]{48}$/.test(id||'')){
      id=newId();res.cookie('rb_session',id,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:30*86400000,path:'/'});
    }
    req.sessionId=id;next();
  }catch(e){next(e);}
});
function publicState(s){const copy=structuredClone(s);if(copy.document)copy.document={name:copy.document.name,page_count:copy.document.pages.length,extracted_characters:copy.document.pages.reduce((n,p)=>n+p.text.length,0)};if(copy.diagnostic)delete copy.diagnostic.expected_reasoning;return {...copy,mode:isDemo()?'demo':'live'};}
function route(fn,{model=false}={}) {
  return async(req,res,next)=>{
    if(locks.has(req.sessionId))return res.status(409).json({error:'Another operation is running. Please wait for it to finish.'});
    locks.add(req.sessionId);
    try{
      if(model&&!isDemo()){
        const now=Date.now();if(budgets.size>1000)for(const[k,v]of budgets)if(now-v.at>3600000)budgets.delete(k);
        let b=budgets.get(req.ip);if(!b||now-b.at>3600000){b={at:now,count:0};budgets.set(req.ip,b);}
        if(b.count>=50){const e=new Error('AI call limit reached (50 per hour). Please try later.');e.status=429;throw e;}b.count++;
      }
      const s=await load(req.sessionId);const extra=await fn(req,s,res);
      await save(req.sessionId,s);res.json({session:publicState(s),...extra});
    }catch(e){next(e);}finally{locks.delete(req.sessionId);}
  };
}
app.get('/api/session',route(async()=>({})));
app.post('/api/upload',upload.single('pdf'),route(async(req,s)=>{
  if(!req.file) {const e=new Error('Choose a PDF file to upload.');e.status=400;throw e;}
  if(req.body.consent!=='true'){const e=new Error('Please acknowledge external AI processing before uploading.');e.status=400;throw e;}
  const extracted=await extractPDF(req.file.buffer);
  const fresh=newSession();
  await agent.analyzeCourse(fresh,{name:path.basename(req.file.originalname).slice(0,150),...extracted});
  Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);
},{model:true}));
app.post('/api/interview',route(async(req,s)=>{
  const body=z.object({answer:z.string().trim().max(4000).default(''),skip:z.boolean().default(false)}).parse(req.body);
  if(!body.skip&&!body.answer){const e=new Error('Enter an answer or skip this question.');e.status=400;throw e;}
  await agent.interviewStudent(s,body.answer,body.skip);
},{model:true}));
app.post('/api/interview/finish',route(async(req,s)=>{agent.confirmProfile(s);}));
app.post('/api/profile',route(async(req,s)=>{
  if(!s.analysis){const e=new Error('Upload a course first.');e.status=409;throw e;}
  const p=profileEdit.parse(req.body);Object.assign(s.profile,p);
  if(s.state!=='INTERVIEW'){s.state='PROFILE_CONFIRMATION';s.profile.interview_status='awaiting_confirmation';s.diagnostic=null;}
}));
app.post('/api/interview/restart',route(async(req,s)=>{
  if(!s.analysis){const e=new Error('Upload a course first.');e.status=409;throw e;}
  s.profile.interview_answers=[];s.profile.interview_status='in_progress';s.state='INTERVIEW';s.diagnostic=null;
  s.question={question:'What would you like me to know about your academic background and previous studies?',topic:'Academic background',kind:'background',sources:[]};
  s.messages.push({role:'assistant',text:s.question.question,sources:[],at:Date.now()});
}));
app.post('/api/plan',route(async(req,s)=>{await agent.generateBridgePlan(s);},{model:true}));
app.post('/api/plan/regenerate',route(async(req,s)=>{
  if(!['BRIDGE_PLAN','GUIDED_LEARNING'].includes(s.state)){const e=new Error('Create your first plan before regenerating it.');e.status=409;throw e;}
  s.state='PROFILE_CONFIRMATION';s.profile.interview_status='awaiting_confirmation';s.diagnostic=null;
}));
app.post('/api/simplify',route(async(req,s)=>{
  const {message}=input.parse(req.body);return {simplification:await agent.simplifyAcademicText(s,message)};
},{model:true}));
app.post('/api/diagnostic',route(async(req,s)=>{await agent.startDiagnostic(s);},{model:true}));
app.post('/api/diagnostic/answer',route(async(req,s)=>{
  const {message}=input.parse(req.body);return {evaluation:await agent.evaluateUnderstanding(s,message)};
},{model:true}));
app.post('/api/chat',route(async(req,s)=>{await agent.chat(s,input.parse(req.body).message);},{model:true}));
app.post('/api/progress',route(async(req,s)=>{
  const {id,completed}=z.object({id:z.string().uuid(),completed:z.boolean()}).parse(req.body);agent.updateProgress(s,id,completed);
}));
app.get('/api/resources',route(async(req,s)=>{
  if(!s.profile.generated_plan){const e=new Error('Generate your plan first.');e.status=409;throw e;}
  return {resources:recommendResources(s)};
}));
app.get('/api/document/page/:page',route(async(req,s)=>{
  const n=Number(req.params.page);const page=s.document?.pages.find(p=>p.page===n);
  if(!page){const e=new Error('Page not found.');e.status=404;throw e;}
  return {page};
}));
app.delete('/api/session',async(req,res,next)=>{
  if(locks.has(req.sessionId))return res.status(409).json({error:'Wait for the current operation before deleting your profile.'});
  locks.add(req.sessionId);
  try{await remove(req.sessionId);res.clearCookie('rb_session',{path:'/'});res.json({session:publicState(newSession())});}catch(e){next(e);}finally{locks.delete(req.sessionId);}
});
app.use(express.static(path.join(here,'public')));
app.use('/api',(req,res)=>res.status(404).json({error:'Unknown API endpoint.'}));
app.use((err,req,res,next)=>{
  if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'PDF uploads are limited to 10 MB.':'Upload one PDF file at a time.'});
  if(err instanceof z.ZodError)return res.status(400).json({error:'Some fields are invalid or too long. Please review your input.'});
  if(err.type==='entity.too.large')return res.status(413).json({error:'The request is too large.'});
  if(err instanceof SyntaxError&&'body'in err)return res.status(400).json({error:'Invalid JSON request.'});
  const safe=err.status || /PDF|extracted|source|AI plan/.test(err.message);
  if(!safe)console.error('Request failed:',err.name); // Never log provider responses or student content.
  res.status(err.status|| (safe?422:500)).json({error:safe?err.message:'Something went wrong. Your saved progress is unchanged. Please retry.'});
});
export async function start(port=Number(process.env.PORT)||3000){await initializeStore();return app.listen(port,'0.0.0.0',()=>console.log(`ResearchBridge listening on port ${port} (${isDemo()?'SIMULATED DEMO':'OpenRouter'} mode)`));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await start();
