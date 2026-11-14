// Curated search metadata, not fabricated playlists or YouTube ratings.
// Direct playlist URLs must be independently verified before being added here.
const resources=[
  {title:'Distributed systems fundamentals',topics:['distributed systems','consensus','computer networks'],query:'distributed systems fundamentals university lectures'},
  {title:'Logical clocks and causal ordering',topics:['event ordering','distributed systems','lamport clocks'],query:'Lamport logical clocks happens before lecture'},
  {title:'Mathematics for computer science',topics:['formal reasoning','proof techniques','discrete mathematics','logic'],query:'MIT OpenCourseWare mathematics for computer science proofs'},
  {title:'Introduction to algorithms',topics:['algorithms','algorithmic reasoning'],query:'MIT OpenCourseWare 6.006 introduction to algorithms'},
  {title:'Linear algebra foundations',topics:['linear algebra','matrix','vector'],query:'MIT OpenCourseWare Gilbert Strang linear algebra'},
  {title:'Probability foundations',topics:['probability','random'],query:'Harvard Stat 110 probability lectures'},
  {title:'Machine learning foundations',topics:['machine learning','regression','neural'],query:'Stanford machine learning foundations lectures'}
];
export function recommendResources(s) {
  const course=s.analysis?.topics.map(t=>t.name.toLowerCase())||[];
  const gaps=s.profile.potential_knowledge_gaps.map(t=>t.toLowerCase());
  const scored=resources.map(r=>{
    const gap=r.topics.filter(t=>gaps.some(g=>g.includes(t)||t.includes(g))).length;
    const match=r.topics.filter(t=>course.some(g=>g.includes(t)||t.includes(g))).length;
    const score=(gap*2+match)/(r.topics.length*3);
    return {title:r.title,topic:r.topics[0],relevance:Math.round(score*100),why:`${gap} gap and ${match} course-topic matches against ${r.topics.length} curated topic tags. This is a local metadata match estimate, not a YouTube rating.`,url:'https://www.youtube.com/results?search_query='+encodeURIComponent(r.query),kind:'YouTube search'};
  }).filter(r=>r.relevance>0).sort((a,b)=>b.relevance-a.relevance);
  return scored.length?scored:[{title:`Explore ${s.analysis?.title||'your course'}`,topic:s.analysis?.title||'Course concepts',relevance:null,why:'No curated topic match is available. Search results need your review.',url:'https://www.youtube.com/results?search_query='+encodeURIComponent(s.analysis?.title||'academic research skills'),kind:'YouTube search'}];
}
