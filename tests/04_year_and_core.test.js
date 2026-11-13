// Yil almashuvi, kesh isitish soatlari, webhook himoyasi, ariza oqimi, xabar yuborish, qidiruv, qarz
const fs=require('fs'),vm=require('vm'); const src=fs.readFileSync(require('path').join(__dirname,'..','zp_bot.gs'),'utf8');
let fails=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c)fails++};
const cache={}; const calls=[]; const opened=[];
global.CacheService={getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]},removeAll:ks=>ks.forEach(k=>delete cache[k])})};
const props={BOT_TOKEN:'t',ADMIN_ID:'999',TABEL_ID:'F2026',WEBAPP_URL:'https://s/exec',OPENAI_API_KEY:'sk'};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})};
global.Utilities={sleep(){},formatDate:(d)=>('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(),getUuid:()=>'abcd-'+String(1234+(global.__u=(global.__u||0)+1)-1).padStart(4,'0')+'-ffff'};
global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};global.Logger={log(){}};global.HtmlService={createHtmlOutput:s=>s};global.Session={getScriptTimeZone:()=>''};
let oa=[]; global.UrlFetchApp={fetch:(url,o)=>{if(url.includes('openai'))return{getResponseCode:()=>200,getContentText:()=>JSON.stringify(oa.shift())};const p=o.contentType?JSON.parse(o.payload):o.payload;calls.push({m:url.split('/').pop(),p});return{getResponseCode:()=>200,getContentText:()=>'{"ok":true}'}}};
const RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const mkSheet=(nd,rows)=>{const W=3+nd*2+4;const h=new Array(W).fill('');h[1]='Ф.И.О';const s=new Array(W).fill('');s[1]='SMT цех';const R=[h,s].concat(rows.map(([f,m])=>{const r=new Array(W).fill('');r[1]=f;m.forEach((x,i)=>r[3+i*2]=x);return r}));return{getLastRow:()=>R.length,getLastColumn:()=>W,getRange:(a,b,c,w)=>({getValues:()=>R.map(x=>x.slice(0,w))})}};
const files={F2026:{name:'Табель 2026',sheets:{'Декабрь':mkSheet(31,[['Karimov Jasur',Array(31).fill('+')]]),'Февраль':mkSheet(28,[['Karimov Jasur',Array(28).fill('+')]])}},
             F2027:{name:'Табель 2027',sheets:{'Январь':mkSheet(31,[['Karimov Jasur',['+','-']]])}}, 'BAD______________________xx':{name:'Boshqa',sheets:{'Лист1':mkSheet(1,[])}}};
let TG=[['1','','111','','','K','active','uz','','']], BASE=[['Август 2026','1','Karimov Jasur','','Сборщик'],['Август 2026','2','Каримова Дилноза','','Контролёр'],['Август 2026','3','ИБРАГИМОВ АЗИЗ','','Инженер']], DEBT=[];
global.SpreadsheetApp={openById:id=>{opened.push(id);const f=files[id];if(!f)throw new Error('not found');return{getName:()=>f.name,getSheetByName:n=>f.sheets[n]||null,getSheets:()=>Object.keys(f.sheets).map(n=>({getName:()=>n}))}},
  getActive:()=>({getSheetByName:n=>n==='Telegram'?{getLastRow:()=>TG.length+1,getRange:()=>({getValues:()=>TG,setValue(){},setValues(){}})}:n==='база'?{getLastRow:()=>BASE.length+1,getRange:(a,c,k,w)=>({getValues:()=>BASE.map(x=>x.slice(c-1,c-1+w))})}:n==='qarz_daftari'?{getLastRow:()=>DEBT.length+1,getRange:()=>({getValues:()=>DEBT})}:n==='ФИО табель'?{getLastRow:()=>1}:n==='Log'?{getLastRow:()=>1,appendRow(){}}:null})};
vm.runInThisContext(src); isSectionHeader=(r)=>r[1]==='SMT цех';
const RealDate=Date; const fakeNow=(y,m,d,h)=>{global.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super(y,m,d,h||10)}static now(){return new RealDate(y,m,d,h||10).getTime()}}};
const last=()=>calls[calls.length-1].p; let _kb=null; const cbOf=()=>_kb; const admin=()=>calls.filter(c=>String(c.p.chat_id)==='999');
// ---------- Yil ----------
ok(tabelYear()===2026 && tabelIdFor(2026)==='F2026' && tabelIdFor(2027)===null,'Standart: 2026-yil, fayl TABEL_ID');
fakeNow(2027,0,2); YEAR_CTX=null;
calls.length=0; yearCheck(); ok(admin().some(c=>c.p.text.includes('2027-yil uchun Табель fayli sozlanmagan')&&c.p.text.includes('/newyear')),'2027-yanvar, fayl ulanmagan → adminga ko\'rsatma');
ok(dailyData(0).filled===false,'Fayl ulanmaguncha bugungi davomat "to\'ldirilmagan" (xato emas)');
YEAR_CTX=null; const dec=monthlyData(1); ok(dec.month[0]===2026&&dec.month[1]===11&&dec.filled&&dec.total.w===31,'Yanvarda o\'tgan oy (Dekabr 2026) eski fayldan o\'qiladi');
calls.length=0; adminNewYear('999','https://docs.google.com/spreadsheets/d/BAD______________________xx/edit'); ok(last().text.includes('oy varaqlari topilmadi')&&props.TABEL_ID==='F2026','Oy varaqlari yo\'q fayl rad etildi');
calls.length=0; adminNewYear('999','https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/edit'); ok(last().text.includes('ochib bo\'lmadi')&&props.TABEL_ID==='F2026','Mavjud bo\'lmagan fayl → sozlama o\'zgarmadi');
files['F2027_____________________x']=files.F2027; calls.length=0; adminNewYear('999','https://docs.google.com/spreadsheets/d/F2027_____________________x/edit#gid=0');
ok(props.TABEL_YEAR==='2027'&&props.TABEL_ID==='F2027_____________________x'&&props.TABEL_ID_2026==='F2026'&&last().text.includes('2027-yil Табель fayli ulandi'),'/newyear: 2027 ulandi, 2026 arxivga o\'tdi');
YEAR_CTX=null; const jan=dailyData(0); ok(jan.filled&&jan.total.a===1,'Endi 2-yanvar davomati yangi fayldan (прогул 1)');
YEAR_CTX=null; ok(monthlyData(1).total.w===31,'Dekabr 2026 hali ham arxiv fayldan');
YEAR_CTX=null; calls.length=0; yearCheck(); ok(calls.length===0,'Ulangandan keyin ogohlantirish yo\'q');
fakeNow(2028,1,10); props.TABEL_YEAR='2028'; YEAR_CTX=null; ok(daysInMonth(1)===29,'Kabisa yili: 2028-fevral 29 kun'); YEAR_CTX=2027; ok(daysInMonth(1)===28,'2027-fevral 28 kun (yil konteksti)');
// Yanvarda xodim «Декабрь»ni tanlasa — o'tgan yil faylidan
props.TABEL_YEAR='2027'; props.TABEL_ID='F2027_____________________x'; props.TABEL_ID_2026='F2026'; fakeNow(2027,0,10); YEAR_CTX=null;
ok(tabelMonthList().map(m=>m.idx).sort().join()==='0,11','Yanvarda oylar ro\'yxati: Yanvar + o\'tgan yil Dekabri');
YEAR_CTX=null; const td=tabelData('1',11); ok(td.found&&td.w===31&&ctxYear()===2026,'tabelData(Dekabr) yanvarda 2026 faylidan, yil konteksti 2026');
YEAR_CTX=null; ok(tabelData('1',0).found&&ctxYear()===2027,'tabelData(Yanvar) — 2027 faylidan');
// Dekabrda oldindan ulash: /newyear 2027 … → joriy (2026) ishlashda davom etadi
props.TABEL_YEAR='2026'; props.TABEL_ID='F2026'; delete props.TABEL_ID_2026; fakeNow(2026,11,30); YEAR_CTX=null; calls.length=0;
adminNewYear('999','2027 https://docs.google.com/spreadsheets/d/F2027_____________________x/edit');
ok(props.TABEL_YEAR==='2027'&&props.TABEL_ID_2026==='F2026'&&defaultYear()===2026,'30-dekabrda «/newyear 2027 …»: 2026 arxivga, bugungi ishlar hali 2026 faylidan');
YEAR_CTX=null; ok(monthlyData(0).month[0]===2026&&monthlyData(0).filled,'Dekabr 2026 hisobotlari buzilmadi');
props.TABEL_YEAR='2026'; props.TABEL_ID='F2026'; delete props.TABEL_ID_2026; YEAR_CTX=null;
// ---------- Kesh isitish soatlari ----------
let n; fakeNow(2026,10,13,3); opened.length=0; warmApiCache(); n=opened.length; ok(n===0,'Tungi 03:00 — kesh isitilmaydi (Табель ochilmadi)');
fakeNow(2026,10,13,11); opened.length=0; warmApiCache(); ok(opened.length>0,'11:00 — kesh isitiladi');
global.Date=RealDate;
// ---------- Webhook himoyasi ----------
calls.length=0; setWebhook(); ok(/^https:\/\/s\/exec\?k=[0-9a-f]{12,}$/.test(calls[0].p.url)&&props.WEBHOOK_SECRET===calls[0].p.url.split('k=')[1],'setWebhook maxfiy kalit qo\'shadi');
calls.length=0; ok(doPost({parameter:{},postData:{contents:JSON.stringify({update_id:1,message:{from:{id:999},chat:{id:999},text:'/stats'}})}})==='Forbidden'&&!calls.length,'Kalitsiz update rad etiladi');
// ---------- Rahbar faqat active ----------
ok(isManager({v:['','','','','','','pending','','','рук']},5)===false&&isManager({v:['','','','','','','active','','','рук']},5)===true,'pending rahbar emas');
// ---------- Ariza oqimi ----------
logAction=()=>{}; const msg=(id,t,x)=>{calls.length=0;handleMessage(Object.assign({from:{id,first_name:'K'},chat:{id},text:t},x||{}));return last()};
ok(msg(111,'✉️ Adminga ariza').reply_markup.keyboard[0][0]==='🔙 Orqaga','Ariza → Orqaga');
msg(111,'💰 Oylik'); ok(!admin().length,'Ariza bosqichida menyu tugmasi ariza bo\'lib ketmaydi');
msg(111,'✉️ Adminga ariza'); msg(111,'Oyligim xato'); ok(admin().some(c=>c.p.text.includes('Oyligim xato')&&c.p.text.includes('Karimov Jasur')),'Haqiqiy ariza adminga F.I.O. bilan');
// ---------- Qidiruv ----------
const f=q=>aiFindEmployees(q).map(x=>x.fio);
ok(f('Karimov Jasur').length===1&&f('Karimov').length===2&&f('Каримов').includes('Karimov Jasur')&&f('Karimova')[0]==='Каримова Дилноза'&&f('Ibrohimov')[0]==='ИБРАГИМОВ АЗИЗ'&&f('Toshmatov').length===0,'Qidiruv: lotin↔kirill, imlo farqi, yo\'q xodim');
// ---------- Xabar yuborish (server tanlaydi) ----------
TG=[['1','','111','','','K','active','uz','',''],['2','','222','','','D','active','ru','','']]; cache['ai_h_999']=JSON.stringify([{role:'user',content:'Каримова (ПИНФЛ 2)'},{role:'assistant',content:'ok'}]);
msg(999,'Karimov Jasurga xabar yubor: ertaga 8:00'); ok(last().text.includes('Kimga: <b>Karimov Jasur</b>')&&/^sm:yes:\w{8}$/.test(last().reply_markup.inline_keyboard[0][0].callback_data)&&JSON.parse(cache['msgdraft_999_'+last().reply_markup.inline_keyboard[0][0].callback_data.split(':')[2]]).tgId==='111','Xabar: qabul qiluvchi ismdan, tarixdan emas; tasdiq oynasi');
const cbA=last().reply_markup.inline_keyboard[0][0].callback_data;
// Eski tugma muammosi: ikkinchi qoralama yaratilgandan keyin birinchi tugma BIRINCHI xabarni yuboradi
msg(999,'Каримова Дилнозага хабар юбор: иккинчи хабар'); const cbB=last().reply_markup.inline_keyboard[0][0].callback_data;
calls.length=0; handleCallback({id:'q',from:{id:999},data:cbA,message:{message_id:1,chat:{id:999},text:'x'}});
ok(cbA!==cbB && calls.some(c=>c.m==='sendMessage'&&String(c.p.chat_id)==='111'&&c.p.text.includes('ertaga 8:00')) && !calls.some(c=>String(c.p.chat_id)==='222'),'Eski «Yuborish» tugmasi o\'z xabarini o\'z odamiga yuboradi (yangisini emas)');
calls.length=0; handleCallback({id:'q',from:{id:999},data:cbA,message:{message_id:1,chat:{id:999},text:'x'}}); ok(!calls.some(c=>c.m==='sendMessage'),'Bir tugma ikki marta bosilsa — ikkinchi marta yuborilmaydi');
calls.length=0; handleCallback({id:'q',from:{id:999},data:'sm:yes',message:{message_id:1,chat:{id:999},text:'x'}}); ok(!calls.some(c=>c.m==='sendMessage'),'ID siz eski tugma — yuborilmaydi');
msg(999,'Karimov Jasurga xabar yubor: ertaga 8:00'); _kb=last().reply_markup.inline_keyboard[0][0].callback_data; calls.length=0; handleCallback({id:'q',from:{id:999},data:cbOf(),message:{message_id:1,chat:{id:999},text:'x'}});
ok(calls.filter(c=>c.m==='sendMessage'&&String(c.p.chat_id)==='111').length===1&&!calls.some(c=>String(c.p.chat_id)==='222'),'Yuborish: faqat tanlangan xodimga');
msg(999,'Karimovga xabar yubor: salom'); ok(last().reply_markup.inline_keyboard.length===2&&last().reply_markup.inline_keyboard.every(r=>/^smp:\d+:\w{8}$/.test(r[0].callback_data)),'Ikki Karimov → tanlash tugmalari, taxmin yo\'q');
{ const pick=last().reply_markup.inline_keyboard.find(r=>r[0].callback_data.startsWith('smp:1:'))[0].callback_data; calls.length=0; handleCallback({id:'q',from:{id:999},data:pick,message:{message_id:2,chat:{id:999},text:'Qaysi',reply_markup:{inline_keyboard:[[{text:'Karimov Jasur',callback_data:pick}]]}}});
  ok(last().text.includes('Kimga: <b>Karimov Jasur</b>')&&last().text.includes('salom'),'Tanlangach — shu matn bilan tasdiq oynasi'); }
// Xabar buyrug'iga o'xshamaydigan savollar AI ga ketadi
oa=[{choices:[{message:{role:'assistant',content:'AI_JAVOB'}}]},{choices:[{message:{role:'assistant',content:'AI_JAVOB'}}]}];
ok(msg(999,'Напиши зарплату Каримова за август - сентябрь').text==='AI_JAVOB','«Напиши … - …» xabar deb olinmaydi');
ok(msg(999,'Toshmatovga xabar yubor: salom').text==='AI_JAVOB','Xodim topilmasa — AI javob beradi (qoralama yo\'q)');
calls.length=0; handleCallback({id:'q',from:{id:111},data:'sm:yes',message:{message_id:1,chat:{id:111},text:'x'}}); ok(!calls.some(c=>c.m==='sendMessage'),'Admin bo\'lmagan foydalanuvchi sm:yes — hech narsa');
// ---------- Qarz ----------
const dr=(p,amt,cur,rest,st)=>{const r=new Array(28).fill('');r[0]=p;r[1]='Karimov Jasur';r[4]=amt;r[5]=cur;r[6]=amt;r[7]=1;r[8]='05.09.2026';r[9]='05.10.2026';r[12]=0;r[13]=rest;r[14]=st;return r};
DEBT=[new Array(28).fill(''),dr('1','1 000 000,00','УзСум','1 000 000,00','Открыто'),dr('1',700,'USD',700,'Открыто'),dr('1',500000,'УзСум',0,'Закрыто')];
ok(debtIsOpen(dr('1',1,'USD',1,'Не закрыто'))&&debtIsOpen(dr('1',1,'USD',1,'yopilmagan'))&&!debtIsOpen(dr('1',1,'USD',1,' Закрыто ')),'Holat: «не закрыто»/«yopilmagan» — ochiq, «Закрыто» — yopiq');
ok(splitMessage('a'.repeat(9000),3900).every(x=>x.length<=3900)&&splitMessage('a'.repeat(9000),3900).join('').length===9000,'Juda uzun bitta qator ham bo\'linadi');
const dd=debtData('1'); ok(dd.count===3&&dd.open_count===2&&dd.total_rest.UZS===1000000&&dd.total_rest.USD===700,'Qarz: valyuta kesimida qoldiq, yopilgan hisobga olinmaydi');
ok(debtReport('2','uz').includes("qarz yozuvi yo'q"),'Boshqa xodim bu qarzlarni ko\'rmaydi');
console.log(fails?`\n${fails} ta test YIQILDI`:'\nYil va asosiy oqimlar: barcha testlar o\'tdi'); process.exit(fails?1:0);
