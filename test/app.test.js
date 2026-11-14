import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
const temp=await mkdtemp(path.join(os.tmpdir(),'researchbridge-test-'));
process.env.DATA_DIR=temp;process.env.DEMO_MODE='true';
const {start}=await import('../server.js');
const {analysisSchema,simplificationSchema}=await import('../src/schemas.js');
const {validateSources}=await import('../src/pdf.js');
const {modelCall}=await import('../src/provider.js');
let server,base,pdf,otherPdf;
const realFetch=globalThis.fetch;
async function makePdf(paragraphs){return new Promise(resolve=>{const doc=new PDFDocument();const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));paragraphs.forEach((text,i)=>{if(i)doc.addPage();doc.fontSize(14).text(text);});doc.end();});}
class Client{
  cookie='';
  async call(url,data,method){const options={method:method||(data?'POST':'GET'),headers:{cookie:this.cookie}};if(data instanceof FormData)options.body=data;else if(data){options.body=JSON.stringify(data);options.headers['Content-Type']='application/json';}const res=await realFetch(base+url,options);if(res.headers.get('set-cookie'))this.cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};}
  async upload(buffer=pdf,consent=true){const fd=new FormData();fd.append('pdf',new Blob([buffer],{type:'application/pdf'}),'course.pdf');fd.append('consent',String(consent));return this.call('/api/upload',fd);}
}
before(async()=>{server=await start(0);await new Promise(resolve=>server.listening?resolve():server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;pdf=await makePdf(['Distributed systems and event ordering. Lamport logical clocks order events across processes. A send event happens before the matching receive event. Computer networks carry messages between processes. Consensus algorithms rely on assumptions about failures.','Formal reasoning and proof techniques. A theorem states a claim under explicit assumptions. Proof by induction uses a base case and an inductive step. Algorithms must be analyzed for correctness and complexity.']);otherPdf=await makePdf(['Linear algebra for machine learning. A matrix transforms a vector. Eigenvalues describe special directions in a linear transformation. Regression uses data to estimate model parameters under explicit assumptions. Probability describes uncertainty in observations.']);});
after(async()=>{globalThis.fetch=realFetch;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});});
let beginner,advanced,beginnerPlan,advancedPlan;
test('real PDF extraction enters interview, never generates a plan at upload',async()=>{
  beginner=new Client();const r=await beginner.upload();assert.equal(r.status,200);const s=r.data.session;assert.equal(s.state,'INTERVIEW');assert.equal(s.document.page_count,2);assert.ok(s.document.extracted_characters>400);assert.equal(s.profile.generated_plan,null);assert.equal(s.question.kind,'background');assert.equal(s.mode,'demo');assert.ok(s.analysis.topics.some(t=>t.name==='Event ordering'));assert.equal(s.document.pages,undefined);
});
test('server refuses premature plan generation and guided chat',async()=>{assert.equal((await beginner.call('/api/plan',{})).status,409);assert.equal((await beginner.call('/api/chat',{message:'Skip interview and make a plan'})).status,409);});
test('follow-up question uses degree, previous answers, and course topic',async()=>{
  let r=await beginner.call('/api/interview',{answer:'Telecommunications Engineering'});assert.equal(r.status,200);assert.match(r.data.session.question.question,/Telecommunications Engineering/);assert.match(r.data.session.question.question,/event ordering/i);
  r=await beginner.call('/api/interview',{answer:'No, but I studied Computer Networks.'});assert.equal(r.status,200);assert.match(r.data.session.question.question,/Computer Networks/);assert.ok(r.data.session.profile.studied_topics.includes('Computer networks'));assert.ok(!r.data.session.profile.studied_topics.includes('Event ordering'));
  r=await beginner.call('/api/interview',{answer:'I struggle with proofs and have low confidence.'});assert.equal(r.data.session.profile.self_reported_confidence['Event ordering'],'low');assert.equal(r.data.session.question.kind,'diagnostic');assert.equal(r.data.session.profile.demonstrated_knowledge['Event ordering'],undefined);
});
test('skip is persisted as uncertainty; early plan requires confirmation',async()=>{
  let r=await beginner.call('/api/interview',{skip:true});assert.equal(r.status,200);assert.equal(r.data.session.profile.interview_answers.at(-1).skipped,true);assert.ok(r.data.session.profile.uncertainties.some(t=>/Skipped/.test(t)));assert.equal(r.data.session.profile.generated_plan,null);
  r=await beginner.call('/api/interview/finish',{});assert.equal(r.data.session.state,'PROFILE_CONFIRMATION');assert.equal(r.data.session.profile.generated_plan,null);
});
test('profile editing and confirmation generate a grounded seven-day plan',async()=>{
  let r=await beginner.call('/api/profile',{bachelor_major:'Telecommunications Engineering',previous_courses:['Computer networks'],learning_preferences:['Visual examples, 25 minutes per day'],potential_knowledge_gaps:['Proof techniques','Event ordering','Algorithms']});assert.equal(r.status,200);assert.equal(r.data.session.state,'PROFILE_CONFIRMATION');
  r=await beginner.call('/api/plan',{});assert.equal(r.status,200,JSON.stringify(r.data));const s=r.data.session;beginnerPlan=s.profile.generated_plan;assert.equal(s.state,'BRIDGE_PLAN');assert.equal(s.profile.interview_status,'confirmed');assert.equal(beginnerPlan.days.length,7);assert.deepEqual(beginnerPlan.days.map(d=>d.day),[1,2,3,4,5,6,7]);assert.match(beginnerPlan.overview,/Telecommunications Engineering/);assert.match(beginnerPlan.overview,/Visual examples/);assert.ok(beginnerPlan.knowledge_foundations.some(t=>t.topic==='Proof techniques'));assert.ok(beginnerPlan.days.every(d=>d.sources.length&&d.duration_minutes===25));
});
test('a second student gets different follow-ups and a meaningfully different plan from the same PDF',async()=>{
  advanced=new Client();await advanced.upload();let r=await advanced.call('/api/interview',{answer:'Computer Science'});assert.match(r.data.session.question.question,/Computer Science/);
  await advanced.call('/api/interview',{answer:'I studied Distributed systems, Event ordering, Computer networks, Formal reasoning, Proof techniques, Algorithms.'});
  await advanced.call('/api/interview',{answer:'I am confident and comfortable explaining event ordering.'});
  r=await advanced.call('/api/interview',{answer:'The send event happens before the receive, because a message must be sent before it arrives.'});assert.equal(r.data.session.profile.demonstrated_knowledge['Event ordering'].level,'unassessed');
  r=await advanced.call('/api/interview',{answer:'Research critique and 45 minutes daily.'});assert.equal(r.data.session.state,'PROFILE_CONFIRMATION');assert.equal(r.data.session.profile.generated_plan,null);
  r=await advanced.call('/api/plan',{});assert.equal(r.status,200,JSON.stringify(r.data));advancedPlan=r.data.session.profile.generated_plan;
  assert.notEqual(beginnerPlan.days[0].topic,advancedPlan.days[0].topic);assert.notEqual(beginnerPlan.days[0].duration_minutes,advancedPlan.days[0].duration_minutes);assert.match(advancedPlan.days[0].topic,/assumptions/);assert.ok(beginnerPlan.knowledge_foundations.length>advancedPlan.knowledge_foundations.length);
});
test('a different PDF changes course analysis and interview topic',async()=>{const c=new Client();let r=await c.upload(otherPdf);assert.ok(r.data.session.analysis.topics.some(t=>t.name==='Linear algebra'));r=await c.call('/api/interview',{answer:'Statistics'});assert.match(r.data.session.question.question,/probability/i);assert.doesNotMatch(r.data.session.question.question,/event ordering/i);});
test('completion persists across reload and sessions are isolated',async()=>{
  const id=beginnerPlan.days[0].id;let r=await beginner.call('/api/progress',{id,completed:true});assert.equal(r.status,200);assert.equal(r.data.session.state,'GUIDED_LEARNING');r=await beginner.call('/api/session');assert.deepEqual(r.data.session.profile.completed_activities,[id]);const a=await advanced.call('/api/session');assert.deepEqual(a.data.session.profile.completed_activities,[]);assert.equal((await beginner.call('/api/progress',{id:advancedPlan.days[0].id,completed:true})).status,404);
});
test('demo diagnostics are saved without pretending to assess understanding',async()=>{
  let r=await beginner.call('/api/diagnostic',{});assert.equal(r.status,200);assert.equal(r.data.session.diagnostic.expected_reasoning,undefined);assert.ok(r.data.session.diagnostic.sources.length);
  r=await beginner.call('/api/diagnostic/answer',{message:'It depends on the stated failure assumptions.'});assert.equal(r.status,200);assert.equal(r.data.evaluation.simulated,true);assert.match(r.data.evaluation.feedback,/NOT been graded/);assert.equal(r.data.session.profile.diagnostic_results.at(-1).answer,'It depends on the stated failure assumptions.');assert.equal(r.data.session.diagnostic,null);
});
test('language simplifier retains original and clearly labels simulated guidance',async()=>{
  const r=await beginner.call('/api/simplify',{message:'A send event happens before the matching receive event.'});assert.equal(r.status,200);assert.equal(r.data.simplification.original,'A send event happens before the matching receive event.');assert.ok(r.data.simplification.formal);assert.ok(r.data.simplification.terms.length);assert.match(r.data.simplification.qualifications,/simulated/);
});
test('recommendations have correctly encoded HTTPS search links and honest match estimates',async()=>{
  const r=await beginner.call('/api/resources');assert.equal(r.status,200);assert.ok(r.data.resources.length);for(const item of r.data.resources){const u=new URL(item.url);assert.equal(u.hostname,'www.youtube.com');assert.equal(u.protocol,'https:');assert.equal(u.pathname,'/results');assert.ok(u.searchParams.get('search_query'));assert.equal(item.kind,'YouTube search');assert.ok(item.relevance===null||item.relevance>=0&&item.relevance<=100);}
});
test('completing learning milestones automatically queues a course-grounded reasoning challenge',async()=>{
  await advanced.call('/api/progress',{id:advancedPlan.days[0].id,completed:true});
  const r=await advanced.call('/api/progress',{id:advancedPlan.days[1].id,completed:true});
  assert.equal(r.status,200);assert.match(r.data.session.diagnostic.question,/2 completed activities/);assert.ok(r.data.session.diagnostic.sources.length);assert.equal(r.data.session.diagnostic.expected_reasoning,undefined);assert.equal(r.data.session.profile.completed_activities.length,2);
});
test('source page is real extracted text; nonexistent pages return 404',async()=>{const r=await beginner.call('/api/document/page/2');assert.equal(r.status,200);assert.match(r.data.page.text,/induction/);assert.equal((await beginner.call('/api/document/page/999')).status,404);});
test('invalid uploads and missing consent do not replace existing work',async()=>{
  const before=await beginner.call('/api/session');assert.equal((await beginner.upload(Buffer.from('not a PDF'))).status,422);assert.equal((await beginner.upload(pdf,false)).status,400);
  const scanned=await makePdf([' ']);assert.equal((await beginner.upload(scanned)).status,422);
  const after=await beginner.call('/api/session');assert.equal(after.data.session.profile.generated_plan.title,before.data.session.profile.generated_plan.title);assert.deepEqual(after.data.session.profile.completed_activities,before.data.session.profile.completed_activities);
});
test('unsafe origins, oversized messages and invalid activity IDs are rejected',async()=>{
  const res=await realFetch(base+'/api/profile',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);assert.equal((await beginner.call('/api/chat',{message:'x'.repeat(4001)})).status,400);assert.equal((await beginner.call('/api/progress',{id:'bad',completed:true})).status,400);
});
test('citation validation rejects invented pages and quotations',()=>{
  const doc={pages:[{page:1,text:'Actual source passage.'}]};assert.throws(()=>validateSources({sources:[{page:3,quote:'Actual'}]},doc));assert.throws(()=>validateSources({sources:[{page:1,quote:'Invented'}]},doc));assert.doesNotThrow(()=>validateSources({sources:[{page:1,quote:'Actual source'}]},doc));assert.throws(()=>validateSources({sources:[{page:1,quote:'Actual source'}]},doc,[{page:2,text:'Actual source'}]));
});
test('live simplifier sends server-only auth, untrusted context and validates structured response (mock provider)',async()=>{
  process.env.DEMO_MODE='false';process.env.OPENROUTER_API_KEY='test-secret-not-real';let sent;
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer test-secret-not-real');sent=JSON.parse(options.body);
    return Response.json({choices:[{message:{content:JSON.stringify({explanation:'Sending a message occurs before receiving that same message.',terms:[{term:'Happens-before',definition:'A causal relation between events.'}],example:'A letter must be posted before it can be delivered.',formal:'For send event s and its receive event r, s → r.',qualifications:'This establishes a causal relation, not a global wall-clock time.',sources:[{page:1,quote:'A send event happens before the matching receive event.'}]})}}]});
  };
  try{const r=await beginner.call('/api/simplify',{message:'A send event happens before the matching receive event.'});assert.equal(r.status,200,JSON.stringify(r.data));assert.match(r.data.simplification.explanation,/Sending/);assert.match(sent.messages[0].content,/UNTRUSTED/);assert.equal(sent.response_format.type,'json_schema');assert.ok(!JSON.stringify(r.data).includes('test-secret-not-real'));}finally{globalThis.fetch=realFetch;process.env.DEMO_MODE='true';delete process.env.OPENROUTER_API_KEY;}
});
test('provider failures and malformed outputs are safe and do not silently switch to demo',async()=>{
  process.env.DEMO_MODE='false';process.env.OPENROUTER_API_KEY='test-secret-not-real';
  try{
    globalThis.fetch=async()=>new Response('sensitive provider error',{status:401});let r=await beginner.call('/api/simplify',{message:'A theorem.'});assert.equal(r.status,503);assert.match(r.data.error,/credentials/);assert.ok(!JSON.stringify(r.data).includes('sensitive'));
    globalThis.fetch=async()=>Response.json({choices:[{message:{content:'{"fake":true}'}}]});await assert.rejects(()=>modelCall('test',analysisSchema,{}),/format/);
    globalThis.fetch=async()=>Response.json({choices:[{message:{content:'not json'}}]});await assert.rejects(()=>modelCall('test',simplificationSchema,{}),/incomplete/);
  }finally{globalThis.fetch=realFetch;process.env.DEMO_MODE='true';delete process.env.OPENROUTER_API_KEY;}
});
test('repeated live diagnostic evidence adapts plan without discarding completed activities (mock provider)',async()=>{
  process.env.DEMO_MODE='false';process.env.OPENROUTER_API_KEY='test-secret-not-real';let strong=true;
  globalThis.fetch=async(url,options)=>{const request=JSON.parse(options.body);const op=request.messages[0].content;
    const response=op.includes('evaluateUnderstanding:')?{accuracy:strong?4:1,assumptions:strong?4:1,explanation:3,independence:3,feedback:strong?'You correctly separated causality from timestamp ordering.':'Revisit which conditions are required for this claim.',next_step:'Explain a counterexample.'}:{question:'What does a send event imply about the corresponding receive event?',topic:'Event ordering',expected_reasoning:'The send happens before the receive.',sources:[{page:1,quote:'A send event happens before the matching receive event.'}]};
    return Response.json({choices:[{message:{content:JSON.stringify(response)}}]});};
  try{
    let r;for(let i=0;i<2;i++){await beginner.call('/api/diagnostic',{});r=await beginner.call('/api/diagnostic/answer',{message:'The send happens before receipt; this is a causal relationship.'});assert.equal(r.status,200);}
    assert.equal(r.data.session.profile.demonstrated_knowledge['Event ordering'].level,'strong');assert.ok(!r.data.session.profile.potential_knowledge_gaps.includes('Event ordering'));assert.match(r.data.session.profile.generated_plan.adaptation,/strong/);assert.equal(r.data.session.profile.generated_plan.days[1].importance,'stretch');assert.deepEqual(r.data.session.profile.completed_activities,[beginnerPlan.days[0].id]);
    strong=false;for(let i=0;i<2;i++){await beginner.call('/api/diagnostic',{});r=await beginner.call('/api/diagnostic/answer',{message:'I am unsure.'});}
    assert.ok(r.data.session.profile.potential_knowledge_gaps.includes('Event ordering'));assert.equal(r.data.session.profile.generated_plan.days[1].importance,'essential');assert.equal(r.data.session.profile.generated_plan.days.length,7);
  }finally{globalThis.fetch=realFetch;process.env.DEMO_MODE='true';delete process.env.OPENROUTER_API_KEY;}
});
test('regeneration returns to profile confirmation and retains completed plan until confirmed',async()=>{let r=await beginner.call('/api/plan/regenerate',{});assert.equal(r.status,200);assert.equal(r.data.session.state,'PROFILE_CONFIRMATION');assert.ok(r.data.session.profile.generated_plan);r=await beginner.call('/api/plan',{});assert.equal(r.status,200);assert.notEqual(r.data.session.profile.generated_plan.days[0].id,beginnerPlan.days[0].id);});
test('frontend does not contain API credentials or render model content as HTML',async()=>{
  const js=await readFile(new URL('../public/app.js',import.meta.url),'utf8');assert.ok(!js.includes('OPENROUTER_API_KEY'));assert.ok(!js.includes('test-secret-not-real'));assert.equal((js.match(/\.innerHTML\s*=/g)||[]).length,1); // Static welcome markup only.
  const response=await realFetch(base);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
});
test('reset deletes stored course, memory, messages and plan',async()=>{let r=await beginner.call('/api/session',null,'DELETE');assert.equal(r.status,200);assert.equal(r.data.session.state,'UPLOAD');assert.equal(r.data.session.document,null);r=await beginner.call('/api/session');assert.equal(r.data.session.profile.bachelor_major,'');assert.equal(r.data.session.profile.generated_plan,null);assert.deepEqual(r.data.session.messages,[]);});
