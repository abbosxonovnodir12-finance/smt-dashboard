// Barcha testlarni ishga tushiradi:  node tests/run.js
const {spawnSync}=require('child_process'),fs=require('fs'),path=require('path');
let bad=0; fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort().forEach(f=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,f)],{encoding:'utf8'}); const out=(r.stdout||'')+(r.stderr||'');
  const pass=(out.match(/^✓/gm)||[]).length, fail=(out.match(/^✗/gm)||[]).length;
  console.log((r.status===0?'✓':'✗')+' '+f+' — '+pass+' o\'tdi'+(fail?', '+fail+' yiqildi':'')+(r.status!==0&&!fail?' (xato bilan to\'xtadi)':''));
  if(r.status!==0){bad++; console.log(out.split('\n').filter(l=>l.startsWith('✗')||/Error/.test(l)).slice(0,8).join('\n'));}
});
console.log(bad?'\n'+bad+' ta fayl yiqildi':'\nHAMMASI O\'TDI'); process.exit(bad?1:0);
