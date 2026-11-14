let session, busy=false, currentView='chat', selectedFile=null, resources=null;
const $=s=>document.querySelector(s);
const titles={chat:'Academic mentor',plan:'My bridge plan',profile:'Academic profile',progress:'My progress'};
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function icon(d){const e=document.createElementNS('http://www.w3.org/2000/svg','svg');e.setAttribute('viewBox','0 0 24 24');e.setAttribute('fill','none');e.setAttribute('stroke','currentColor');e.setAttribute('stroke-width','1.5');e.setAttribute('aria-hidden','true');const p=document.createElementNS(e.namespaceURI,'path');p.setAttribute('d',d);e.append(p);return e;}
function button(label,cls,fn){const e=node('button',cls,label);e.type='button';e.addEventListener('click',fn);return e;}
function error(message){$('#error-text').textContent=message;$('#error').hidden=false;const dialog=document.querySelector('dialog[open]');if(dialog){let p=dialog.querySelector('.dialog-error');if(!p){p=node('p','review-note dialog-error');p.setAttribute('role','alert');dialog.append(p);}p.textContent=message;}}
function clearError(){$('#error').hidden=true;document.querySelectorAll('.dialog-error').forEach(e=>e.remove());}
async function api(url,data,method){
  const options={method:method||(data?'POST':'GET'),credentials:'same-origin'};
  if(data instanceof FormData)options.body=data;
  else if(data){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
  const response=await fetch('/api'+url,options);
  let result;try{result=await response.json();}catch{throw new Error('The server returned an unreadable response. Please retry.');}
  if(!response.ok)throw new Error(result.error||'The request failed. Please retry.');
  return result;
}
async function action(fn,label='Thinking through your material…'){
  if(busy)return;
  clearError();busy=true;setBusy(label);
  try{await fn();}catch(e){error(e.message||'Could not reach the server. Please retry.');}
  finally{busy=false;setBusy();}
}
function setBusy(label){
  document.querySelectorAll('button').forEach(b=>{if(!b.classList.contains('close-dialog')&&!b.matches('#dismiss-error,#mobile-menu'))b.disabled=busy;});
  $('#message').disabled=busy||!canChat();
  $('#send').disabled=busy||!canChat();
  let status=$('#busy-status');
  if(busy){if(!status){status=node('div','busy-status');status.id='busy-status';status.setAttribute('role','status');$('#conversation').append(status);}status.replaceChildren(node('span','loading-dot'),document.createTextNode(label));status.scrollIntoView({block:'nearest'});$('#upload-submit').textContent=session?.state==='DOCUMENT_ANALYSIS'?'Reading your PDF…':'Working…';}
  else{status?.remove();$('#upload-submit').textContent='Explore my course →';}
}
function canChat(){return session&&['INTERVIEW','BRIDGE_PLAN','GUIDED_LEARNING'].includes(session.state);}
function accept(result){if(result.session){session=result.session;render();}return result;}
function switchView(view){currentView=view;document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==view+'-view');document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));$('#view-title').textContent=titles[view];$('#sidebar').classList.remove('open');$('#mobile-menu').setAttribute('aria-expanded','false');renderView();}
function render(){
  $('#mode-pill').textContent=session.mode==='demo'?'Simulated demo':'OpenRouter connected';$('#mode-pill').classList.toggle('demo',session.mode==='demo');
  if(session.mode!=='demo')$('#mode-pill').textContent='Live AI mode';
  $('#course-name').textContent=session.analysis?.title||'A new beginning';
  $('#course-meta').textContent=session.document?`${session.document.name} · ${session.document.page_count} pages`:'Upload your material to begin.';
  const stage=session.state==='UPLOAD'?0:session.state==='INTERVIEW'?1:session.state==='PROFILE_CONFIRMATION'?2:3;
  document.querySelectorAll('#journey-steps li').forEach((e,i)=>{e.classList.toggle('current',i===stage);e.classList.toggle('done',i<stage);});
  renderConversation();renderView();
  $('#interview-controls').hidden=session.state!=='INTERVIEW';
  const count=session.profile.interview_answers.length;
  $('#interview-label').textContent=`Getting to know you · ${count} answered · usually 4–7`;
  $('#interview-fill').style.width=Math.min(100,count/7*100)+'%';
  $('#learning-tools').hidden=!session.document;
  $('#start-diagnostic').hidden=!['BRIDGE_PLAN','GUIDED_LEARNING'].includes(session.state);
  $('#message').placeholder=session.state==='UPLOAD'?'Upload your course material to begin…':session.state==='PROFILE_CONFIRMATION'?'Confirm or edit your profile above to continue…':session.state==='INTERVIEW'?'Share what you know — uncertainty is welcome…':session.diagnostic?'Explain your reasoning…':'Ask a question about your material…';
  $('#composer-note').textContent=session.mode==='demo'?'Simulated demo · No external AI calls · Diagnostic answers are not graded':'AI can make mistakes. Check citations and mathematical notation against your PDF.';
  setBusy(busy?'Working on your next step…':undefined);
}
function welcome(){
  const el=node('div','welcome');
  // Static, developer-authored markup only. All user/model text uses textContent.
  el.innerHTML='<div class="hero-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18v-4a8 8 0 0 1 8-8h7M14 2l5 4-5 4M4 20h16"/></svg></div><div class="eyebrow">A LITTLE GUIDANCE FOR A BIG TRANSITION</div><h1>Your next chapter.<br><em>Let’s build the bridge.</em></h1><p>Moving into master’s-level study is a different way of thinking. You don’t have to figure it all out on your own.</p><div class="pillars"><span>Stronger foundations</span><span>Clearer academic language</span><span>Independent thinking</span></div>';
  const upload=button('','upload-card',()=>$('#upload-dialog').showModal());
  const uploadIcon=node('span','upload-icon');uploadIcon.append(icon('M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5'));upload.append(uploadIcon);const label=node('div');label.append(node('strong','','Start with your course material'),node('small','','Upload a syllabus, lecture notes, or research paper'));upload.append(label,node('span','arrow','→'));el.append(upload,node('p','privacy','Your course first. Your background next. A plan that fits you.'));
  const intro=node('div','intro-card');intro.append(node('span','avatar','rb'),node('p','','Hi, I’m your academic mentor. Share what you’re preparing for, and I’ll get to know your background before we build your personalized bridge plan.'));el.append(intro);return el;
}
function citations(sources){const wrap=node('div','citations');(sources||[]).forEach(s=>wrap.append(button(`PDF · p. ${s.page}`,'citation',()=>openSource(s))));return wrap;}
function renderConversation(){
  const container=$('#conversation');const atBottom=container.scrollHeight-container.scrollTop-container.clientHeight<120;
  container.replaceChildren();
  if(!session.document){container.append(welcome());return;}
  if(session.mode==='demo')container.append(node('div','demo-notice','SIMULATED DEMO · PDF extraction is real. Interview guidance and plans are local simulations; no model is connected.'));
  for(const m of session.messages){const row=node('article','message '+(m.role==='student'?'student':'assistant'));row.append(node('span','avatar '+(m.role==='student'?'student-avatar':''),m.role==='student'?'Y':'rb'));const body=node('div','message-content');const label=node('div','message-label',m.role==='student'?'You':'ResearchBridge');const time=node('time','',new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));label.append(time);body.append(label,node('div','message-text',m.text));if(m.sources?.length)body.append(citations(m.sources));row.append(body);container.append(row);}
  if(session.state==='PROFILE_CONFIRMATION')container.append(profileSummary());
  if(['BRIDGE_PLAN','GUIDED_LEARNING'].includes(session.state)){
    const card=node('div','profile-summary');card.append(node('h3','','Your bridge is ready.'),node('p','secondary',session.profile.generated_plan.title));const controls=node('div','actions');controls.append(button('Open my bridge plan →','primary',()=>switchView('plan')),button('View progress','secondary-button',()=>switchView('progress')));card.append(controls);container.append(card);
  }
  if(atBottom||session.state==='PROFILE_CONFIRMATION')container.scrollTop=container.scrollHeight;
}
function summaryField(parent,label,values){const box=node('div');box.append(node('h4','',label));const list=node('ul');(Array.isArray(values)?values:[values]).forEach(v=>list.append(node('li','',v||'Not yet specified')));if(!list.children.length)list.append(node('li','','Not yet established'));box.append(list);parent.append(box);}
function profileSummary(){
  const p=session.profile;const wrap=node('div','profile-summary');wrap.append(node('h3','','Your academic profile'));const grid=node('div','profile-grid');summaryField(grid,'Bachelor’s major',p.bachelor_major);summaryField(grid,'Target course',p.target_course);summaryField(grid,'Previously studied',p.previous_courses);summaryField(grid,'Potential gaps · provisional',p.potential_knowledge_gaps);summaryField(grid,'Learning preferences',p.learning_preferences);summaryField(grid,'Still uncertain',p.uncertainties);wrap.append(grid,node('p','fine','Potential gaps are hypotheses, not judgments. Confirm or edit them before creating your plan.'));
  const controls=node('div','actions');controls.append(button('Generate My Bridge Plan →','primary',()=>action(async()=>{accept(await api('/plan',{}));resources=null;switchView('plan');},'Building your personalized seven-day bridge…')),button('Edit My Background','secondary-button',()=>switchView('profile')));wrap.append(controls);return wrap;
}
function empty(title,message){const wrap=node('div','empty-state');wrap.append(node('h2','',title),node('p','',message),button('Back to my mentor →','secondary-button',()=>switchView('chat')));return wrap;}
function renderView(){if(!session)return;if(currentView==='plan')renderPlan();if(currentView==='profile')renderProfile();if(currentView==='progress')renderProgress();}
function sectionItems(root,title,items){root.append(node('h2','section-title',title));for(const item of items){const card=node('div','card');card.append(node('h3','',item.topic),node('p','',item.objective),node('p','',item.why),citations(item.sources));root.append(card);}}
function renderPlan(){
  const root=$('#plan-view');root.replaceChildren();const p=session.profile.generated_plan;
  if(!p){root.append(empty('A plan built around you.','First, share your course and complete or skip the interview.'));return;}
  root.append(node('div','eyebrow','YOUR PERSONALIZED ACADEMIC BRIDGE'),node('h1','page-heading',p.title),node('p','secondary',p.overview));
  if(session.mode==='demo')root.append(node('div','demo-notice','SIMULATED PLAN · Based on extracted keywords and your answers. Connect OpenRouter for AI-generated, course-specific guidance.'));
  if(session.state==='PROFILE_CONFIRMATION'||session.state==='INTERVIEW')root.append(node('p','review-note','This is your previous plan. Finish confirming your updated profile to replace it.'));
  if(p.assumptions.length){const a=node('div','assumptions');a.append(node('strong','','Assumptions & open questions'));const ul=node('ul');p.assumptions.forEach(t=>ul.append(node('li','',t)));a.append(ul);root.append(a);}
  sectionItems(root,'01 / Knowledge foundations',p.knowledge_foundations);sectionItems(root,'02 / Academic language',p.academic_language);sectionItems(root,'03 / Research reasoning',p.research_reasoning);
  root.append(node('h2','section-title','04 / Your seven-day bridge'));
  const done=session.profile.completed_activities.length;root.append(node('p','fine',`${done} of 7 activities completed · Small, consistent steps count.`));const bar=node('div','progress-bar');const fill=node('div');fill.style.width=done/7*100+'%';bar.append(fill);root.append(bar);
  if(p.adaptation)root.append(node('p','adaptation',p.adaptation));
  if(session.diagnostic){const prompt=node('div','adaptation');prompt.append(node('p','','Your mentor has a short reasoning check ready in the conversation.'),button('Answer the readiness check →','secondary-button',()=>switchView('chat')));root.append(prompt);}
  for(const day of p.days){const card=node('article','card day-card'+(session.profile.completed_activities.includes(day.id)?' completed':''));const check=node('input');check.type='checkbox';check.checked=session.profile.completed_activities.includes(day.id);check.setAttribute('aria-label',`Complete day ${day.day}: ${day.topic}`);check.disabled=!['BRIDGE_PLAN','GUIDED_LEARNING'].includes(session.state);check.addEventListener('change',()=>action(async()=>{try{accept(await api('/progress',{id:day.id,completed:check.checked}));}catch(e){check.checked=!check.checked;throw e;}}));const body=node('div');body.append(node('div','day-number',`Day ${day.day}`),node('h3','',day.topic),node('p','',day.objective),node('div','day-meta',`${day.duration_minutes} min · ${day.importance}`),citations(day.sources));card.append(check,body);root.append(card);}
  root.append(node('h2','section-title','A little help along the way'));
  root.append(node('p','fine','Curated topic searches. Relevance is a local match estimate against course topics and your gaps, not a YouTube score. Direct playlists are omitted until independently verified.'));
  root.append(button('Find YouTube resources ↗','secondary-button',()=>action(async()=>{const result=await api('/resources');resources=result.resources;renderPlan();},'Matching educational resources…')));
  if(resources)for(const r of resources){const link=node('a','card resource');link.href=r.url;link.target='_blank';link.rel='noopener noreferrer';const heading=node('h3','',r.title);if(r.relevance!==null)heading.append(node('span','score',r.relevance+'% match'));link.append(heading,node('small','',`${r.kind} · ${r.topic}`),node('p','',r.why),node('small','','Open YouTube search ↗'));root.append(link);}
  const controls=node('div','actions');controls.style.marginTop='25px';controls.append(button('Try a readiness check','primary',()=>startDiagnostic()),button('Review profile & regenerate','secondary-button',()=>action(async()=>{accept(await api('/plan/regenerate',{}));switchView('chat');})));root.append(controls);
}
function formField(form,name,label,value,multiline=false,hint){const id='profile-'+name;const lab=node('label','',label);lab.htmlFor=id;const field=node(multiline?'textarea':'input');field.id=id;field.name=name;field.value=value;field.maxLength=multiline?2500:200;if(multiline)field.rows=2;form.append(lab);if(hint)form.append(node('p','fine',hint));form.append(field);return field;}
function renderProfile(){
  const root=$('#profile-view');root.replaceChildren();if(!session.analysis){root.append(empty('Your story matters.','Upload your course material first, then we’ll explore your background.'));return;}
  const p=session.profile;root.append(node('div','eyebrow','THE PERSON BEHIND THE PLAN'),node('h1','page-heading','Your academic profile'),node('p','secondary','Your background is a starting point, not a limit. You can update it at any time.'));
  const form=node('form','profile-form card');formField(form,'bachelor_major','Bachelor’s degree / major',p.bachelor_major);formField(form,'previous_courses','Previously studied courses',p.previous_courses.join('\n'),true,'One course per line. Prior study does not automatically establish mastery.');formField(form,'learning_preferences','Learning preferences & time available',p.learning_preferences.join('\n'),true);formField(form,'potential_knowledge_gaps','Potential gaps to investigate',p.potential_knowledge_gaps.join('\n'),true,'One topic per line. These are provisional; you can correct them.');const submit=node('button','primary','Save & review my profile →');submit.type='submit';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);const lines=name=>String(fd.get(name)).split('\n').map(s=>s.trim()).filter(Boolean);action(async()=>{accept(await api('/profile',{bachelor_major:fd.get('bachelor_major'),previous_courses:lines('previous_courses'),learning_preferences:lines('learning_preferences'),potential_knowledge_gaps:lines('potential_knowledge_gaps')}));switchView('chat');});});root.append(form);
  const confidence=node('div','card');confidence.append(node('h3','','Confidence & evidence are different'));for(const [topic,level]of Object.entries(p.self_reported_confidence))confidence.append(node('p','',`${topic} · self-reported confidence: ${level}`));for(const [topic,evidence]of Object.entries(p.demonstrated_knowledge)){confidence.append(node('p','',`${topic} · demonstrated understanding: ${evidence.level}`),node('p','fine',evidence.evidence));}if(!Object.keys(p.self_reported_confidence).length&&!Object.keys(p.demonstrated_knowledge).length)confidence.append(node('p','','Not assessed yet. A degree title alone never determines what you know.'));root.append(confidence);
  root.append(node('h2','section-title','Your interview history'));
  p.interview_answers.forEach(a=>{const card=node('div','card');card.append(node('h3','',a.question),node('p','',a.skipped?'Skipped — remains uncertain':a.answer),node('p','fine',a.feedback));root.append(card);});
  root.append(button('Revisit the interview','secondary-button',()=>action(async()=>{accept(await api('/interview/restart',{}));switchView('chat');})));
}
function renderProgress(){
  const root=$('#progress-view');root.replaceChildren();const p=session.profile;
  root.append(node('div','eyebrow','SMALL STEPS, STRONGER FOUNDATIONS'),node('h1','page-heading','Look how far you’re going.'),node('p','secondary','Completion tracks your effort. Readiness checks give evidence about your reasoning.'));
  const stats=node('div','stats');const assessed=p.diagnostic_results.filter(d=>!d.simulated&&typeof d.accuracy==='number');
  [['Activities completed',p.completed_activities.length+'/7'],['Live checks assessed',assessed.length],['Topics strengthened',Object.values(p.demonstrated_knowledge).filter(t=>t.level==='strong').length]].forEach(([label,value])=>{const stat=node('div','stat');stat.append(node('strong','',String(value)),node('span','',label));stats.append(stat);});root.append(stats);
  if(!p.diagnostic_results.length)root.append(empty('Room to grow, space to try.','Your first readiness check will appear here after you create a plan.'));
  else{root.append(node('h2','section-title','Your reasoning, over time'));for(const d of [...p.diagnostic_results].reverse()){const card=node('article','card');card.append(node('span','tag',d.simulated?'SIMULATED · UNGRADED':d.kind==='interview'?'INTERVIEW EVIDENCE':'LIVE READINESS CHECK'),node('h3','',d.topic),node('p','',d.question||'Interview diagnostic'),node('p','',`Your answer: ${d.answer}`),node('p','',d.feedback));if(!d.simulated&&d.accuracy!==undefined)card.append(node('p','fine',`Accuracy ${d.accuracy}/4 · Assumptions ${d.assumptions}/4 · Explanation ${d.explanation}/4 · Independent reasoning ${d.independence}/4`));if(d.next_step)card.append(node('p','',`Next step: ${d.next_step}`));card.append(node('p','fine',new Date(d.at).toLocaleString()));root.append(card);}}
  if(['BRIDGE_PLAN','GUIDED_LEARNING'].includes(session.state))root.append(button('Try a readiness check →','primary',()=>startDiagnostic()));
}
async function openSource(source){await action(async()=>{const result=await api('/document/page/'+source.page);$('#source-title').textContent=`${session.document.name} · page ${source.page}`;const root=$('#source-content');root.replaceChildren();const text=result.page.text;const index=text.indexOf(source.quote);if(index>=0)root.append(document.createTextNode(text.slice(0,index)),node('mark','',source.quote),document.createTextNode(text.slice(index+source.quote.length)));else root.textContent=text;$('#source-dialog').showModal();},'Opening the original source…');}
function startDiagnostic(){action(async()=>{accept(await api('/diagnostic',{}));switchView('chat');$('#message').focus();},'Preparing a course-specific reasoning question…');}
$('#chat-form').addEventListener('submit',e=>{e.preventDefault();const message=$('#message').value.trim();if(!message||!canChat())return;action(async()=>{const result=session.state==='INTERVIEW'?await api('/interview',{answer:message}):await api(session.diagnostic?'/diagnostic/answer':'/chat',{message});$('#message').value='';$('#message').style.height='auto';accept(result);$('#conversation').scrollTop=$('#conversation').scrollHeight;});});
$('#message').addEventListener('input',()=>{const e=$('#message');e.style.height='auto';e.style.height=Math.min(e.scrollHeight,130)+'px';});
$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#chat-form').requestSubmit();}});
$('#skip-question').addEventListener('click',()=>action(async()=>accept(await api('/interview',{skip:true})), 'Noting what remains uncertain…'));
$('#finish-interview').addEventListener('click',()=>action(async()=>accept(await api('/interview/finish',{}))));
$('#new-upload').addEventListener('click',()=>$('#upload-dialog').showModal());
$('#pdf-file').addEventListener('change',e=>{selectedFile=e.target.files[0]||null;$('#file-label').textContent=selectedFile?.name||'Choose a PDF or drop it here';});
const drop=$('#dropzone');['dragenter','dragover'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add('dragging');}));['dragleave','drop'].forEach(event=>drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove('dragging');}));drop.addEventListener('drop',e=>{const file=e.dataTransfer.files[0];if(file){selectedFile=file;$('#file-label').textContent=file.name;$('#pdf-file').required=false;}});
$('#upload-form').addEventListener('submit',e=>{e.preventDefault();if(!selectedFile)return;if(selectedFile.size>10*1024*1024){error('Please choose a PDF smaller than 10 MB.');return;}action(async()=>{const fd=new FormData();fd.append('pdf',selectedFile);fd.append('consent',String($('#consent').checked));accept(await api('/upload',fd));resources=null;$('#upload-dialog').close();switchView('chat');$('#conversation').scrollTop=$('#conversation').scrollHeight;},'Extracting your PDF and exploring course foundations…');});
$('#open-simplifier').addEventListener('click',()=>{const selected=window.getSelection()?.toString().trim();if(selected)$('#passage').value=selected.slice(0,4000);$('#simplify-dialog').showModal();});
$('#simplify-form').addEventListener('submit',e=>{e.preventDefault();const message=$('#passage').value.trim();if(!message)return;action(async()=>{const result=accept(await api('/simplify',{message}));renderSimplification(result.simplification);},'Unpacking the passage without losing its meaning…');});
function renderSimplification(s){const root=$('#simplification-result');root.replaceChildren();[['Original passage',s.original],['In ordinary language',s.explanation],['A concrete example',s.example],['Back to academic language',s.formal],['Assumptions & qualifications',s.qualifications]].forEach(([title,text])=>{root.append(node('h3','section-title',title),node('p','message-text',text));if(title==='In ordinary language'){root.append(node('h3','section-title','Important terms'));s.terms.forEach(t=>{const p=node('p','secondary');p.append(node('strong','',t.term+': '),document.createTextNode(t.definition));root.append(p);});}});root.append(citations(s.sources));}
$('#start-diagnostic').addEventListener('click',startDiagnostic);
$('#delete-session').addEventListener('click',()=>$('#reset-dialog').showModal());
$('#confirm-reset').addEventListener('click',()=>action(async()=>{accept(await api('/session',null,'DELETE'));resources=null;$('#reset-dialog').close();$('#simplification-result').replaceChildren();$('#passage').value='';$('#message').value='';$('#upload-form').reset();selectedFile=null;$('#file-label').textContent='Choose a PDF or drop it here';$('#pdf-file').required=true;switchView('chat');}));
document.querySelectorAll('[data-view]').forEach(e=>e.addEventListener('click',()=>switchView(e.dataset.view)));
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>{b.closest('dialog').close();clearError();}));
$('#dismiss-error').addEventListener('click',clearError);
$('#mobile-menu').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#mobile-menu').setAttribute('aria-expanded',String(open));});
document.querySelector('main').addEventListener('click',e=>{if(!e.target.closest('#mobile-menu')){$('#sidebar').classList.remove('open');$('#mobile-menu').setAttribute('aria-expanded','false');}});
await action(async()=>{accept(await api('/session'));if(session.last_simplification)renderSimplification(session.last_simplification);},'Restoring your learning journey…');
