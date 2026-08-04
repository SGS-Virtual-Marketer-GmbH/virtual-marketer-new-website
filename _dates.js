const fs=require('fs');
const FILES=['blog-posts.json','blog-posts-2024.json','blog-posts-2025.json','blog-posts-2026.json'];
const load=f=>{const d=JSON.parse(fs.readFileSync(f,'utf8'));return Array.isArray(d)?d:d.posts;};
let all=[];for(const f of FILES) for(const p of load(f)) all.push({...p,src:f});
all.sort((a,b)=>a.date.localeCompare(b.date));
const TODAY='2026-08-04';
const future=all.filter(p=>p.date>TODAY);
console.log('total',all.length,'| future-dated (>'+TODAY+'):',future.length);
future.forEach(p=>console.log('  ',p.date,p.slug,'['+p.src+']'));
// monthly counts
const by={};all.forEach(p=>{const m=p.date.slice(0,7);by[m]=(by[m]||0)+1});
console.log('\nper month:');
const keys=Object.keys(by).sort();
let line='';keys.forEach(k=>{line+=k+':'+by[k]+'  ';});
console.log(' ',line);
// gaps in 2026 up to today
const m2026=keys.filter(k=>k.startsWith('2026')&&k<='2026-08');
console.log('\n2026 (bis heute) months covered:',m2026.length,'posts:',m2026.reduce((s,k)=>s+by[k],0));
