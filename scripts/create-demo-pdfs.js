import PDFDocument from 'pdfkit';
import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
await mkdir('.data/demo',{recursive:true});
const courses={
  'distributed-systems':[
    ['Distributed Systems: a practice excerpt','ResearchBridge demonstration material. This is an authored sample, not university course content.\n\nIn a distributed system, processes communicate by exchanging messages. There is no shared global clock. A send event happens before the corresponding receive event. If event a happens before b, and b happens before c, then a happens before c. Events may also be concurrent: neither event causally precedes the other.'],
    ['Logical clocks and assumptions','Lamport logical clocks attach a counter to each process. Before a local event, increment the counter. A sender includes its counter in a message. On receiving timestamp t, update the local counter to max(local counter, t) + 1.\n\nIf a happens before b, its Lamport timestamp is smaller. The converse does not necessarily hold: smaller timestamps alone do not prove causality. A total order can be constructed by breaking equal timestamp values with unique process identifiers. This order need not represent causality between concurrent events.'],
    ['From foundations to research reasoning','Sets and relations describe the happens-before relation. Discrete mathematics, mathematical logic, and proof techniques help establish its properties. Proof by induction separates a base case from an inductive step. Algorithms should be examined for correctness under explicit assumptions.\n\nResearch exercise: identify the assumptions of a consensus algorithm. Ask whether its claim changes when messages can be delayed indefinitely or processes can fail. A counterexample should satisfy the claimed assumptions while contradicting the claimed conclusion.']
  ],
  'linear-algebra':[
    ['Linear Algebra: a practice excerpt','ResearchBridge demonstration material, not university course content.\n\nA matrix represents a linear transformation. A vector is mapped to another vector. An eigenvector is a nonzero vector whose direction is preserved by the transformation, with scale factor given by an eigenvalue.'],
    ['Regression and uncertainty','Linear regression estimates model parameters from observations. Its conclusions depend on explicit modeling assumptions. Probability describes uncertainty, while linear algebra provides the language of the design matrix. Ask what changes when observations are dependent or the model is misspecified.']
  ]
};
for(const [name,pages]of Object.entries(courses)){
  const doc=new PDFDocument({margin:60});const output=createWriteStream(`.data/demo/${name}.pdf`);doc.pipe(output);
  pages.forEach(([title,content],i)=>{if(i)doc.addPage();doc.fontSize(21).text(title).moveDown();doc.fontSize(12).text(content,{lineGap:6});doc.moveDown().fontSize(9).text(`Sample material · Page ${i+1}`);});
  doc.end();await new Promise((resolve,reject)=>{output.on('finish',resolve);output.on('error',reject);});
  console.log(`Created .data/demo/${name}.pdf`);
}
