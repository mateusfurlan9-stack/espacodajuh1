import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Vercel serves the public frontend. The live Sites Worker owns DB and admin.
fs.rmSync('dist', {recursive:true, force:true});
fs.cpSync('public', 'dist', {recursive:true});
for (const file of ['admin.html','admin.js','admin.css','denied.html']) {
  fs.rmSync(path.join('dist',file), {force:true});
}
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace(/(src|href)="(\/?(?:style\.css|app\.js))"/g, (_,attr,url)=>{
  const hash=createHash('sha256').update(fs.readFileSync(path.join('dist',url))).digest('hex').slice(0,12);
  return `${attr}="${url}?v=${hash}"`;
});
fs.writeFileSync('dist/index.html',html);
console.log('Frontend Vercel preparado; API e painel usam o servidor compartilhado.');
