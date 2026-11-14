import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
export const dataDir = path.resolve(process.env.DATA_DIR || '.data');
export const newId = () => randomBytes(24).toString('hex');
export const newProfile = () => ({bachelor_major:'',target_course:'',previous_courses:[],interview_answers:[],studied_topics:[],self_reported_confidence:{},demonstrated_knowledge:{},potential_knowledge_gaps:[],diagnostic_results:[],learning_preferences:[],uncertainties:[],generated_plan:null,completed_activities:[],interview_status:'not_started'});
export const newSession = () => ({state:'UPLOAD',profile:newProfile(),document:null,analysis:null,question:null,diagnostic:null,messages:[],created_at:Date.now(),updated_at:Date.now()});
export async function initializeStore() {
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const files=(await readdir(dataDir)).filter(f=>/^[a-f0-9]{48}\.json$/.test(f));
  const entries=await Promise.all(files.map(async f=>({f,mtime:(await stat(path.join(dataDir,f))).mtimeMs})));
  entries.sort((a,b)=>b.mtime-a.mtime);
  await Promise.all(entries.filter((e,i)=>i>=200 || Date.now()-e.mtime>30*86400000).map(e=>unlink(path.join(dataDir,e.f))));
}
export async function load(id) {
  try { return JSON.parse(await readFile(path.join(dataDir,id+'.json'),'utf8')); }
  catch(e) { if(e.code==='ENOENT') return newSession(); throw e; }
}
export async function save(id,s) {
  s.updated_at=Date.now();
  s.messages=s.messages.slice(-60);
  const dest=path.join(dataDir,id+'.json');
  await writeFile(dest+'.tmp',JSON.stringify(s),{mode:0o600}); await rename(dest+'.tmp',dest);
}
export async function remove(id) { await unlink(path.join(dataDir,id+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;}); }
