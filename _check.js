const fs=require('fs');
const FILES=['blog-posts.json','blog-posts-2024.json','blog-posts-2025.json','blog-posts-2026.json'];
const load=f=>{const d=JSON.parse(fs.readFileSync(f,'utf8'));return Array.isArray(d)?d:d.posts;};
let miss=[],dup={},used=new Set(),cats={};
for(const f of FILES) for(const p of load(f)){
  (dup[p.slug]=dup[p.slug]||[]).push(f);
  used.add(p.contentFile);
  cats[p.category]=(cats[p.category]||0)+1;
  if(!fs.existsSync('content/blog/'+p.contentFile)) miss.push(f+' → '+p.contentFile);
}
console.log('unique slugs:',Object.keys(dup).length);
console.log('missing content:',miss.length); miss.slice(0,10).forEach(m=>console.log('  ',m));
const d=Object.entries(dup).filter(([,v])=>v.length>1);
console.log('duplicate slugs:',d.length); d.forEach(([k,v])=>console.log('  ',k,'|',v.join(' + ')));
const orph=fs.readdirSync('content/blog').filter(f=>f.endsWith('.html')&&!used.has(f));
console.log('orphan content files:',orph.length); orph.forEach(o=>console.log('  ',o));
console.log('categories:',JSON.stringify(cats,null,1));
