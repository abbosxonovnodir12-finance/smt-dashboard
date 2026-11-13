// Kunlik diagramma: uzun ro'yxat kesilmaydi, QuickChart xatosida matn
const fs=require('fs'),vm=require('vm'); const src=fs.readFileSync(require('path').join(__dirname,'..','zp_bot.gs'),'utf8');
let fails=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c)fails++};
const cache={}; const calls=[]; let qcFail=false;
global.CacheService={getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove(){}})};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>({BOT_TOKEN:'t',ADMIN_ID:'999'}[k]||null)})};
global.Utilities={sleep(){},formatDate:()=>''};global.LockService={};global.Logger={log(){}};global.HtmlService={};global.Session={getScriptTimeZone:()=>''};global.SpreadsheetApp={};
global.UrlFetchApp={fetch:(url,o)=>{if(url.includes('quickchart')){calls.push({m:'quickchart',body:JSON.parse(o.payload)});return qcFail?{getResponseCode:()=>500,getContentText:()=>'err'}:{getResponseCode:()=>200,getBlob:()=>({getContentType:()=>'image/png',setName:n=>'PNG:'+n})}}
  const p=o.contentType?JSON.parse(o.payload):o.payload;calls.push({m:url.split('/').pop(),p});return{getResponseCode:()=>200,getContentText:()=>'{"ok":true}'}}};
vm.runInThisContext(src);
const mk=n=>({date:[2026,10,13],filled:true,total:{n:n+10,w:10,a:n,u:0},sections:[{name:'SMT <цех>',n:n+10,w:10,a:n,u:0,people:Array.from({length:n},(_,i)=>({fio:'Xodim Familiyasi Ismi '+i,k:'a'}))}]});
let D=mk(2); dailyData=()=>D; buildDailyReport=()=>'TEXT';
calls.length=0; sendDaily('5','uz',0,{keyboard:[['x']]}); let ph=calls.find(c=>c.m==='sendPhoto');
ok(ph&&ph.p.caption.includes('Xodim Familiyasi Ismi 1')&&ph.p.caption.includes('SMT &lt;цех&gt;')&&ph.p.reply_markup&&!calls.some(c=>c.m==='sendMessage'),'Qisqa ro\'yxat: rasm + izoh (HTML belgilar himoyalangan)');
ok(!JSON.stringify(calls.find(c=>c.m==='quickchart').body).includes('function'),'Diagramma konfiguratsiyasi toza JSON');
D=mk(60); calls.length=0; sendDaily('5','uz',0,{keyboard:[['x']]}); ph=calls.find(c=>c.m==='sendPhoto'); const tx=calls.filter(c=>c.m==='sendMessage');
ok(ph&&!ph.p.caption&&tx.length>=1&&tx.map(c=>c.p.text).join('\n').includes('Xodim Familiyasi Ismi 59')&&tx[tx.length-1].p.reply_markup,'60 kishi: rasm izohsiz, to\'liq ro\'yxat alohida xabarda (hech kim tushib qolmadi)');
qcFail=true; calls.length=0; sendDaily('5','uz',0,null); ok(calls.some(c=>c.m==='sendMessage'&&c.p.text==='TEXT')&&calls.some(c=>c.p&&String(c.p.chat_id)==='999'&&c.p.text.includes('Diagramma chizilmadi')),'QuickChart xatosi → matn + adminga sabab');
console.log(fails?`\n${fails} ta test YIQILDI`:'\nKunlik diagramma: barcha testlar o\'tdi'); process.exit(fails?1:0);
