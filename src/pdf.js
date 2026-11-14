import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
export async function extractPDF(buffer) {
  if (!buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error('Please upload a valid PDF file.');
  let pdf, task;
  try {
    task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, stopAtErrors: true });
    pdf = await task.promise;
    if (pdf.numPages > 80) throw new Error('Please use a PDF of 80 pages or fewer.');
    const pages = []; let length = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map(i => i.str || '').join(' ').replace(/\s+/g, ' ').trim();
      length += text.length;
      if (length > 300000) throw new Error('This PDF contains too much text. Upload a shorter excerpt.');
      pages.push({ page: n, text });
      page.cleanup();
    }
    if (pages.reduce((n,p) => n+p.text.length,0) < 100) throw new Error('No usable text could be extracted. Scanned PDFs need OCR first.');
    const chunks = pages.flatMap(p => {
      const out = [];
      for (let i=0;i<p.text.length;i+=1000) out.push({page:p.page,text:p.text.slice(i,i+1200)});
      return out;
    });
    return {pages,chunks};
  } catch (e) {
    if (/80 pages|too much text|No usable text/.test(e.message)) throw e;
    throw new Error('The PDF could not be read. Check that it is unencrypted and contains selectable text.');
  } finally { if (task) await task.destroy(); }
}
const words = s => (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
export function retrieve(doc, query, limit=8) {
  const terms = [...new Set(words(query))];
  return doc.chunks.map((c,i)=>({ ...c, score:terms.reduce((n,t)=>n+(c.text.toLowerCase().includes(t)?1:0),0), index:i }))
    .sort((a,b)=>b.score-a.score || a.index-b.index).slice(0,limit).map(({page,text})=>({page,text}));
}
export function overview(doc) {
  // Distribute the analysis context across the whole PDF, rather than only its introduction.
  const count = Math.min(16,doc.chunks.length);
  return Array.from({length:count},(_,i)=>doc.chunks[Math.floor(i*doc.chunks.length/count)]);
}
export function validateSources(value, doc, allowedChunks) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(v=>validateSources(v,doc,allowedChunks)); return; }
  if (Array.isArray(value.sources)) {
    for (const s of value.sources) {
      const page = doc.pages.find(p=>p.page===s.page);
      if (!page || !page.text.includes(s.quote) || (allowedChunks && !allowedChunks.some(c=>c.page===s.page && c.text.includes(s.quote)))) {
        throw new Error('The AI returned a source that could not be verified. Please retry.');
      }
    }
  }
  Object.entries(value).filter(([k])=>k!=='sources').forEach(([,v])=>validateSources(v,doc,allowedChunks));
}
