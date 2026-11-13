const fs=require('fs'),vm=require('vm'); const src=fs.readFileSync(require('path').join(__dirname,'..','zp_bot.gs'),'utf8');
let fails=0; const ok=(c,m)=>{console.log((c?'✓ ':'✗ ')+m); if(!c)fails++};
const cache={}; const calls=[];
global.CacheService={getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})};
const props={BOT_TOKEN:'t',ADMIN_ID:'999'}; global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})};
global.Utilities={sleep(){},formatDate:()=>'22.10.2026'};global.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}}),getDocumentLock:()=>({waitLock(){},releaseLock(){}})};global.Logger={log(){}};global.HtmlService={};global.Session={getScriptTimeZone:()=>''};
global.UrlFetchApp={fetch:(url,o)=>{ if(url.includes('thumb')) return{getBlob:()=>({setName:n=>'PNG:'+n})}; const p=o.contentType?JSON.parse(o.payload):o.payload;calls.push({m:url.split('/').pop(),p});return{getResponseCode:()=>200,getContentText:()=>'{"ok":true}'}}};
// Namunaviy qator: I oklad 13.5M, L 10M, N rassrochka 3 015 000, P 3 015 000, W 3.5M, AA 13.5M
const r=new Array(27).fill(0); r[0]='Январь 2026'; r[1]='12345678901234'; r[2]="Namunaviy Xodim Sinov o'g'li"; r[3]='АУП'; r[4]='Тестовая должность'; r[5]='25.07.2016';
r[6]=24; r[7]=24; r[8]=13500000; r[9]=10000000; r[10]=3500000; r[11]=10000000; r[12]=0; r[13]='3 015 000,00'; r[14]=0; r[15]='3 015 000,00'; r[16]=0; r[17]=0; r[18]=0; r[19]=0; r[20]=0; r[21]=10000000; r[22]=3500000; r[23]=0; r[24]=0; r[25]=3500000; r[26]=13500000;
global.SpreadsheetApp={getActive:()=>({getSheetByName:n=>n==='qarz_daftari'?{getLastRow:()=>1}:n==='база'?{getLastRow:()=>2,getRange:(a,c,n,w)=>({getValues:()=>[r.slice(c-1,c-1+w)]})}:n==='Log'?{getLastRow:()=>1,appendRow(){}}:null})};
vm.runInThisContext(src); logAction=()=>{};
const d=payslipData(r,'uz');
ok(d.total===13500000 && d.dedTotal===3015000 && d.net===10485000,'Hisob: jami 13 500 000, ushlanma 3 015 000, qo\'lga 10 485 000');
ok(d.oklad===13500000 && d.inc.reduce((a,x)=>a+x[1],0)===d.total && d.inc.map(x=>x[0]).join('|')==="Hisoblangan (bux)|Hisoblangan (naqd)" && d.ded.length===1 && d.ded[0][0]==='Rassrochka (qarz)','Nol moddalar yashirildi; rassrochka ushlanmada');
// Jarima: ЗП итогда allaqachon ayrilgan → ma'lumot sifatida, ikkinchi marta ayrilmaydi; avans ayriladi
const r2=r.slice(); r2[14]=200000; r2[26]=13300000; r2[12]=2000000; r2[15]='5 215 000,00'; const d2=payslipData(r2,'uz');
const r3=r.slice(); r3[24]=1500000; const d3=payslipData(r3,'uz');
ok(d3.inc.some(x=>x[0]==='Kvartira puli'&&x[1]===1500000) && !d3.ded.some(x=>x[0].startsWith('Kvartira')) && d3.total===15000000 && d3.net===15000000-3015000,'Kvartira puli qo\'shimcha daromad: jami 13 500 000 + 1 500 000, qo\'lga 11 985 000');
ok(d2.inc.some(x=>x[0]==='Jarima'&&x[1]===-200000) && !d2.ded.some(x=>x[0]==='Jarima') && d2.dedTotal===5015000 && d2.net===13300000-5015000,'Jarima ikki marta ayrilmaydi: qo\'lga 13 300 000 − (2 000 000 avans + 3 015 000 rassrochka) = 8 285 000');
// Slides yo'q → matn
calls.length=0; sendPayslip('5','uz',r,{keyboard:[]}); ok(calls.some(c=>c.m==='sendMessage'&&c.p.text.includes('Oylik ma\'lumoti')) && calls.some(c=>String(c.p.chat_id)==='999'&&c.p.text.includes('Slides API')),'Slides yoqilmagan → matn + adminga sabab');
// Slides mock → rasm
const shapes=[]; const mkText=()=>({getTextStyle:()=>({setFontFamily(){return this},setFontSize(){return this},setForegroundColor(){return this},setBold(){return this}}),getParagraphStyle:()=>({setParagraphAlignment(){return this},setSpaceAbove(){return this},setSpaceBelow(){return this}})});
const slide={getObjectId:()=>'s1',insertShape:(t,l,top,w,h)=>{shapes.push({t:'rect',top,h});return{getFill:()=>({setSolidFill(){}}),getBorder:()=>({setTransparent(){}})}},insertTextBox:(str,l,top,w,h)=>{shapes.push({t:'text',str,top,h});return{getText:mkText,setContentAlignment(){}}},remove(){}};
let removed=0, leftover=[{remove(){removed++}},{remove(){removed++}},{remove(){removed++}}]; slide.remove=()=>{removed++};
global.SlidesApp={openById:()=>({appendSlide:()=>slide,saveAndClose(){},getId:()=>'P1',getSlideById:()=>slide,getSlides:()=>leftover}),PredefinedLayout:{BLANK:1},ShapeType:{RECTANGLE:1},ParagraphAlignment:{END:1,START:0},ContentAlignment:{MIDDLE:1}};
global.Slides={Presentations:{create:(o)=>({presentationId:'P1',_o:o}),Pages:{getThumbnail:()=>({contentUrl:'https://x/thumb'})}}};
delete cache['chart_err']; calls.length=0; shapes.length=0; sendPayslip('5','uz',r,{keyboard:[]});
const ph=calls.find(c=>c.m==='sendPhoto');
ok(ph && ph.p.photo==='PNG:hisob_varaqasi.png' && ph.p.caption.includes('Oylik ma\'lumoti'),'Slides bor → rasm + matnli caption');
ok(props.PAYSLIP_PRES_ID==='P1','Taqdimot ID Script property ga saqlandi (qayta yaratilmaydi)');
ok(removed===3,'Qolib ketgan 2 slayd tozalandi + yangi slayd ishdan keyin o\'chirildi (1-slayd saqlanadi)');
ok(ph.p.caption.includes("QO'LGA TEGADI: 10 485 000") && ph.p.caption.includes('Rassrochka (qarz): − 3 015 000'),'Izohdagi matn rasm bilan bir xil: ushlanma va qo\'lga tegadi');
{ removed=0; const f0=global.UrlFetchApp.fetch; global.UrlFetchApp.fetch=(u,o)=>{if(u.includes('thumb'))throw new Error('thumb fail');return f0(u,o)}; delete cache['chart_err']; calls.length=0; sendPayslip('5','uz',r,null);
  ok(removed>=1 && calls.some(c=>c.m==='sendMessage'&&c.p.text.includes("QO'LGA TEGADI")),'Rasm olishda xato → slayd baribir o\'chirildi, to\'liq matn yuborildi'); global.UrlFetchApp.fetch=f0; }
{ const r4=r.slice(); r4[7]=21.5; const t4=payslipText(payslipData(r4,'uz'),'uz'); ok(t4.includes('Ishlangan kunlar: 21,5'),'21,5 kun yaxlitlanmaydi'); }
const texts=shapes.filter(x=>x.t==='text').map(x=>x.str);
ok(texts[0].startsWith('«Artel electronics manufacturing» MCHJ — Oylik hisob varaqasi') && texts.includes("QO'LGA TEGADI") && texts.includes("10 485 000 so'm") && texts.includes("− 3 015 000 so'm"),'Kartada firma nomi, qo\'lga tegadi, ushlanma');
const maxBottom=Math.max(...shapes.map(x=>x.top+x.h)); ok(maxBottom<=700,'Tarkib sahifaga sig\'adi (pastki chegara '+maxBottom+' pt / 700)');
console.log(fails?`\n${fails} ta test YIQILDI`:'\nHisob varaqasi: barcha testlar o\'tdi'); process.exit(fails?1:0);
