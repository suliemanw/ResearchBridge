// Deterministic, transparent simulations for an offline hackathon demonstration.
// These are not model responses and never establish real diagnostic mastery.
export function demoAnalysis(doc) {
  const candidates=[['Distributed systems',/distributed|consensus|lamport|replicat/i],['Event ordering',/causal|lamport|logical clock|happens.before/i],['Computer networks',/network|packet|protocol|message/i],['Formal reasoning',/proof|theorem|induction|lemma|logic/i],['Algorithms',/algorithm|complexity|sort|graph/i],['Probability',/probab|random|stochastic/i],['Linear algebra',/matrix|vector|eigen/i],['Machine learning',/learning|neural|regression/i]];
  const topics=candidates.flatMap(([name,re])=>{
    const p=doc.pages.find(p=>re.test(p.text));
    return p?[{name,reason:`This topic occurs in the uploaded material. In demo mode, its relevance is estimated by keyword matching.`,sources:[{page:p.page,quote:p.text.slice(0,180)}]}]:[];
  });
  if (!topics.length) topics.push({name:'Course concepts',reason:'Demo mode found no specialized topic keywords. Review the cited passage to name the course accurately.',sources:[{page:doc.pages.find(p=>p.text.length).page,quote:doc.pages.find(p=>p.text.length).text.slice(0,180)}]});
  return {title:topics[0].name,topics,prerequisites:topics.slice(0,5).map(t=>({...t,name:t.name==='Formal reasoning'?'Proof techniques':t.name,reason:`Provisional foundation to check before studying ${t.name.toLowerCase()}; this is a demo inference, not a confirmed gap.`})),mathematical_requirements:topics.filter(t=>/reasoning|algebra|Probability/.test(t.name)).map(t=>t.name),academic_terms:topics.map(t=>t.name),research_demands:['Identify assumptions in a claim','Explain a limitation using the cited material']};
}
export function demoQuestion(s) {
  const n=s.profile.interview_answers.length;
  const topic=s.analysis.topics.find(t=>/ordering|reasoning/.test(t.name)) || s.analysis.topics[0];
  const major=s.profile.bachelor_major || 'your previous studies';
  const prior=s.profile.previous_courses.join(', ');
  const questions=[
    {kind:'background',question:"What was your bachelor's degree major?",topic:'Academic background'},
    {kind:'experience',question:`In ${major}, did you encounter ${topic.name.toLowerCase()} or related courses? Tell me what you studied.`,topic:topic.name},
    {kind:'confidence',question:`${prior?`You mentioned ${prior}. `:''}How confident do you feel explaining ${topic.name.toLowerCase()}, including the assumptions behind it?`,topic:topic.name},
    {kind:'diagnostic',question:topic.name==='Event ordering'?'Try a short reasoning question: if process A sends a message to B, what relationship exists between the send and receive events? Explain why.':`Let's reason from your material: “${topic.sources[0].quote.slice(0,150)}”. What assumption might this passage rely on, and what could change if it did not hold?`,topic:topic.name},
    {kind:'preferences',question:'What helps you learn unfamiliar ideas, and how much preparation time can you realistically spend each day?',topic:'Learning preferences'}
  ];
  return {...questions[Math.min(n,4)],sources:n>0&&n<4?topic.sources:[]};
}
export function demoInterview(s,answer,skipped) {
  const p=structuredClone(s.profile); const q=s.question;
  const count=p.interview_answers.length;
  if (!skipped) {
    if(q.kind==='background') p.bachelor_major=answer.slice(0,200);
    if(q.kind==='experience') {
      p.previous_courses=[answer];
      const positive=answer.split(/\bbut\b|[.;]/i).filter(a=>! /\b(no|never|not|unfamiliar)\b/i.test(a)).join(' ');
      const names=[...s.analysis.topics,...s.analysis.prerequisites].map(t=>t.name);
      p.studied_topics=[...new Set(names.filter(name=>positive.toLowerCase().includes(name.toLowerCase())))];
    }
    if(q.kind==='confidence') p.self_reported_confidence[q.topic]=/struggle|low|not|uncomfortable|weak/i.test(answer)?'low':/confident|comfortable|strong/i.test(answer)?'high':'unknown';
    if(q.kind==='diagnostic') p.demonstrated_knowledge[q.topic]={level:'unassessed',evidence:'Demo response saved; no AI assessment has been performed.'};
    if(q.kind==='preferences') p.learning_preferences=[answer];
  }
  p.potential_knowledge_gaps=s.analysis.prerequisites.map(t=>t.name).filter(t=>!p.studied_topics.includes(t)||p.self_reported_confidence[t]==='low');
  p.uncertainties=[...new Set([...p.uncertainties,...(skipped?[`Skipped: ${q.topic}`]:[]),'Demo mode: all knowledge estimates need confirmation.'])];
  const next=structuredClone(s);next.profile=p;next.profile.interview_answers.push({});
  const modelProfile={...p,self_reported_confidence:Object.entries(p.self_reported_confidence).map(([topic,confidence])=>({topic,confidence})),demonstrated_knowledge:Object.entries(p.demonstrated_knowledge).map(([topic,evidence])=>({topic,...evidence}))};
  return {profile:modelProfile,feedback:skipped?'We can leave that uncertain and make a provisional plan.':q.kind==='diagnostic'?'Your reasoning has been saved. Demo mode cannot assess its correctness; a live AI assessment is needed.':'Thanks — I’ll use that to shape the next step.',sufficient:count+1>=5,next_question:demoQuestion(next)};
}
export function demoPlan(s) {
  const p=s.profile;
  const gaps=p.potential_knowledge_gaps;
  const low=Object.values(p.self_reported_confidence).includes('low');
  const foundations=(gaps.length?s.analysis.prerequisites.filter(t=>gaps.includes(t.name)):s.analysis.prerequisites.slice(-1));
  const selected=foundations.length?foundations:s.analysis.prerequisites.slice(0,1);
  const item=t=>({topic:t.name,objective:`Explain ${t.name.toLowerCase()} in your own words and work through one example.`,why:`Connect this foundation to the cited course passage. ${p.studied_topics.includes(t.name)?'Build on your reported prior study.':'Prior knowledge remains provisional.'}`,sources:t.sources});
  const topic=s.analysis.topics[0];
  const extension=gaps.length===0&&!low;
  const verbs=extension?['Explain assumptions','Construct a counterexample','Compare approaches','Critique a claim','Defend an argument','Design an extension','Reflect and test']:['Review foundations','Work a concrete example','Read a passage closely','Map its assumptions','Try guided reasoning','Explain without notes','Review and self-assess'];
  return {title:`Your bridge to ${s.analysis.title}`,overview:`A simulated first plan for ${p.bachelor_major||'an unspecified background'}. ${extension?'Your reported experience allows more emphasis on research reasoning.':'Start with the foundations you reported as uncertain.'} Preferences: ${p.learning_preferences.join('; ')||'not yet specified'}.`,assumptions:[...p.uncertainties,...(!p.bachelor_major?['Bachelor’s major was not provided.']:[])],knowledge_foundations:selected.map(item),academic_language:[{topic:`Reading ${topic.name.toLowerCase()}`,objective:'Identify a term, rewrite its definition, and reconstruct the formal statement.',why:'Practice returning from plain language to the original terminology.',sources:topic.sources}],research_reasoning:[{topic:`Questioning ${topic.name.toLowerCase()}`,objective:'Find an assumption and describe a case in which it would fail.',why:'Move from recalling information to evaluating a claim.',sources:topic.sources}],days:Array.from({length:7},(_,i)=>{
    const t=i<3&&!extension?selected[i%selected.length]:s.analysis.topics[i%s.analysis.topics.length];
    return {day:i+1,topic:`${verbs[i]}: ${t.name}`,objective:`${verbs[i]} using the cited passage. ${i===0?`Connect it to ${p.bachelor_major||'your previous studies'}.`:''}`,duration_minutes:low?25:extension?45:30,importance:i<3?'essential':i===6?'stretch':'recommended',sources:t.sources};
  })};
}
