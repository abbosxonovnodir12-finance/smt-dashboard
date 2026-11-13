const fs=require('fs'),vm=require('vm'); const src=fs.readFileSync(require('path').join(__dirname,'..','zp_bot.gs'),'utf8');
let fails=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c)fails++};
const cache={}; const calls=[]; let qcFail=false;
global.CacheService={getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})};
const props={BOT_TOKEN:'t',ADMIN_ID:'999',TABEL_ID:'x',TABEL_YEAR:String(new Date().getFullYear()),['TABEL_ID_'+(new Date().getFullYear()-1)]:'x'};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]}})};
const trig=[]; global.ScriptApp={getProjectTriggers:()=>[],deleteTrigger(){},newTrigger:f=>({timeBased:()=>({after:()=>({create:()=>trig.push(f+'@after')}),atHour:h=>({everyDays:()=>({create:()=>trig.push(f+'@'+h)})}),onMonthDay:()=>({atHour:()=>({create:()=>trig.push(f)})}),everyMinutes:()=>({create:()=>trig.push(f)})})})};
global.Utilities={sleep(){},formatDate:(d)=>('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear()};global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}}),getDocumentLock:()=>({waitLock(){},releaseLock(){}})};global.Logger={log(){}};global.HtmlService={};global.Session={getScriptTimeZone:()=>''};
global.UrlFetchApp={fetch:(url,o)=>{
  if(url.includes('quickchart')){calls.push({m:'quickchart',body:JSON.parse(o.payload)}); if(qcFail)return{getResponseCode:()=>500,getContentText:()=>'err'}; return{getResponseCode:()=>200,getBlob:()=>({getContentType:()=>'image/png',setName:n=>'PNG:'+n})}}
  const isMp=!o.contentType; const p=isMp?o.payload:JSON.parse(o.payload); calls.push({m:url.split('/').pop(),p}); return{getResponseCode:()=>200,getContentText:()=>'{"ok":true}'}}};
const today=new Date(); const Y=today.getFullYear(), M=today.getMonth(), D=today.getDate();
const prev=new Date(Y,M-1,1); const pm=prev.getMonth(), pnd=new Date(prev.getFullYear(),pm+1,0).getDate();
const RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const mkSheet=(nd,rows)=>{const W=3+nd*2+4;const hdr=new Array(W).fill('');hdr[1]='Ф.И.О';const sec=new Array(W).fill('');sec[1]='SMT цех';
  const R=[hdr,sec].concat(rows.map(([fio,marks])=>{const r=new Array(W).fill('');r[1]=fio;marks.forEach((m,i)=>r[3+i*2]=m);return r}));
  return{getLastRow:()=>R.length,getLastColumn:()=>W,getRange:(a,b,c,w)=>({getValues:()=>R.map(x=>x.slice(0,w))})}};
const prevSheet=mkSheet(pnd,[["Karimov Jasur",Array(pnd).fill('+')],["Valiyev Vali",Array(pnd).fill('')]]);           // Valiyev: bo'sh oy
const curMarks=Array(D).fill('+'); curMarks[D-1]='-'; const curSheet=mkSheet(new Date(Y,M+1,0).getDate(),[["Karimov Jasur",curMarks],["Valiyev Vali",Array(D).fill('+')]]);
global.SpreadsheetApp={openById:()=>({getSheetByName:n=>n===RU[pm]?prevSheet:n===RU[M]?curSheet:null,getSheets:()=>[]}),
  getActive:()=>({getSheetByName:n=>n==='Telegram'?{getLastRow:()=>3,getRange:()=>({getValues:()=>TG})}:n==='ФИО табель'?{getLastRow:()=>1}:n==='база'?{getLastRow:()=>3,getRange:()=>({getValues:()=>[['1','Karimov Jasur'],['2','Valiyev Vali']]})}:n==='qarz_daftari'?{getLastRow:()=>DEBT.length+1,getRange:()=>({getValues:()=>DEBT})}:n==='Log'?{getLastRow:()=>1,appendRow(){}}:null})};
let TG=[['1','','111','','','K','active','uz','',''],['2','','222','','','V','active','ru','','']];
const fmtD=d=>('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear();
const plus=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return x};
const drow=(p,fio,amt,cur,due,note,rest,st)=>{const r=new Array(28).fill('');r[0]=p;r[1]=fio;r[4]=amt;r[5]=cur;r[6]=amt;r[7]=1;r[8]=fmtD(plus(-30));r[9]=due;r[10]=note;r[11]='Касса';r[12]=0;r[13]=rest;r[14]=st;return r};
let DEBT=[new Array(28).fill(''),drow('1','Karimov Jasur',1000000,'УзСум',fmtD(plus(3)),'Оилавий сабаб',1000000,'Открыто'),drow('2','Valiyev Vali',700,'USD',fmtD(plus(0)),'',700,'Открыто'),drow('1','Karimov Jasur',500000,'УзСум',fmtD(plus(10)),'',500000,'Открыто'),drow('2','Valiyev Vali',300,'USD',fmtD(plus(3)),'',0,'Закрыто')];
vm.runInThisContext(src); logAction=()=>{}; isSectionHeader=(r)=>r[1]==='SMT цех';
const to=id=>calls.filter(c=>String((c.p||{}).chat_id)===String(id));
// ===== 1) Oylik kalendar — xodimlarga =====
calls.length=0; employeeMonthlyReports();
ok(to('111').some(c=>c.m==='sendPhoto'&&c.p.photo==='PNG:tabel.png'&&c.p.caption.includes(MSG.uz.months[pm])),'Karimov (uz): o\'tgan oy kalendari rasm bo\'lib ketdi');
ok(!to('222').some(c=>c.m==='sendPhoto')&&!to('222').some(c=>c.m==='sendMessage'),'Valiyev: табель bo\'sh → hech narsa yuborilmadi (bo\'sh rasm yo\'q)');
ok(to('999').some(c=>c.m==='sendMessage'&&c.p.text.includes('yuborildi: 1')&&c.p.text.includes('bo\'sh: 1')),'Adminga yakun: 1 yuborildi, 1 bo\'sh');
const qc=calls.find(c=>c.m==='quickchart'); ok(qc&&qc.body.chart.type==='scatter'&&!JSON.stringify(qc.body).includes('function'),'Kalendar konfiguratsiyasi toza JSON');
ok(calls.filter(c=>c.m==='quickchart').length===1,'Табель varag\'i bir marta o\'qildi, rasm faqat kerakli xodimga');
// QuickChart ishlamasa — matn
calls.length=0; employeeMonthlyReports(); ok(calls.length===0,'Shu oy uchun qayta ishga tushsa — takror yuborilmaydi');
calls.length=0; qcFail=true; resendMonthlyReports(); ok(to('111').some(c=>c.m==='sendMessage'&&c.p.text.includes('Davomat')),'resendMonthlyReports + QuickChart xatosi → matnli davomat'); qcFail=false;
// Vaqt byudjeti: 4,5 daqiqadan oshsa to'xtab, davom triggeri qo'yadi; keyingi ishga tushishda qolganidan davom etadi
{ const RD=Date.now; let t=RD(); Date.now=()=>{t+=200000;return t}; delete props.MONTHLY_STATE; trig.length=0; calls.length=0; employeeMonthlyReports();
  const st=JSON.parse(props.MONTHLY_STATE); ok(!st.done && trig.includes('employeeMonthlyReports@after') && !to('999').length,'Vaqt tugadi → holat saqlandi (next='+st.next+'), davom triggeri qo\'yildi, yakun xabari hali yo\'q');
  Date.now=RD; calls.length=0; employeeMonthlyReports(); const st2=JSON.parse(props.MONTHLY_STATE); ok(st2.done && st2.ok+st2.none===2 && to('999').length===1,'Davom: qolganlar yuborildi, yakun bir marta'); }
// Bir xil ismli ikki qator → noaniq, yuborilmaydi
{ const tm=tabelRowMap({getLastRow:()=>4,getLastColumn:()=>69,getRange:()=>({getValues:()=>{const W=69,h=new Array(W).fill('');h[1]='Ф.И.О';const a=new Array(W).fill('');a[1]='Karimov Jasur';a[3]='+';const b=a.slice();b[3]='-';return [h,a,b]}})},0);
  ok(Object.keys(tm.dups).length===1 && tm.dups[nameKey('Karimov Jasur')],'tabelRowMap: takror ism "noaniq" deb belgilanadi'); }
// 📅 Davomat tugmasi ham rasm
calls.length=0; showTabel('111',{v:['1','','111','','','K','active','uz','','']},pm);
ok(to('111').some(c=>c.m==='sendPhoto') && JSON.parse(to('111').find(c=>c.m==='sendPhoto').p.reply_markup).keyboard,'📅 Davomat tugmasi: rasm + asosiy menyu');
// ===== 2) Qarz eslatmasi =====
calls.length=0; debtReminders();
{ const n1=calls.length; debtReminders(); ok(calls.length===n1,'Qarz eslatmasi shu kuni qayta ishlasa — takror yo\'q'); }
ok(to('111').some(c=>c.p.text&&c.p.text.includes('Eslatma')&&c.p.text.includes("1 000 000 so'm")&&c.p.text.includes(fmtD(plus(3)))),'Karimov: 3 kun oldin eslatma (uz)');
ok(to('222').some(c=>c.p.text&&c.p.text.includes('Сегодня')&&c.p.text.includes('700 USD')),'Valiyev: bugun muddati (ru)');
ok(!to('111').some(c=>c.p.text&&c.p.text.includes('500 000')),'10 kun keyingi qarz uchun eslatma yo\'q');
ok(!to('222').some(c=>c.p.text&&c.p.text.includes('300 USD')),'Yopilgan qarz uchun eslatma yo\'q');
const adminDebt=to('999').find(c=>c.p.text&&c.p.text.includes('Shu oyda yopiladigan')); ok(D===1?!!adminDebt:!adminDebt,'Adminga oylik ro\'yxat faqat oyning 1-sanasida (bugun '+D+'-sana)');
// ===== 3) Прогул ogohlantirishi =====
calls.length=0; absenceAlerts();
ok(to('111').some(c=>c.p.text&&c.p.text.includes('прогул')&&c.p.text.includes(fmtD(today))),'Karimov: bugungi прогул ogohlantirishi');
ok(!to('222').length,'Valiyev (kelgan): ogohlantirish yo\'q');
ok(to('999').some(c=>c.p.text&&c.p.text.includes('Karimov')),'Adminga ro\'yxat');
calls.length=0; absenceAlerts(); ok(!to('111').length,'Qayta ishga tushsa — takror yubormaydi (kesh)');
// ===== 4) Triggerlar =====
trig.length=0;
warmApiCache=()=>{}; installTriggers(); ok(trig.includes('absenceAlerts@18')&&trig.includes('dailyReport@10'),'Triggerlar: absenceAlerts 18:00, dailyReport 10:00: '+trig.join(','));
console.log(fails?`\n${fails} ta test YIQILDI`:'\nAvtomatlashtirish: barcha testlar o\'tdi'); process.exit(fails?1:0);
