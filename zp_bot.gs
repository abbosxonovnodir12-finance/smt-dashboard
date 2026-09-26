/**
 * ЗП Telegram bot — Google Apps Script (bog'langan skript, ЗП faylida ishlaydi)
 *
 * O'RNATISH:
 *  1. ЗП faylida: Extensions → Apps Script → shu kodni joylashtiring.
 *  2. setup() ni bir marta ishga tushiring — Telegram va Log varaqlari yaratiladi.
 *  3. Project Settings → Script properties:
 *       BOT_TOKEN  = BotFather'dan olingan token
 *       ADMIN_ID   = sizning Telegram ID (raqam). Bilmasangiz: botga /id yozing.
 *  4. Deploy → New deployment → Web app: Execute as "Me", Access "Anyone". URL ni nusxalang.
 *  5. Script properties'ga WEBAPP_URL = shu URL ni yozing, keyin setWebhook() ni ishga tushiring.
 *  6. Telegram varaqiga ПИНФЛ + Telefon (kadrlar jadvalidan) ni to'ldiring.
 *  7. (Ixtiyoriy) AI yordamchi: Script properties'ga OPENAI_API_KEY qo'shing — rahbarlar botga erkin savol yoki ovoz yuborishi mumkin bo'ladi.
 */

var SHEET_BASE = 'база';
var SHEET_TG   = 'Telegram';
var SHEET_LOG  = 'Log';
var SHEET_BONUS = 'надбавка';   // qo'shimcha to'lov varag'i (A ПИНФЛ, G..W oylar/kvartal, W Итог)
var BONUS_YEAR = '2026';
var SHEET_NAMES = 'ФИО табель';    // ПИНФЛ -> Табельдаги Ф.И.О. mosligi
// Табель: Script property TABEL_ID (fayl ID). Har oy = varaq. B ФИО, D dan boshlab har kun 2 ustun (belgi, qo'shimcha soat)
var TAB = { FIO: 1, DAY0: 3, EXTRA: 65, DAYS: 66 };
var RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// база: A Период, B ПИНФЛ, ... ko'rsatiladigan ustunlar (0-indeks):
var COL = { PERIOD: 0, PINFL: 1, FIO: 2 };
var SHOW = [
  { i: 6,  uz: 'Reja kunlari',        ru: 'План дня',            days: true },
  { i: 7,  uz: 'Ishlangan kunlar',    ru: 'Факт дня',            days: true },
  { i: 8,  uz: 'Oklad',               ru: 'Оклад' },
  { i: 11, uz: 'Hisoblangan (bux)',   ru: 'Начисление бух' },
  { i: 16, uz: 'Mukofot (plastik)',   ru: 'Премия на пластик' },
  { i: 17, uz: "Ta'til",              ru: 'Отпуск' },
  { i: 18, uz: 'Kasallik varaqasi',   ru: 'Больничные' },
  { i: 19, uz: 'Kompensatsiya',       ru: 'Компенсация' },
  { i: 22, uz: 'Hisoblangan (naqd)',  ru: 'Начисление наличка' },
  { i: 26, uz: 'JAMI oylik',          ru: 'ИТОГО зарплата', bold: true }
];

// Telegram varaqi ustunlari
var T = { PINFL: 0, HR_PHONE: 1, TG_ID: 2, TG_PHONE: 3, USERNAME: 4, NAME: 5, STATUS: 6, LANG: 7, DATE: 8, ROLE: 9 };
var TG_HEADER = ['ПИНФЛ', 'Telefon (kadrlar)', 'Telegram ID', 'Telegram telefon', 'Username', 'Ism', 'Status', 'Til', 'Sana', 'Роль'];
var BOT_VERSION = '2026-09-26.2';
var API_CACHE_SEC = 900; // Mini App ma'lumotlari keshi (soniya); warmApiCache() har 5 daqiqada yangilab turadi
var WARM_MINUTES = 5;
var REPORT_HOUR = 10;
var LOG_KEEP_DAYS = 90;    // Log: shundan eski qatorlar o'chiriladi
var LOG_MAX_ROWS = 20000;  // Log: shundan ko'p bo'lsa eng eskilari o'chiriladi // kunlik hisobot soati (loyiha vaqt zonasi: Asia/Tashkent)

var MSG = {
  uz: {
    choose_lang: "Tilni tanlang / Выберите язык",
    hello: "Assalomu alaykum! Oylik ma'lumotini olish uchun avval ro'yxatdan o'ting.\n\n14 xonali ПИНФЛ raqamingizni kiriting:",
    bad_pinfl: "ПИНФЛ 14 ta raqamdan iborat bo'lishi kerak. Qayta kiriting:",
    no_pinfl: "Bu ПИНФЛ bazada topilmadi. Tekshirib qayta kiriting yoki HR ga murojaat qiling.",
    taken: "Bu ПИНФЛ allaqachon boshqa Telegram akkauntga bog'langan. O'zgartirish uchun adminga ariza yuboring.",
    send_phone: "Endi pastdagi tugma orqali telefon raqamingizni yuboring:",
    btn_phone: "📱 Telefon raqamni yuborish",
    own_contact: "Faqat o'zingizning kontaktingizni tugma orqali yuboring.",
    activated: "✅ Ro'yxatdan o'tdingiz. Endi oylik ma'lumotingizni ko'rishingiz mumkin.",
    pending: "⏳ Raqamingiz kadrlar jadvalidagi raqam bilan mos kelmadi. So'rovingiz adminga yuborildi — tasdiqlangach xabar beramiz.",
    still_pending: "⏳ So'rovingiz hali admin tomonidan ko'rib chiqilmagan. Xabar yuborish: /ariza",
    approved: "✅ Admin tasdiqladi. Endi oylik ma'lumotingizni ko'rishingiz mumkin.",
    rejected: "❌ Admin so'rovingizni rad etdi. Savollar bo'lsa HR ga murojaat qiling.",
    unlinked: "Sizning bog'lanishingiz admin tomonidan bekor qilindi. Qayta ro'yxatdan o'tish uchun /start bosing.",
    menu: "Kerakli bo'limni tanlang:",
    btn_me: "👤 Shaxsiy ma'lumot", me_title: "👤 Shaxsiy ma'lumot", me_fio: "F.I.O.", me_pos: "Lavozim", me_type: "Toifa",
    me_hired: "Ishga qabul qilingan", me_tenure: "Ish staji (shu korxonada)", me_salary: "Oklad", me_asof: "Oxirgi yangilanish",
    y: "yil", mo: "oy", d: "kun",
    btn_salary: "💰 Oylik", btn_bonus: "➕ Qo'shimcha to'lov", btn_lang: "🌐 Til", btn_request: "✉️ Adminga ariza",
    btn_daily: "📊 Kunlik davomat", btn_dash: "📱 Dashboard", open_dash: "Dashboard'ni ochish", btn_lookup: "🔎 Xodim ma'lumoti", what_show: "Nimani ko'rsatay?",
    daily_title: "📊 Davomat", d_total: "Jami", d_present: "kelgan", d_absent: "kelmagan", d_unmarked: "belgilanmagan",
    d_empty: "Bu kun uchun табель hali to'ldirilmagan.", d_today: "Bugun", d_yest: "Kecha", d_prev_month: "📈 O'tgan oy", d_this_month: "📈 Shu oy",
    m_title: "📈 Davomat yakuni", m_emps: "Xodimlar", m_workdays: "ishlangan kun-jami", m_abs: "прогул", m_vac: "ta'til", m_sick: "kasallik",
    m_top: "TOP-10 eng ko'p kelmaganlar (прогул)", m_noabs: "Прогул yo'q 👍", m_sections: "Bo'limlar", m_emp: "xodim",
    mark_abs: "прогул", mark_vac: "ta'til", mark_sick: "kasal", mark_bs: "Бс", mark_half: "yarim kun",
    ask_name: "Xodimning familiyasi yoki ismini yozing (bekor qilish: «🔙 Orqaga»):", no_match: "Topilmadi. Boshqacha yozib ko'ring:",
    pick_emp: "Xodimni tanlang:", not_allowed: "Bu bo'lim faqat rahbarlar uchun.",
    btn_tabel: "📅 Davomat", tabel_title: "📅 Davomat", tabel_none: "Табельда sizning ismingiz topilmadi. Adminga ariza yuboring.",
    tabel_nodata: "Bu oy uchun ma'lumot hali kiritilmagan.", tabel_err: "Davomat ma'lumoti vaqtincha mavjud emas.",
    t_worked: "Ishlangan kunlar", t_extra: "Qo'shimcha soat", t_vac: "Ta'til", t_sick: "Kasallik", t_bs: "Бс", t_half: "Yarim kun",
    t_absent: "Kelmagan kunlar", t_absent_days: "Kelmagan sanalar", t_none: "yo'q", t_days: "kun",
    bonus_title: "➕ Qo'shimcha to'lov (надбавка)", no_bonus: "Sizga qo'shimcha to'lov belgilanmagan.",
    quarter: "-chorak", q_total: "Chorak jami", y_total: "YIL JAMI",
    months: ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"],
    choose_month: "Oyni tanlang:",
    no_data: "Sizga tegishli ma'lumot topilmadi.",
    ask_request: "Arizangiz matnini yozing. Bekor qilish uchun «🔙 Orqaga» tugmasini bosing:",
    request_sent: "✉️ Arizangiz adminga yuborildi.",
    cancelled: "Bekor qilindi.", btn_back: "🔙 Orqaga",
    not_registered: "Avval ro'yxatdan o'ting: /start",
    days: "kun", sum: "so'm",
    report_title: "📄 Oylik ma'lumoti"
  },
  ru: {
    choose_lang: "Tilni tanlang / Выберите язык",
    hello: "Здравствуйте! Для получения данных о зарплате сначала зарегистрируйтесь.\n\nВведите ваш 14-значный ПИНФЛ:",
    bad_pinfl: "ПИНФЛ должен состоять из 14 цифр. Введите ещё раз:",
    no_pinfl: "Этот ПИНФЛ не найден в базе. Проверьте и введите снова или обратитесь в HR.",
    taken: "Этот ПИНФЛ уже привязан к другому Telegram-аккаунту. Для изменения отправьте заявку админу.",
    send_phone: "Теперь отправьте свой номер телефона через кнопку ниже:",
    btn_phone: "📱 Отправить номер телефона",
    own_contact: "Отправьте только свой контакт через кнопку.",
    activated: "✅ Вы зарегистрированы. Теперь вы можете смотреть данные о зарплате.",
    pending: "⏳ Ваш номер не совпал с номером в базе кадров. Запрос отправлен админу — сообщим после подтверждения.",
    still_pending: "⏳ Ваш запрос ещё не рассмотрен админом. Написать админу: /ariza",
    approved: "✅ Админ подтвердил. Теперь вы можете смотреть данные о зарплате.",
    rejected: "❌ Админ отклонил ваш запрос. По вопросам обращайтесь в HR.",
    unlinked: "Ваша привязка отменена админом. Для повторной регистрации нажмите /start.",
    menu: "Выберите раздел:",
    btn_me: "👤 Мои данные", me_title: "👤 Мои данные", me_fio: "Ф.И.О.", me_pos: "Должность", me_type: "Тип",
    me_hired: "Дата приёма", me_tenure: "Стаж (на предприятии)", me_salary: "Оклад", me_asof: "Данные на",
    y: "г.", mo: "мес.", d: "дн.",
    btn_salary: "💰 Зарплата", btn_bonus: "➕ Надбавка", btn_lang: "🌐 Язык", btn_request: "✉️ Заявка админу",
    btn_daily: "📊 Табель за день", btn_dash: "📱 Дашборд", open_dash: "Открыть дашборд", btn_lookup: "🔎 Сотрудник", what_show: "Что показать?",
    daily_title: "📊 Табель", d_total: "Итого", d_present: "присутствуют", d_absent: "отсутствуют", d_unmarked: "не отмечено",
    d_empty: "Табель за этот день ещё не заполнен.", d_today: "Сегодня", d_yest: "Вчера", d_prev_month: "📈 Прошлый месяц", d_this_month: "📈 Этот месяц",
    m_title: "📈 Итоги табеля", m_emps: "Сотрудники", m_workdays: "отработано дней всего", m_abs: "прогулы", m_vac: "отпуск", m_sick: "больничный",
    m_top: "TOP-10 по прогулам", m_noabs: "Прогулов нет 👍", m_sections: "Отделы", m_emp: "сотр.",
    mark_abs: "прогул", mark_vac: "отпуск", mark_sick: "больн.", mark_bs: "Бс", mark_half: "полдня",
    ask_name: "Введите фамилию или имя сотрудника (отмена: «🔙 Назад»):", no_match: "Не найдено. Попробуйте иначе:",
    pick_emp: "Выберите сотрудника:", not_allowed: "Этот раздел только для руководителей.",
    btn_tabel: "📅 Табель", tabel_title: "📅 Табель", tabel_none: "Ваше имя не найдено в табеле. Отправьте заявку админу.",
    tabel_nodata: "Данные за этот месяц ещё не внесены.", tabel_err: "Данные табеля временно недоступны.",
    t_worked: "Отработано дней", t_extra: "Доп. часы", t_vac: "Отпуск", t_sick: "Больничный", t_bs: "Бс", t_half: "Полдня",
    t_absent: "Прогулы", t_absent_days: "Дни прогулов", t_none: "нет", t_days: "дн.",
    bonus_title: "➕ Надбавка", no_bonus: "Надбавка вам не назначена.",
    quarter: "-й квартал", q_total: "Итого за квартал", y_total: "ИТОГО ЗА ГОД",
    months: ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
    choose_month: "Выберите месяц:",
    no_data: "Данных по вам не найдено.",
    ask_request: "Напишите текст заявки. Для отмены нажмите «🔙 Назад»:",
    request_sent: "✉️ Заявка отправлена админу.",
    cancelled: "Отменено.", btn_back: "🔙 Назад",
    not_registered: "Сначала зарегистрируйтесь: /start",
    days: "дн.", sum: "сум",
    report_title: "📄 Данные о зарплате"
  }
};

// ---------- Setup ----------
function setup() {
  var ss = SpreadsheetApp.getActive();
  var tg = ss.getSheetByName(SHEET_TG);
  if (!tg) {
    tg = ss.insertSheet(SHEET_TG);
    tg.getRange(1, 1, 1, TG_HEADER.length).setValues([TG_HEADER]).setFontWeight('bold');
    tg.getRange('A:D').setNumberFormat('@'); // ПИНФЛ va telefonlar matn sifatida
    tg.setFrozenRows(1);
  } else if (tg.getRange(1, T.ROLE + 1).getValue() === '') {
    tg.getRange(1, T.ROLE + 1).setValue('Роль').setFontWeight('bold'); // eski jadvalga ustun qo'shish
  }
  var log = ss.getSheetByName(SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_LOG);
    log.getRange(1, 1, 1, 4).setValues([['Sana', 'Telegram ID', 'ПИНФЛ', 'Amal']]).setFontWeight('bold');
    log.setFrozenRows(1);
  }
}

function setWebhook() {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('WEBAPP_URL');
  if (!url) throw new Error('WEBAPP_URL script property yo\'q');
  var r = tg('setWebhook', { url: url, allowed_updates: ['message', 'callback_query'] });
  Logger.log(r);
}

function webhookInfo() {
  Logger.log(JSON.stringify(tg('getWebhookInfo', {}), null, 2));
}

function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }

// ---------- Telegram API ----------
function tg(method, payload) {
  // Google → Telegram tarmog'i vaqti-vaqti bilan uziladi ("Address unavailable") — 3 marta urinamiz
  var url = 'https://api.telegram.org/bot' + prop('BOT_TOKEN') + '/' + method;
  var opt = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  var lastErr;
  for (var i = 0; i < 3; i++) {
    if (i) Utilities.sleep(700 * i);
    try {
      var res = UrlFetchApp.fetch(url, opt);
      if (res.getResponseCode() >= 500) { lastErr = new Error('Telegram HTTP ' + res.getResponseCode()); continue; }
      return JSON.parse(res.getContentText());
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
function send(chatId, text, kb) {
  var p = { chat_id: chatId, text: text, parse_mode: 'HTML' };
  if (kb) p.reply_markup = kb;
  return tg('sendMessage', p);
}
function removeKb() { return { remove_keyboard: true }; }

// ---------- Web app entry ----------
function doPost(e) {
  try {
    var upd = JSON.parse(e.postData.contents);
    if (upd && upd.api) return apiResponse(handleApi(upd)); // Mini App so'rovi
    // Telegram bir xil update'ni qayta yuborsa — e'tiborsiz qoldiramiz
    var cache = CacheService.getScriptCache(), key = 'upd_' + upd.update_id;
    if (cache.get(key)) return HtmlService.createHtmlOutput('OK');
    cache.put(key, '1', 21600);
    if (upd.message) handleMessage(upd.message);
    else if (upd.callback_query) handleCallback(upd.callback_query);
  } catch (err) {
    Logger.log(err);
    try { send(prop('ADMIN_ID'), '⚠️ Bot error: ' + err); } catch (x) {}
  }
  return HtmlService.createHtmlOutput('OK');
}
// Qulf faqat Telegram varag'iga yozadigan amallar uchun (parallel yozishdan himoya)
function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- State (CacheService, 6 soat) ----------
function getState(uid) { var s = CacheService.getScriptCache().get('st_' + uid); return s ? JSON.parse(s) : {}; }
function setState(uid, st) { CacheService.getScriptCache().put('st_' + uid, JSON.stringify(st), 21600); }
function clearState(uid) { CacheService.getScriptCache().remove('st_' + uid); }

// ---------- Sheet helpers ----------
function tgSheet() { return SpreadsheetApp.getActive().getSheetByName(SHEET_TG); }
function tgRows() {
  var sh = tgSheet(); var n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, TG_HEADER.length).getValues();
}
function findByTgId(uid) {
  var rows = tgRows();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][T.TG_ID]) === String(uid)) return { row: i + 2, v: rows[i] };
  return null;
}
function findByPinfl(pinfl) {
  var rows = tgRows();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][T.PINFL]).trim() === pinfl) return { row: i + 2, v: rows[i] };
  return null;
}
function pinflInBase(pinfl) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var vals = sh.getRange(2, COL.PINFL + 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === pinfl) return String(vals[i][1]);
  return null;
}
function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); return d.length > 9 ? d.slice(-9) : d; }
function logAction(uid, pinfl, action) {
  SpreadsheetApp.getActive().getSheetByName(SHEET_LOG).appendRow([new Date(), String(uid), pinfl, action]);
}
function langOf(rec, st) { return (rec && rec.v[T.LANG]) || (st && st.lang) || 'uz'; }
function isManager(rec, uid) {
  if (String(uid) === String(prop('ADMIN_ID'))) return true;
  var r = rec ? String(rec.v[T.ROLE] || '').trim().toLowerCase() : '';
  return r !== '';
}
function mainMenu(L, mgr) {
  if (mgr === undefined) mgr = MGR;
  var kb = [[MSG[L].btn_salary, MSG[L].btn_bonus], [MSG[L].btn_tabel, MSG[L].btn_me]];
  if (mgr) { kb.push([MSG[L].btn_daily, MSG[L].btn_lookup]); if (prop('MINIAPP_URL')) kb.push([MSG[L].btn_dash]); }
  kb.push([MSG[L].btn_lang, MSG[L].btn_request]);
  return { keyboard: kb, resize_keyboard: true };
}
function backKb(L) { return { keyboard: [[MSG[L].btn_back]], resize_keyboard: true }; }
// Matn asosiy menyu tugmasimi (ikkala tilda) — matn kiritish bosqichida bosilsa, ariza/qidiruv sifatida ketmasin
var MENU_KEYS = ['btn_salary', 'btn_bonus', 'btn_tabel', 'btn_me', 'btn_daily', 'btn_lookup', 'btn_dash', 'btn_lang', 'btn_request', 'btn_back'];
function isMenuText(text) {
  for (var i = 0; i < MENU_KEYS.length; i++) if (text === MSG.uz[MENU_KEYS[i]] || text === MSG.ru[MENU_KEYS[i]]) return true;
  return false;
}
function langKb() { return { inline_keyboard: [[{ text: "O'zbekcha", callback_data: 'lang:uz' }, { text: 'Русский', callback_data: 'lang:ru' }]] }; }

// ---------- Messages ----------
var ADMIN_HELP = '<b>Admin buyruqlari</b>\n' +
  '/stats — ro\'yxat statistikasi\n/pending — tasdiq kutayotganlar (tugmalar bilan)\n' +
  '/broadcast matn — barcha faol xodimlarga xabar (avval ko\'rsatadi, keyin tasdiqlaysiz)\n' +
  '/unlink ПИНФЛ — bog\'lanishni bekor qilish\n/find familiya — AI ism qidiruvini tekshirish\n/version — bot versiyasi\n/id — Telegram ID\n\n' +
  '<b>AI yordamchi</b> (rahbarlar): botga erkin savol yozing yoki ovozli xabar yuboring — masalan «Aliyevning avgust oyligi», «Bugun kim kelmadi?»';

function adminStats(chat) {
  var rows = tgRows(), c = { active: 0, pending: 0, mgr: 0, uz: 0, ru: 0 };
  rows.forEach(function (r) {
    if (r[T.STATUS] === 'active') { c.active++; if (String(r[T.ROLE] || '').trim()) c.mgr++; if (r[T.LANG] === 'ru') c.ru++; else c.uz++; }
    else if (r[T.STATUS] === 'pending') c.pending++;
  });
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var bv = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var lastPeriod = String(bv[bv.length - 1][0]), inLast = {}, n = 0;
  bv.forEach(function (r) { if (String(r[0]) === lastPeriod) inLast[String(r[1]).trim()] = 1; });
  var reg = {}; rows.forEach(function (r) { if (r[T.STATUS] === 'active') reg[String(r[T.PINFL]).trim()] = 1; });
  Object.keys(inLast).forEach(function (p) { if (!reg[p]) n++; });
  var log = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG), today = 0, logRows = log.getLastRow() - 1;
  if (logRows > 0) {
    var d = log.getRange(2, 1, logRows, 1).getValues(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    for (var i = d.length - 1; i >= 0 && d[i][0] instanceof Date && d[i][0] >= t0; i--) today++;
  }
  return send(chat, '<b>📊 Statistika</b>\n' +
    'Faol: <b>' + c.active + '</b> (uz ' + c.uz + ', ru ' + c.ru + ') · rahbarlar: ' + c.mgr + '\n' +
    'Tasdiq kutmoqda: <b>' + c.pending + '</b>' + (c.pending ? ' → /pending' : '') + '\n' +
    'Oxirgi oy (' + esc(lastPeriod) + ') xodimlaridan ro\'yxatdan o\'tmagan: <b>' + n + '</b> / ' + Object.keys(inLast).length + '\n' +
    'Bugungi so\'rovlar: ' + today + ' · Log qatorlari: ' + logRows + '\nBot: ' + BOT_VERSION);
}
function adminPending(chat) {
  var rows = tgRows(), n = 0;
  rows.forEach(function (r) {
    if (r[T.STATUS] !== 'pending') return;
    n++;
    var pinfl = String(r[T.PINFL]).trim();
    send(chat, '⏳ <b>' + esc(pinflInBase(pinfl) || '?') + '</b>\nПИНФЛ: <code>' + pinfl + '</code>\nTelegram: ' + esc(r[T.NAME]) + ' ' + esc(r[T.USERNAME]) +
      ' (ID ' + r[T.TG_ID] + ')\nTelefon: ' + esc(r[T.TG_PHONE]) + ' · kadrlar: ' + esc(r[T.HR_PHONE] || '—') + '\nSana: ' + fmtDate(r[T.DATE]),
      { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: 'ok:' + pinfl + ':' + r[T.TG_ID] }, { text: '❌ Rad etish', callback_data: 'no:' + pinfl + ':' + r[T.TG_ID] }]] });
  });
  if (!n) send(chat, 'Kutayotganlar yo\'q ✅');
}
function adminBroadcast(uid, chat, text) {
  if (!text) return send(chat, 'Foydalanish: /broadcast xabar matni');
  var n = tgRows().filter(function (r) { return r[T.STATUS] === 'active' && r[T.TG_ID]; }).length;
  CacheService.getScriptCache().put('bc_' + uid, text, 1800);
  return send(chat, '📣 <b>Xabar (' + n + ' kishiga):</b>\n\n' + esc(text),
    { inline_keyboard: [[{ text: '✅ Yuborish', callback_data: 'bc:yes' }, { text: '❌ Bekor', callback_data: 'bc:no' }]] });
}
function doBroadcast(uid, chat, msgId) {
  var text = CacheService.getScriptCache().get('bc_' + uid);
  if (!text) return send(chat, 'Xabar topilmadi (30 daqiqa o\'tgan). Qayta /broadcast yozing.');
  CacheService.getScriptCache().remove('bc_' + uid);
  var ok = 0, fail = 0;
  tgRows().forEach(function (r) {
    if (r[T.STATUS] !== 'active' || !r[T.TG_ID]) return;
    var res = send(String(r[T.TG_ID]), '📣 ' + esc(text));
    if (res && res.ok) ok++; else fail++;
  });
  logAction(uid, '', 'broadcast:' + ok + '/' + (ok + fail));
  tg('editMessageText', { chat_id: chat, message_id: msgId, text: '📣 Yuborildi: ' + ok + (fail ? ', yetib bormadi: ' + fail : '') });
}
function fmtDate(d) {
  if (!(d instanceof Date)) return String(d || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
}

var MGR = false; // joriy foydalanuvchi rahbarmi (har so'rovda o'rnatiladi)
function handleMessage(m) {
  var uid = m.from.id, chat = m.chat.id, text = (m.text || '').trim();
  var st = getState(uid);
  var rec = findByTgId(uid);
  var L = langOf(rec, st);
  MGR = isManager(rec, uid);

  if (text === '/id') return send(chat, 'ID: <code>' + uid + '</code>');
  if (text === '/version') return send(chat, 'Bot version: ' + BOT_VERSION);
  if (String(uid) === String(prop('ADMIN_ID')) && text.charAt(0) === '/') {
    if (text.indexOf('/unlink') === 0) return withLock(function () { return adminUnlink(chat, text); });
    if (text === '/stats') return adminStats(chat);
    if (text === '/pending') return adminPending(chat);
    if (text.indexOf('/broadcast') === 0) return adminBroadcast(uid, chat, text.replace('/broadcast', '').trim());
    if (text === '/admin') return send(chat, ADMIN_HELP);
    if (text.indexOf('/find ') === 0) { // diagnostika: AI ism qidiruvi nimani topadi
      var fr = aiFindEmployees(text.slice(6));
      return send(chat, fr.length ? fr.map(function (e) { return '• ' + esc(e.fio) + ' — ' + esc(e.position) + ' <code>' + e.pinfl + '</code>'; }).join('\n') : 'Topilmadi: ' + esc(text.slice(6)));
    }
  }

  if (text === '/start') {
    if (rec && rec.v[T.STATUS] === 'active') { clearState(uid); return send(chat, MSG[L].menu, mainMenu(L)); }
    if (rec && rec.v[T.STATUS] === 'pending') return send(chat, MSG[L].still_pending);
    if (!rec && MGR) send(chat, MSG[L].menu, mainMenu(L)); // admin: rahbar tugmalari darhol
    setState(uid, { step: 'lang' });
    return send(chat, MSG.uz.choose_lang, langKb());
  }
  if (text === '/ariza' || text === '/zayavka') { setState(uid, { step: 'request', lang: L, pinfl: st.pinfl }); return send(chat, MSG[L].ask_request, backKb(L)); }
  var active = rec && rec.v[T.STATUS] === 'active';
  if (text === '/cancel' || text === MSG.uz.btn_back || text === MSG.ru.btn_back) {
    clearState(uid);
    return send(chat, active ? MSG[L].menu : MSG[L].cancelled, active ? mainMenu(L) : removeKb());
  }
  // Ariza/qidiruv bosqichida menyu tugmasi yoki buyruq bosilsa — bosqichni tark etib, odatdagidek ishlaymiz
  if ((st.step === 'request' || st.step === 'mgr_find') && (isMenuText(text) || text.charAt(0) === '/')) { clearState(uid); st = {}; }

  // Ro'yxatdan o'tish bosqichlari
  if (st.step === 'pinfl') return stepPinfl(uid, chat, text, st);
  if (st.step === 'phone') {
    if (!m.contact) return send(chat, MSG[L].send_phone, phoneKb(L));
    if (String(m.contact.user_id) !== String(uid)) return send(chat, MSG[L].own_contact, phoneKb(L));
    return withLock(function () { return stepPhone(uid, chat, m, st); });
  }
  if (st.step === 'request') return stepRequest(uid, chat, text, rec, L, m);
  if (st.step === 'mgr_find') {
    if (!MGR) { clearState(uid); return send(chat, MSG[L].not_allowed, mainMenu(L)); }
    return stepMgrFind(uid, chat, text, L);
  }

  // Rahbar bo'limlari (admin ro'yxatdan o'tmagan bo'lsa ham ishlaydi)
  if (text === MSG.uz.btn_daily || text === MSG.ru.btn_daily) {
    if (!MGR) return send(chat, MSG[L].not_allowed, mainMenu(L));
    var kbd = [[{ text: MSG[L].d_yest, callback_data: 'day:1' }], [{ text: MSG[L].d_this_month, callback_data: 'mon:0' }, { text: MSG[L].d_prev_month, callback_data: 'mon:1' }]];
    if (prop('MINIAPP_URL')) kbd.push([{ text: MSG[L].btn_dash, web_app: { url: prop('MINIAPP_URL') } }]);
    return send(chat, buildDailyReport(L, 0), { inline_keyboard: kbd });
  }
  if (text === MSG.uz.btn_dash || text === MSG.ru.btn_dash) {
    if (!MGR) return send(chat, MSG[L].not_allowed, mainMenu(L));
    if (!prop('MINIAPP_URL')) return send(chat, 'MINIAPP_URL sozlanmagan.');
    return send(chat, MSG[L].btn_dash, { inline_keyboard: [[{ text: MSG[L].open_dash, web_app: { url: prop('MINIAPP_URL') } }]] });
  }
  if (text === MSG.uz.btn_lookup || text === MSG.ru.btn_lookup) {
    if (!MGR) return send(chat, MSG[L].not_allowed, mainMenu(L));
    setState(uid, { step: 'mgr_find', lang: L }); return send(chat, MSG[L].ask_name, backKb(L));
  }

  // AI yordamchi: rahbarning erkin savoli (matn yoki ovoz) — menyu tugmasi va buyruq bo'lmasa
  if (MGR && !st.step && (m.voice || m.audio || (text && !isMenuText(text) && text.charAt(0) !== '/'))) {
    return aiHandle(uid, chat, m, text, L, [m.from.first_name, m.from.last_name].filter(Boolean).join(' '));
  }
  if ((m.voice || m.audio) && !MGR) return send(chat, (AI_MSG[L] || AI_MSG.uz).onlyMgr, rec && rec.v[T.STATUS] === 'active' ? mainMenu(L) : removeKb());

  // Asosiy menyu (faqat active)
  if (!rec || rec.v[T.STATUS] !== 'active') {
    if (rec && rec.v[T.STATUS] === 'pending') return send(chat, MSG[L].still_pending);
    return send(chat, rec || st.lang ? MSG[L].not_registered : MSG.uz.not_registered + '\n' + MSG.ru.not_registered);
  }
  if (text === MSG.uz.btn_salary || text === MSG.ru.btn_salary) return showMonths(chat, rec, L);
  if (text === MSG.uz.btn_bonus || text === MSG.ru.btn_bonus) return showBonus(chat, rec, L);
  if (text === MSG.uz.btn_tabel || text === MSG.ru.btn_tabel) return showTabelMonths(chat, rec, L);
  if (text === MSG.uz.btn_me || text === MSG.ru.btn_me) return showMe(chat, rec, L);
  if (text === MSG.uz.btn_lang || text === MSG.ru.btn_lang) return send(chat, MSG[L].choose_lang, langKb());
  if (text === MSG.uz.btn_request || text === MSG.ru.btn_request) { setState(uid, { step: 'request', lang: L }); return send(chat, MSG[L].ask_request, backKb(L)); }
  return send(chat, MSG[L].menu, mainMenu(L));
}

function phoneKb(L) { return { keyboard: [[{ text: MSG[L].btn_phone, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true }; }

function stepPinfl(uid, chat, text, st) {
  var L = st.lang || 'uz';
  var pinfl = text.replace(/\s/g, '');
  if (!/^\d{14}$/.test(pinfl)) return send(chat, MSG[L].bad_pinfl);
  var fio = pinflInBase(pinfl);
  if (!fio) { logAction(uid, pinfl, 'pinfl_not_found'); return send(chat, MSG[L].no_pinfl); }
  var ex = findByPinfl(pinfl);
  if (ex && ex.v[T.TG_ID] && String(ex.v[T.TG_ID]) !== String(uid) && ex.v[T.STATUS] !== '') {
    logAction(uid, pinfl, 'pinfl_taken');
    setState(uid, { step: 'request', lang: L, pinfl: pinfl });
    return send(chat, MSG[L].taken + '\n\n' + MSG[L].ask_request, backKb(L));
  }
  setState(uid, { step: 'phone', lang: L, pinfl: pinfl, fio: fio });
  return send(chat, MSG[L].send_phone, phoneKb(L));
}

function stepPhone(uid, chat, m, st) {
  var L = st.lang, pinfl = st.pinfl, phone = normPhone(m.contact.phone_number);
  var name = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ');
  var username = m.from.username ? '@' + m.from.username : '';
  var sh = tgSheet();
  var ex = findByPinfl(pinfl);
  var hrPhone = ex ? normPhone(ex.v[T.HR_PHONE]) : '';
  var status = (hrPhone && hrPhone === phone) ? 'active' : 'pending';
  var row = [pinfl, ex ? ex.v[T.HR_PHONE] : '', String(uid), m.contact.phone_number, username, name, status, L, new Date()];
  if (ex) sh.getRange(ex.row, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
  clearState(uid);
  logAction(uid, pinfl, 'register_' + status);
  if (status === 'active') return send(chat, MSG[L].activated, mainMenu(L));
  send(chat, MSG[L].pending, removeKb());
  send(prop('ADMIN_ID'),
    '🆕 <b>Bog\'lash so\'rovi</b>\nПИНФЛ: <code>' + pinfl + '</code>\nF.I.O. (база): ' + st.fio +
    '\nTelegram: ' + name + ' ' + username + ' (ID ' + uid + ')\nTelefon: ' + m.contact.phone_number +
    '\nKadrlar tel: ' + (ex ? ex.v[T.HR_PHONE] : '—'),
    { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: 'ok:' + pinfl + ':' + uid }, { text: '❌ Rad etish', callback_data: 'no:' + pinfl + ':' + uid }]] });
}

function stepRequest(uid, chat, text, rec, L, m) {
  if (!text) return send(chat, MSG[L].ask_request, backKb(L));
  var st = getState(uid);
  var pinfl = rec ? String(rec.v[T.PINFL]).trim() : (st.pinfl || '—');
  clearState(uid);
  var fio = pinfl !== '—' ? (pinflInBase(pinfl) || '') : '';
  var from = m ? [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') + (m.from.username ? ' @' + m.from.username : '') : '';
  send(prop('ADMIN_ID'), '✉️ <b>Ariza</b>\n' + (fio ? esc(fio) + '\n' : '') + 'ПИНФЛ: <code>' + pinfl + '</code>\nDan: ' + esc(from) + ' (ID ' + uid + ')\n\n' + esc(text));
  logAction(uid, pinfl, 'request');
  return send(chat, MSG[L].request_sent, rec && rec.v[T.STATUS] === 'active' ? mainMenu(L) : removeKb());
}

// ---------- Callbacks ----------
// Tanlov qilingan inline xabarni "yopamiz": tugmalar olib tashlanadi, tanlangan variant yoziladi — eski tugmalar chalg'itmasin
function pickedLabel(q) {
  var kb = q.message && q.message.reply_markup && q.message.reply_markup.inline_keyboard || [];
  for (var i = 0; i < kb.length; i++) for (var j = 0; j < kb[i].length; j++) if (kb[i][j].callback_data === q.data) return kb[i][j].text;
  return '';
}
function closePicker(q) {
  try {
    var label = pickedLabel(q), base = q.message.text || '';
    tg('editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text: esc(base) + (label ? ' <b>' + esc(label) + '</b>' : ''), parse_mode: 'HTML' });
  } catch (e) {}
}
var PICKERS = { lang: 1, month: 1, tab: 1, mp: 1, ms: 1, mt: 1, mm: 1, mtab: 1 };
function handleCallback(q) {
  var uid = q.from.id, chat = q.message.chat.id, data = q.data || '';
  tg('answerCallbackQuery', { callback_query_id: q.id });
  var parts = data.split(':');
  if (PICKERS[parts[0]]) closePicker(q);
  var recQ = findByTgId(uid);
  MGR = isManager(recQ, uid);
  if (parts[0] === 'day' || parts[0] === 'mon' || parts[0] === 'mp' || parts[0] === 'ms' || parts[0] === 'mt' || parts[0] === 'mm' || parts[0] === 'mtab') {
    if (!MGR) return;
    var Lq = (recQ && recQ.v[T.LANG]) || 'uz';
    if (parts[0] === 'day') return send(chat, buildDailyReport(Lq, Number(parts[1])), mainMenu(Lq));
    if (parts[0] === 'mon') return send(chat, buildMonthlyReport(Lq, Number(parts[1])), mainMenu(Lq));
    if (parts[0] === 'mp') return send(chat, esc(pinflInBase(parts[1]) || '') + '\n' + MSG[Lq].what_show,
      { inline_keyboard: [[{ text: MSG[Lq].btn_salary, callback_data: 'ms:' + parts[1] }, { text: MSG[Lq].btn_tabel, callback_data: 'mt:' + parts[1] }]] });
    if (parts[0] === 'ms') { logAction(uid, parts[1], 'mgr_pick'); return send(chat, MSG[Lq].choose_month, monthsKb(parts[1], 'mm:' + parts[1]) || { inline_keyboard: [] }); }
    if (parts[0] === 'mt') return send(chat, MSG[Lq].choose_month, tabelMonthsKb(Lq, 'mtab:' + parts[1]));
    if (parts[0] === 'mtab') { logAction(uid, parts[1], 'mgr_tabel'); return send(chat, tabelReport(parts[1], Number(parts[2]), Lq), mainMenu(Lq)); }
    if (parts[0] === 'mm') { logAction(uid, parts[1], 'mgr_view'); return send(chat, reportFor(parts[1], Number(parts[2]), Lq) || MSG[Lq].no_data, mainMenu(Lq)); }
  }

  if (parts[0] === 'lang') {
    var L = parts[1]; var rec = findByTgId(uid);
    if (rec) { tgSheet().getRange(rec.row, T.LANG + 1).setValue(L); }
    if (rec && rec.v[T.STATUS] === 'active') return send(chat, MSG[L].menu, mainMenu(L));
    setState(uid, { step: 'pinfl', lang: L });
    return send(chat, MSG[L].hello, removeKb());
  }
  if (parts[0] === 'month') {
    var rec2 = findByTgId(uid);
    if (!rec2 || rec2.v[T.STATUS] !== 'active') return;
    return showReport(chat, rec2, parts[1]);
  }
  if (parts[0] === 'tab') {
    var rec3 = findByTgId(uid);
    if (!rec3 || rec3.v[T.STATUS] !== 'active') return;
    return showTabel(chat, rec3, parts[1]);
  }
  if (parts[0] === 'bc') {
    if (String(uid) !== String(prop('ADMIN_ID'))) return;
    if (parts[1] === 'yes') return doBroadcast(uid, chat, q.message.message_id);
    CacheService.getScriptCache().remove('bc_' + uid);
    return tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: '❌ Bekor qilindi' });
  }
  if (parts[0] === 'ok' || parts[0] === 'no') {
    if (String(uid) !== String(prop('ADMIN_ID'))) return;
    return withLock(function () { return adminDecide(parts, chat, q); });
  }
}
function adminDecide(parts, chat, q) {
  {
    var pinfl = parts[1], empId = parts[2];
    var ex = findByPinfl(pinfl);
    if (!ex || String(ex.v[T.TG_ID]) !== empId) return send(chat, 'So\'rov topilmadi (eskirgan).');
    var L2 = ex.v[T.LANG] || 'uz';
    if (parts[0] === 'ok') {
      tgSheet().getRange(ex.row, T.STATUS + 1).setValue('active');
      send(empId, MSG[L2].approved, mainMenu(L2, isManager(findByPinfl(pinfl), empId)));
      logAction(empId, pinfl, 'approved');
      tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: q.message.text + '\n\n✅ Tasdiqlandi' });
    } else {
      tgSheet().getRange(ex.row, T.TG_ID + 1, 1, 6).setValues([['', '', '', '', '', '']]);
      send(empId, MSG[L2].rejected);
      logAction(empId, pinfl, 'rejected');
      tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: q.message.text + '\n\n❌ Rad etildi' });
    }
  }
}

function adminUnlink(chat, text) {
  var pinfl = text.replace('/unlink', '').trim();
  var ex = findByPinfl(pinfl);
  if (!ex || !ex.v[T.TG_ID]) return send(chat, 'Bog\'lanish topilmadi: ' + pinfl);
  var empId = ex.v[T.TG_ID], L = ex.v[T.LANG] || 'uz';
  tgSheet().getRange(ex.row, T.TG_ID + 1, 1, 6).setValues([['', '', '', '', '', '']]);
  logAction(empId, pinfl, 'unlinked_by_admin');
  try { send(empId, MSG[L].unlinked, removeKb()); } catch (e) {}
  return send(chat, '🔓 Bog\'lanish bekor qilindi: ' + pinfl);
}

// ---------- Salary ----------
function rowsForPinfl(pinfl) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 27).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) if (String(vals[i][COL.PINFL]).trim() === pinfl) out.push(vals[i]);
  return out; // база tartibida (eskidan yangiga)
}
function monthsKb(pinfl, prefix) {
  var last = rowsForPinfl(pinfl).slice(-12).reverse();
  if (!last.length) return null;
  var kb = [];
  for (var i = 0; i < last.length; i += 2) {
    var line = [{ text: String(last[i][COL.PERIOD]), callback_data: prefix + ':' + i }];
    if (last[i + 1]) line.push({ text: String(last[i + 1][COL.PERIOD]), callback_data: prefix + ':' + (i + 1) });
    kb.push(line);
  }
  return { inline_keyboard: kb };
}
function reportFor(pinfl, idx, L) {
  var r = rowsForPinfl(pinfl).slice(-12).reverse()[idx];
  return r ? buildReport(r, L) : null;
}
function showMonths(chat, rec, L) {
  var kb = monthsKb(String(rec.v[T.PINFL]).trim(), 'month');
  if (!kb) return send(chat, MSG[L].no_data, mainMenu(L));
  return send(chat, MSG[L].choose_month, kb);
}
function showReport(chat, rec, idx) {
  var L = rec.v[T.LANG] || 'uz';
  var pinfl = String(rec.v[T.PINFL]).trim();
  var txt = reportFor(pinfl, Number(idx), L);
  if (!txt) return send(chat, MSG[L].no_data);
  logAction(rec.v[T.TG_ID], pinfl, 'view:' + idx);
  return send(chat, txt, mainMenu(L));
}

// ---------- Rahbar: xodim qidirish ----------
function stepMgrFind(uid, chat, text, L) {
  var q = normName(text);
  if (q.length < 3) return send(chat, MSG[L].ask_name, backKb(L));
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var vals = sh.getRange(2, COL.PINFL + 1, sh.getLastRow() - 1, 2).getValues();
  var seen = {}, found = [];
  for (var i = 0; i < vals.length; i++) {
    var p = String(vals[i][0]).trim(), fio = String(vals[i][1]).trim();
    if (seen[p]) continue;
    if (normName(fio).indexOf(q) >= 0) { seen[p] = 1; found.push({ p: p, fio: fio }); }
  }
  if (!found.length) return send(chat, MSG[L].no_match);
  clearState(uid);
  logAction(uid, '', 'mgr_search:' + text);
  var kb = found.slice(0, 10).map(function (f) { return [{ text: f.fio, callback_data: 'mp:' + f.p }]; });
  return send(chat, MSG[L].pick_emp, { inline_keyboard: kb });
}

// ---------- Rahbar: kunlik davomat ----------
function isSectionHeader(row) {
  if (row[0] !== '' || !row[TAB.FIO] || row[2] !== '') return false;
  for (var d = 0; d < 62; d++) if (row[TAB.DAY0 + d] !== '') return false;
  var t = String(row[TAB.FIO]).trim();
  return t.indexOf(':') >= 0 || t.split(/\s+/).length <= 2;
}
function buildDailyReport(L, daysAgo) {
  try {
    var dt = new Date(); dt.setDate(dt.getDate() - (daysAgo || 0));
    var midx = dt.getMonth(), day = dt.getDate();
    var sheet = tabelFile().getSheetByName(RU_MONTHS[midx]);
    var title = '<b>' + MSG[L].daily_title + ' — ' + (day < 10 ? '0' : '') + day + '.' + (midx < 9 ? '0' : '') + (midx + 1) + '.' + dt.getFullYear() + '</b>';
    if (!sheet) return title + '\n' + MSG[L].d_empty;
    var vals = sheet.getRange(1, 1, sheet.getLastRow(), 70).getValues();
    var col = TAB.DAY0 + (day - 1) * 2;
    var sections = [], cur = null, tot = { p: 0, a: 0, u: 0, n: 0 }, any = false;
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (i > 1 && String(r[TAB.FIO]).indexOf('Ф.И.О') === 0) break;
      if (!r[TAB.FIO]) continue;
      if (isSectionHeader(r)) { cur = { name: String(r[TAB.FIO]).replace(/\s+/g, ' ').trim(), p: 0, n: 0, u: 0, abs: [] }; sections.push(cur); continue; }
      if (!cur) { cur = { name: '—', p: 0, n: 0, u: 0, abs: [] }; sections.push(cur); }
      var mark = r[col], m = String(mark).trim().toLowerCase(), fio = String(r[TAB.FIO]).trim();
      cur.n++; tot.n++;
      if (mark !== '') any = true;
      if (m === '+' || typeof mark === 'number') { cur.p++; tot.p++; }
      else if (m === '/') { cur.p++; tot.p++; cur.abs.push(fio + ' (' + MSG[L].mark_half + ')'); }
      else if (m === '') { cur.u++; tot.u++; }
      else {
        var why = m === '-' ? MSG[L].mark_abs : (m === 'o' || m === 'о' || m === '0') ? MSG[L].mark_vac : (m === 'б' || m === 'b') ? MSG[L].mark_sick : (m === 'бс' || m === 'bs') ? MSG[L].mark_bs : m;
        cur.abs.push(fio + ' (' + why + ')'); tot.a++;
      }
    }
    if (!any) return title + '\n' + MSG[L].d_empty;
    var lines = [title, MSG[L].d_total + ': ' + tot.n + ' · ' + MSG[L].d_present + ' <b>' + tot.p + '</b> · ' + MSG[L].d_absent + ' <b>' + tot.a + '</b>' + (tot.u ? ' · ' + MSG[L].d_unmarked + ' ' + tot.u : ''), ''];
    sections.forEach(function (sct) {
      if (!sct.n) return;
      lines.push('<b>' + esc(sct.name) + '</b>: ' + sct.p + '/' + sct.n + (sct.u ? ' (' + MSG[L].d_unmarked + ' ' + sct.u + ')' : ''));
      sct.abs.forEach(function (a) { lines.push('  • ' + esc(a)); });
    });
    return lines.join('\n');
  } catch (e) {
    send(prop('ADMIN_ID'), '⚠️ Kunlik hisobot xatosi: ' + e);
    return MSG[L].tabel_err;
  }
}
// ---------- Rahbar: oylik yakun + TOP-10 ----------
function buildMonthlyReport(L, monthsAgo) {
  try {
    var dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (monthsAgo || 0));
    var midx = dt.getMonth(), title = '<b>' + MSG[L].m_title + ' — ' + MSG[L].months[midx] + ' ' + dt.getFullYear() + '</b>';
    var sheet = tabelFile().getSheetByName(RU_MONTHS[midx]);
    if (!sheet) return title + '\n' + MSG[L].tabel_nodata;
    var vals = sheet.getRange(1, 1, sheet.getLastRow(), 70).getValues();
    var sections = [], cur = null, emps = [], tot = { n: 0, w: 0, a: 0, v: 0, s: 0 }, any = false;
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      if (i > 1 && String(r[TAB.FIO]).indexOf('Ф.И.О') === 0) break;
      if (!r[TAB.FIO]) continue;
      if (isSectionHeader(r)) { cur = { name: String(r[TAB.FIO]).replace(/\s+/g, ' ').trim(), n: 0, w: 0, a: 0, v: 0, s: 0 }; sections.push(cur); continue; }
      if (!cur) { cur = { name: '—', n: 0, w: 0, a: 0, v: 0, s: 0 }; sections.push(cur); }
      var e = { fio: String(r[TAB.FIO]).trim(), sec: cur.name, w: 0, a: 0, v: 0, s: 0 };
      for (var d = 0; d < 31; d++) {
        var mark = r[TAB.DAY0 + d * 2], m = String(mark).trim().toLowerCase();
        if (mark !== '') any = true;
        if (m === '+' || typeof mark === 'number') e.w++;
        else if (m === '/') e.w += 0.5;
        else if (m === '-') e.a++;
        else if (m === 'o' || m === 'о' || m === '0') e.v++;
        else if (m === 'б' || m === 'b') e.s++;
      }
      emps.push(e);
      cur.n++; cur.w += e.w; cur.a += e.a; cur.v += e.v; cur.s += e.s;
      tot.n++; tot.w += e.w; tot.a += e.a; tot.v += e.v; tot.s += e.s;
    }
    if (!any) return title + '\n' + MSG[L].tabel_nodata;
    var lines = [title,
      MSG[L].m_emps + ': <b>' + tot.n + '</b> · ' + MSG[L].m_workdays + ': <b>' + fmtNum(tot.w, 0) + '</b>',
      MSG[L].m_abs + ': <b>' + tot.a + '</b> · ' + MSG[L].m_vac + ': ' + tot.v + ' · ' + MSG[L].m_sick + ': ' + tot.s, '', '<b>' + MSG[L].m_sections + '</b>'];
    sections.forEach(function (sc) {
      if (!sc.n) return;
      lines.push(esc(sc.name) + ': ' + sc.n + ' ' + MSG[L].m_emp + ' · ' + fmtNum(sc.w, 0) + ' ' + MSG[L].t_days + ' · ' + MSG[L].m_abs + ' ' + sc.a + (sc.v ? ' · ' + MSG[L].m_vac + ' ' + sc.v : '') + (sc.s ? ' · ' + MSG[L].m_sick + ' ' + sc.s : ''));
    });
    lines.push('', '<b>' + MSG[L].m_top + '</b>');
    var top = emps.filter(function (e) { return e.a > 0; }).sort(function (a, b) { return b.a - a.a || a.fio.localeCompare(b.fio); }).slice(0, 10);
    if (!top.length) lines.push(MSG[L].m_noabs);
    top.forEach(function (e, i) { lines.push((i + 1) + '. ' + esc(e.fio) + ' (' + esc(e.sec) + ') — <b>' + e.a + '</b> ' + MSG[L].t_days); });
    return lines.join('\n');
  } catch (e) {
    send(prop('ADMIN_ID'), '⚠️ Oylik hisobot xatosi: ' + e);
    return MSG[L].tabel_err;
  }
}
function managerTargets() {
  var targets = [{ id: prop('ADMIN_ID'), L: 'uz' }];
  tgRows().forEach(function (r) {
    if (r[T.TG_ID] && r[T.STATUS] === 'active' && String(r[T.ROLE] || '').trim() !== '' && String(r[T.TG_ID]) !== String(prop('ADMIN_ID')))
      targets.push({ id: String(r[T.TG_ID]), L: r[T.LANG] || 'uz' });
  });
  return targets;
}
/** Trigger: har oyning 2-sanasida o'tgan oy yakuni + TOP-10 */
function monthlyReport() {
  var cache = {};
  managerTargets().forEach(function (t) {
    if (!cache[t.L]) cache[t.L] = buildMonthlyReport(t.L, 1);
    try { send(t.id, cache[t.L]); } catch (e) {}
  });
}
/** Log varag'ini tozalash: LOG_KEEP_DAYS dan eski yoki LOG_MAX_ROWS dan ortiq eng eski qatorlar o'chiriladi */
function cleanLog() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
  if (!sh || sh.getLastRow() < 3) return;
  var n = sh.getLastRow() - 1;
  var dates = sh.getRange(2, 1, n, 1).getValues();
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - LOG_KEEP_DAYS);
  var del = 0;
  while (del < n && dates[del][0] instanceof Date && dates[del][0] < cutoff) del++;
  if (n - del > LOG_MAX_ROWS) del = n - LOG_MAX_ROWS;
  if (del > 0) sh.deleteRows(2, del);
}

/** Trigger uchun: har kuni REPORT_HOUR da admin va barcha rahbarlarga yuboradi. installTriggers() ni bir marta ishga tushiring. */
function dailyReport() {
  try { cleanLog(); } catch (e) {}
  var cache = {};
  managerTargets().forEach(function (t) {
    if (!cache[t.L]) cache[t.L] = buildDailyReport(t.L, 0);
    try { send(t.id, cache[t.L]); } catch (e) {}
  });
}
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'dailyReport' || f === 'monthlyReport' || f === 'warmApiCache') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyReport').timeBased().atHour(REPORT_HOUR).everyDays(1).create();
  ScriptApp.newTrigger('monthlyReport').timeBased().onMonthDay(2).atHour(REPORT_HOUR).create();
  ScriptApp.newTrigger('warmApiCache').timeBased().everyMinutes(WARM_MINUTES).create();
  warmApiCache();
  Logger.log('Triggerlar o\'rnatildi: har kuni va har oyning 2-sanasida, soat ' + REPORT_HOUR + '; API keshi har ' + WARM_MINUTES + ' daqiqada');
}
/** Mini App uchun eng ko'p so'raladigan ma'lumotlarni oldindan hisoblab keshga yozadi — dashboard darhol ochiladi */
function warmApiCache() {
  var c = CacheService.getScriptCache(), items = {};
  try { items['api_months'] = tabelMonthSheets(tabelFile()).map(function (m) { return m.idx; }); } catch (e) {}
  try { items['api_daily:0'] = dailyData(0); } catch (e) {}
  try { items['api_daily:1'] = dailyData(1); } catch (e) {}
  try { items['api_monthly:0'] = monthlyData(0); } catch (e) {}
  try { items['api_monthly:1'] = monthlyData(1); } catch (e) {}
  Object.keys(items).forEach(function (k) { try { c.put(k, JSON.stringify(items[k]), API_CACHE_SEC); } catch (e) {} });
}
function installDailyTrigger() { installTriggers(); }
function buildReport(r, L) {
  var lines = ['<b>' + MSG[L].report_title + ' — ' + esc(String(r[COL.PERIOD])) + '</b>', esc(String(r[COL.FIO])), ''];
  SHOW.forEach(function (c) {
    var v = r[c.i];
    var s = c.days ? fmtNum(v, 2) + ' ' + MSG[L].days : fmtNum(v, 0) + ' ' + MSG[L].sum;
    var label = c[L] + ': ';
    lines.push(c.bold ? '<b>' + label + s + '</b>' : label + s);
  });
  return lines.join('\n');
}
// ---------- Shaxsiy ma'lumot ----------
function parseDate(v) {
  if (v instanceof Date) return v;
  var m = String(v || '').trim().match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = String(v || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function tenure(from, to, L) {
  var y = to.getFullYear() - from.getFullYear(), mo = to.getMonth() - from.getMonth(), d = to.getDate() - from.getDate();
  if (d < 0) { mo--; d += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
  if (mo < 0) { y--; mo += 12; }
  if (y < 0) return '—';
  var parts = [];
  if (y) parts.push(y + ' ' + MSG[L].y);
  if (mo) parts.push(mo + ' ' + MSG[L].mo);
  parts.push(d + ' ' + MSG[L].d);
  return parts.join(' ');
}
function showMe(chat, rec, L) {
  var pinfl = String(rec.v[T.PINFL]).trim();
  var rows = rowsForPinfl(pinfl);
  if (!rows.length) return send(chat, MSG[L].no_data, mainMenu(L));
  var r = rows[rows.length - 1]; // eng oxirgi oy qatori
  var hired = parseDate(r[5]), today = new Date();
  var hiredStr = hired ? Utilities.formatDate(hired, Session.getScriptTimeZone(), 'dd.MM.yyyy') : esc(String(r[5] || '—'));
  var lines = ['<b>' + MSG[L].me_title + '</b>', '',
    MSG[L].me_fio + ': <b>' + esc(String(r[COL.FIO])) + '</b>',
    'ПИНФЛ: <code>' + pinfl + '</code>',
    MSG[L].me_pos + ': ' + esc(String(r[4] || '—')) + (r[3] ? ' (' + esc(String(r[3])) + ')' : ''),
    MSG[L].me_hired + ': ' + hiredStr,
    MSG[L].me_tenure + ': <b>' + (hired ? tenure(hired, today, L) : '—') + '</b>',
    MSG[L].me_salary + ': <b>' + fmtNum(r[8], 0) + ' ' + MSG[L].sum + '</b>',
    '', '<i>' + MSG[L].me_asof + ': ' + esc(String(r[COL.PERIOD])) + '</i>'];
  logAction(rec.v[T.TG_ID], pinfl, 'me');
  return send(chat, lines.join('\n'), mainMenu(L));
}

// ---------- Bonus (надбавка) ----------
// Ustunlar: A ПИНФЛ, B ФИО, ... G,H,I = 1-chorak oylari, J = 1-кв итог, K,L,M / N, O,P,Q / R, S,T,U / V, W = Итог
function showBonus(chat, rec, L) {
  var pinfl = String(rec.v[T.PINFL]).trim();
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BONUS);
  if (!sh || sh.getLastRow() < 2) return send(chat, MSG[L].no_bonus, mainMenu(L));
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 23).getValues();
  var r = null;
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === pinfl) { r = vals[i]; break; }
  if (!r) return send(chat, MSG[L].no_bonus, mainMenu(L));
  var lines = ['<b>' + MSG[L].bonus_title + ' — ' + BONUS_YEAR + '</b>', esc(String(r[1])), ''];
  var any = false;
  for (var q = 0; q < 4; q++) {
    var base = 6 + q * 4; // 6,10,14,18
    var mLines = [];
    for (var m = 0; m < 3; m++) {
      var v = r[base + m];
      if (v === '' || v === null) continue;
      mLines.push('  ' + MSG[L].months[q * 3 + m] + ': ' + fmtNum(v, 0) + ' ' + MSG[L].sum);
    }
    if (!mLines.length) continue;
    any = true;
    lines.push('<b>' + (q + 1) + MSG[L].quarter + '</b>');
    lines = lines.concat(mLines);
    lines.push('  <b>' + MSG[L].q_total + ': ' + fmtNum(r[base + 3], 0) + ' ' + MSG[L].sum + '</b>', '');
  }
  if (!any) return send(chat, MSG[L].no_bonus, mainMenu(L));
  lines.push('<b>' + MSG[L].y_total + ': ' + fmtNum(r[22], 0) + ' ' + MSG[L].sum + '</b>');
  logAction(rec.v[T.TG_ID], pinfl, 'bonus');
  return send(chat, lines.join('\n'), mainMenu(L));
}

// ---------- Табель (davomat) ----------
function normName(s) {
  return String(s || '').toLowerCase().replace(/[^a-zа-яёўқғҳ]/g, '');
}
function tabelFile() {
  var id = prop('TABEL_ID');
  if (!id) throw new Error('TABEL_ID script property yo\'q');
  return SpreadsheetApp.openById(id);
}
function tabelMonthSheets(ss) { // [{name, idx}] mavjud oylar, oxirgisi birinchi
  var out = [];
  ss.getSheets().forEach(function (sh) {
    var i = RU_MONTHS.indexOf(sh.getName().trim());
    if (i >= 0) out.push({ name: sh.getName(), idx: i });
  });
  return out.sort(function (a, b) { return b.idx - a.idx; });
}
function tabelNameFor(pinfl) { // "ФИО табель" varag'i, bo'lmasa база dagi ism
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAMES);
  if (sh && sh.getLastRow() > 1) {
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === pinfl) return String(v[i][2] || v[i][1]);
  }
  return pinflInBase(pinfl) || '';
}
function findTabelRow(sheet, name) {
  var n = normName(name); if (!n) return null;
  var vals = sheet.getRange(1, 1, sheet.getLastRow(), 70).getValues();
  for (var i = 1; i < vals.length; i++) {
    if (i > 1 && String(vals[i][TAB.FIO]).indexOf('Ф.И.О') === 0) break; // pastdagi yakun jadvali
    if (normName(vals[i][TAB.FIO]) === n) return vals[i];
  }
  return null;
}
function tabelMonthsKb(L, prefix) {
  var months = tabelMonthSheets(tabelFile());
  var kb = [];
  for (var i = 0; i < months.length; i += 2) {
    var line = [{ text: MSG[L].months[months[i].idx], callback_data: prefix + ':' + months[i].idx }];
    if (months[i + 1]) line.push({ text: MSG[L].months[months[i + 1].idx], callback_data: prefix + ':' + months[i + 1].idx });
    kb.push(line);
  }
  return { inline_keyboard: kb };
}
function showTabelMonths(chat, rec, L) {
  try {
    var kb = tabelMonthsKb(L, 'tab');
    if (!kb.inline_keyboard.length) return send(chat, MSG[L].tabel_err, mainMenu(L));
    return send(chat, MSG[L].choose_month, kb);
  } catch (e) {
    send(prop('ADMIN_ID'), '⚠️ Табель xatosi: ' + e);
    return send(chat, MSG[L].tabel_err, mainMenu(L));
  }
}
function showTabel(chat, rec, midx) {
  var L = rec.v[T.LANG] || 'uz';
  var pinfl = String(rec.v[T.PINFL]).trim();
  logAction(rec.v[T.TG_ID], pinfl, 'tabel:' + RU_MONTHS[midx]);
  return send(chat, tabelReport(pinfl, Number(midx), L), mainMenu(L));
}
function tabelReport(pinfl, midx, L) {
  try {
    var ss = tabelFile();
    var sheet = ss.getSheetByName(RU_MONTHS[midx]);
    if (!sheet) return MSG[L].tabel_nodata;
    var name = tabelNameFor(pinfl);
    var r = findTabelRow(sheet, name);
    if (!r) return MSG[L].tabel_none;
    var st = { worked: 0, half: 0, vac: 0, sick: 0, bs: 0, absent: [], extra: 0, any: false };
    for (var d = 0; d < 31; d++) {
      var mark = r[TAB.DAY0 + d * 2], hrs = r[TAB.DAY0 + d * 2 + 1];
      if (mark !== '' && mark !== null) st.any = true;
      var m = String(mark).trim().toLowerCase();
      if (m === '+' || (typeof mark === 'number')) st.worked++;
      else if (m === '/') st.half++;
      else if (m === 'o' || m === 'о' || m === '0') st.vac++;
      else if (m === 'б' || m === 'b') st.sick++;
      else if (m === 'бс' || m === 'bs') st.bs++;
      else if (m === '-') st.absent.push(d + 1);
      if (typeof hrs === 'number') st.extra += hrs;
    }
    if (!st.any) return MSG[L].tabel_nodata;
    var days = (typeof r[TAB.DAYS] === 'number') ? r[TAB.DAYS] : st.worked;
    var extra = (typeof r[TAB.EXTRA] === 'number') ? r[TAB.EXTRA] : st.extra;
    var lines = ['<b>' + MSG[L].tabel_title + ' — ' + MSG[L].months[midx] + ' ' + BONUS_YEAR + '</b>', esc(name), '',
      MSG[L].t_worked + ': <b>' + fmtNum(days, 0) + '</b> ' + MSG[L].t_days + ' · ' + MSG[L].t_extra + ': <b>' + fmtNum(extra, 0) + '</b>',
      MSG[L].t_vac + ': ' + st.vac + ' · ' + MSG[L].t_sick + ': ' + st.sick + ' · ' + MSG[L].t_bs + ': ' + st.bs + (st.half ? ' · ' + MSG[L].t_half + ': ' + st.half : ''),
      MSG[L].t_absent + ': <b>' + st.absent.length + '</b>'];
    if (st.absent.length) {
      var dd = String(Number(midx) + 1); if (dd.length < 2) dd = '0' + dd;
      lines.push(MSG[L].t_absent_days + ': ' + st.absent.map(function (x) { return (x < 10 ? '0' : '') + x + '.' + dd; }).join(', '));
    }
    return lines.join('\n');
  } catch (e) {
    send(prop('ADMIN_ID'), '⚠️ Табель xatosi: ' + e);
    return MSG[L].tabel_err;
  }
}

/** Bir marta ishga tushiring: "ФИО табель" varag'ini yaratadi va база dagi har bir xodim uchun
 *  Табельдаги ismni avtomatik topishga harakat qiladi. D ustunida "НЕ НАЙДЕН" bo'lganlarga C ni qo'lda yozing. */
function setupTabelNames() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAMES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAMES);
    sh.getRange(1, 1, 1, 4).setValues([['ПИНФЛ', 'ФИО (ЗП)', 'ФИО табель', 'Статус']]).setFontWeight('bold');
    sh.getRange('A:A').setNumberFormat('@'); sh.setFrozenRows(1);
  }
  var existing = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) { existing[String(r[0]).trim()] = r; });
  var base = ss.getSheetByName(SHEET_BASE);
  var bv = base.getRange(2, 2, base.getLastRow() - 1, 2).getValues();
  var people = {}; bv.forEach(function (r) { var p = String(r[0]).trim(); if (p && !people[p]) people[p] = String(r[1]).trim(); });
  // Табельдаги barcha ismlar (barcha oy varaqlaridan)
  var tabNames = {};
  tabelMonthSheets(tabelFile()).forEach(function (m) {
    var sheet = tabelFile().getSheetByName(m.name);
    var vals = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
    for (var i = 1; i < vals.length; i++) {
      if (i > 1 && String(vals[i][1]).indexOf('Ф.И.О') === 0) break;
      if (vals[i][1] && String(vals[i][1]).split(/\s+/).length >= 2 && String(vals[i][1]).indexOf(':') < 0) tabNames[normName(vals[i][1])] = String(vals[i][1]).trim();
    }
  });
  var keys = Object.keys(tabNames), out = [];
  Object.keys(people).forEach(function (p) {
    var fio = people[p], n = normName(fio);
    if (existing[p] && existing[p][2]) { out.push([p, fio, existing[p][2], 'ручной']); return; }
    if (tabNames[n]) { out.push([p, fio, tabNames[n], 'авто']); return; }
    var best = null, bestD = 99;
    keys.forEach(function (k) { var d = lev(n, k); if (d < bestD) { bestD = d; best = k; } });
    if (best && bestD <= 4) out.push([p, fio, tabNames[best], 'ПРОВЕРИТЬ (' + bestD + ')']);
    else out.push([p, fio, '', 'НЕ НАЙДЕН']);
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  sh.getRange(2, 1, out.length, 4).setValues(out);
  Logger.log(out.length + ' xodim; qarang: ' + SHEET_NAMES);
}
function lev(a, b) {
  var m = a.length, n = b.length, prev = [], cur = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    cur = [i];
    for (var k = 1; k <= n; k++) cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function fmtNum(v, dec) {
  var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s|\u00a0/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  var neg = n < 0; n = Math.abs(n);
  var parts = n.toFixed(dec).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  var s = dec ? parts[0] + ',' + parts[1] : parts[0];
  return (neg ? '-' : '') + s;
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// =====================================================================
// Mini App API (rahbar dashboardi). So'rov: POST JSON {api:'daily', initData:'...', ...}
// =====================================================================
function apiResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function hex(bytes) { return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length < 2 ? '0' + h : h; }).join(''); }
/** Telegram initData ni tekshiradi (HMAC-SHA256, bot token bilan). Foydalanuvchi obyektini yoki null qaytaradi. */
function verifyInitData(initData) {
  if (!initData) return null;
  var pairs = initData.split('&'), data = {}, hash = '';
  pairs.forEach(function (p) {
    var i = p.indexOf('='); if (i < 0) return;
    var k = decodeURIComponent(p.slice(0, i)), v = decodeURIComponent(p.slice(i + 1).replace(/\+/g, '%20'));
    if (k === 'hash') hash = v; else data[k] = v;
  });
  if (!hash) return null;
  var check = Object.keys(data).sort().map(function (k) { return k + '=' + data[k]; }).join('\n');
  var secret = Utilities.computeHmacSha256Signature(Utilities.newBlob(prop('BOT_TOKEN')).getBytes(), Utilities.newBlob('WebAppData').getBytes());
  var sig = hex(Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(), secret));
  if (sig !== hash) return null;
  if (Date.now() / 1000 - Number(data.auth_date) > 86400) return null; // 24 soatdan eski
  try { return JSON.parse(data.user); } catch (e) { return null; }
}
function handleApi(req) {
  var user = verifyInitData(req.initData);
  if (!user) return { ok: false, error: 'auth' };
  var uid = user.id;
  // Rahbarlik tekshiruvi 10 daqiqa keshlanadi — har so'rovda Telegram varag'ini o'qimaymiz
  var who = cached('who:' + uid, function () { var r = findByTgId(uid); return { mgr: isManager(r, uid), lang: r ? r.v[T.LANG] : '' }; }, 600);
  if (!who.mgr) return { ok: false, error: 'forbidden' };
  var L = who.lang || (user.language_code === 'ru' ? 'ru' : 'uz');
  try {
    switch (req.api) {
      case 'init': case 'boot': {
        var months = cached('months', function () { return tabelMonthSheets(tabelFile()).map(function (m) { return m.idx; }); });
        var today = new Date();
        var res = { ok: true, lang: L, name: user.first_name || '', today: [today.getFullYear(), today.getMonth(), today.getDate()], tabelMonths: months, version: BOT_VERSION };
        if (req.api === 'boot') res.daily = cached('daily:0', function () { return dailyData(0); }); // bitta so'rovda ikkalasi
        return res;
      }
      case 'daily': return { ok: true, data: cached('daily:' + (req.daysAgo || 0), function () { return dailyData(Number(req.daysAgo || 0)); }) };
      case 'monthly': return { ok: true, data: cached('monthly:' + (req.monthsAgo || 0), function () { return monthlyData(Number(req.monthsAgo || 0)); }) };
      case 'search': { logAction(uid, '', 'api_search:' + req.q); return { ok: true, data: searchEmployees(req.q) }; }
      case 'salary': { logAction(uid, req.pinfl, 'api_salary'); return { ok: true, data: salaryData(req.pinfl) }; }
      case 'tabel': { logAction(uid, req.pinfl, 'api_tabel'); return { ok: true, data: cached('tabel:' + req.pinfl + ':' + req.midx, function () { return tabelData(req.pinfl, Number(req.midx)); }) }; }
      default: return { ok: false, error: 'unknown' };
    }
  } catch (e) {
    send(prop('ADMIN_ID'), '⚠️ API xatosi (' + req.api + '): ' + e);
    return { ok: false, error: 'server', message: String(e) };
  }
}
function cached(key, fn, sec) {
  var c = CacheService.getScriptCache(), v = c.get('api_' + key);
  if (v) return JSON.parse(v);
  var data = fn();
  try { c.put('api_' + key, JSON.stringify(data), sec || API_CACHE_SEC); } catch (e) {} // 100KB dan katta bo'lsa keshlanmaydi
  return data;
}
function markKind(mark) { // 'w' ishlagan, 'h' yarim, 'a' прогул, 'v' ta'til, 's' kasal, 'b' Бс, 'u' belgilanmagan, 'x' boshqa
  if (mark === '' || mark === null) return 'u';
  if (typeof mark === 'number') return 'w';
  var m = String(mark).trim().toLowerCase();
  if (m === '+') return 'w'; if (m === '/') return 'h'; if (m === '-') return 'a';
  if (m === 'o' || m === 'о' || m === '0') return 'v'; if (m === 'б' || m === 'b') return 's'; if (m === 'бс' || m === 'bs') return 'b';
  return 'x';
}
function tabelRows(sheet) { // [{sec, fio, row}] xodimlar
  var vals = sheet.getRange(1, 1, sheet.getLastRow(), 70).getValues(), out = [], cur = '—';
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (i > 1 && String(r[TAB.FIO]).indexOf('Ф.И.О') === 0) break;
    if (!r[TAB.FIO]) continue;
    if (isSectionHeader(r)) { cur = String(r[TAB.FIO]).replace(/\s+/g, ' ').trim(); continue; }
    out.push({ sec: cur, fio: String(r[TAB.FIO]).trim(), row: r });
  }
  return out;
}
function dailyData(daysAgo) {
  var dt = new Date(); dt.setDate(dt.getDate() - daysAgo);
  var midx = dt.getMonth(), day = dt.getDate(), out = { date: [dt.getFullYear(), midx, day], filled: false, total: { n: 0, w: 0, a: 0, u: 0 }, sections: [] };
  var sheet = tabelFile().getSheetByName(RU_MONTHS[midx]);
  if (!sheet) return out;
  var col = TAB.DAY0 + (day - 1) * 2, bySec = {};
  tabelRows(sheet).forEach(function (e) {
    var k = markKind(e.row[col]);
    if (!bySec[e.sec]) { bySec[e.sec] = { name: e.sec, n: 0, w: 0, a: 0, u: 0, people: [] }; out.sections.push(bySec[e.sec]); }
    var sc = bySec[e.sec]; sc.n++; out.total.n++;
    if (k !== 'u') out.filled = true;
    if (k === 'w') { sc.w++; out.total.w++; }
    else if (k === 'h') { sc.w++; out.total.w++; sc.people.push({ fio: e.fio, k: 'h' }); }
    else if (k === 'u') { sc.u++; out.total.u++; }
    else { sc.a++; out.total.a++; sc.people.push({ fio: e.fio, k: k, raw: String(e.row[col]) }); }
  });
  return out;
}
function monthlyData(monthsAgo) {
  var dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - monthsAgo);
  var midx = dt.getMonth(), out = { month: [dt.getFullYear(), midx], filled: false, total: { n: 0, w: 0, a: 0, v: 0, s: 0 }, sections: [], top: [] };
  var sheet = tabelFile().getSheetByName(RU_MONTHS[midx]);
  if (!sheet) return out;
  var bySec = {}, emps = [];
  tabelRows(sheet).forEach(function (e) {
    var c = { fio: e.fio, sec: e.sec, w: 0, a: 0, v: 0, s: 0 };
    for (var d = 0; d < 31; d++) {
      var k = markKind(e.row[TAB.DAY0 + d * 2]);
      if (k !== 'u') out.filled = true;
      if (k === 'w') c.w++; else if (k === 'h') c.w += 0.5; else if (k === 'a') c.a++; else if (k === 'v') c.v++; else if (k === 's') c.s++;
    }
    if (!bySec[e.sec]) { bySec[e.sec] = { name: e.sec, n: 0, w: 0, a: 0, v: 0, s: 0 }; out.sections.push(bySec[e.sec]); }
    var sc = bySec[e.sec]; sc.n++; sc.w += c.w; sc.a += c.a; sc.v += c.v; sc.s += c.s;
    out.total.n++; out.total.w += c.w; out.total.a += c.a; out.total.v += c.v; out.total.s += c.s;
    emps.push(c);
  });
  out.top = emps.filter(function (e) { return e.a > 0; }).sort(function (a, b) { return b.a - a.a || a.fio.localeCompare(b.fio); }).slice(0, 10);
  return out;
}
function searchEmployees(q) {
  var n = normName(q); if (n.length < 2) return [];
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues(), seen = {}, out = [];
  for (var i = vals.length - 1; i >= 0; i--) { // oxirgi oydan boshlab — lavozim eng yangisi
    var p = String(vals[i][COL.PINFL]).trim(), fio = String(vals[i][COL.FIO]).trim();
    if (seen[p] || normName(fio).indexOf(n) < 0) continue;
    seen[p] = 1; out.push({ pinfl: p, fio: fio, pos: String(vals[i][4] || ''), period: String(vals[i][COL.PERIOD]) });
    if (out.length >= 20) break;
  }
  return out;
}
function salaryData(pinfl) {
  var rows = rowsForPinfl(String(pinfl)).slice(-12).reverse();
  return { fio: rows.length ? String(rows[0][COL.FIO]) : '', columns: SHOW.map(function (c) { return { uz: c.uz, ru: c.ru, days: !!c.days }; }),
    months: rows.map(function (r) { return { period: String(r[COL.PERIOD]), values: SHOW.map(function (c) { var v = r[c.i]; return typeof v === 'number' ? v : (parseFloat(String(v).replace(/\s|\u00a0/g, '').replace(',', '.')) || 0); }) }; }) };
}
function tabelData(pinfl, midx) {
  var sheet = tabelFile().getSheetByName(RU_MONTHS[midx]);
  var name = tabelNameFor(String(pinfl)), out = { midx: midx, name: name, found: false, days: [], w: 0, h: 0, a: 0, v: 0, s: 0, b: 0, extra: 0, totalDays: null };
  if (!sheet) return out;
  var r = findTabelRow(sheet, name);
  if (!r) return out;
  out.found = true;
  for (var d = 0; d < 31; d++) {
    var mark = r[TAB.DAY0 + d * 2], hrs = r[TAB.DAY0 + d * 2 + 1], k = markKind(mark);
    out.days.push({ d: d + 1, k: k, raw: mark === '' ? '' : String(mark), hrs: typeof hrs === 'number' ? hrs : 0 });
    if (k === 'w') out.w++; else if (k === 'h') out.h++; else if (k === 'a') out.a++; else if (k === 'v') out.v++; else if (k === 's') out.s++; else if (k === 'b') out.b++;
    if (typeof hrs === 'number') out.extra += hrs;
  }
  if (typeof r[TAB.DAYS] === 'number') out.totalDays = r[TAB.DAYS];
  if (typeof r[TAB.EXTRA] === 'number') out.extra = r[TAB.EXTRA];
  return out;
}

// =====================================================================
// AI yordamchi (rahbarlar uchun): erkin matn yoki ovozli savol → OpenAI → jadval funksiyalari → javob.
// Raqamlar faqat jadvaldan olinadi; model qaysi funksiyani chaqirishni tanlaydi.
// Script properties: OPENAI_API_KEY (majburiy), AI_MODEL (ixtiyoriy, standart gpt-4o-mini), AI_STT_MODEL (standart gpt-4o-mini-transcribe)
// =====================================================================
var AI_MAX_STEPS = 6, AI_HIST_TURNS = 8, AI_HIST_SEC = 1800;
var AI_MSG = {
  uz: { off: "AI yordamchi sozlanmagan (OPENAI_API_KEY yo'q).", err: "AI yordamchi hozir javob bera olmadi. Qayta urinib ko'ring yoki menyudan foydalaning.",
        heard: "🎙 ", noVoice: "Ovozli xabar tushunilmadi. Qayta yozib yuboring yoki matn yozing.", onlyMgr: "Erkin savollar faqat rahbarlar uchun. Menyudan foydalaning." },
  ru: { off: "AI-помощник не настроен (нет OPENAI_API_KEY).", err: "AI-помощник сейчас не смог ответить. Повторите или воспользуйтесь меню.",
        heard: "🎙 ", noVoice: "Голосовое сообщение не распознано. Повторите или напишите текстом.", onlyMgr: "Свободные вопросы только для руководителей. Воспользуйтесь меню." }
};
function aiEnabled() { return !!prop('OPENAI_API_KEY'); }

// ---- Lotin → kirill transliteratsiya (ism qidirish uchun; база dagi F.I.O. kirillda) ----
var LAT_CYR = [['sh','ш'],['ch','ч'],['yo','ё'],['yu','ю'],['ya','я'],['ye','е'],['ts','ц'],["o'",'ў'],['oʻ','ў'],['o‘','ў'],["g'",'ғ'],['gʻ','ғ'],['g‘','ғ'],
  ['a','а'],['b','б'],['d','д'],['e','е'],['f','ф'],['g','г'],['h','ҳ'],['i','и'],['j','ж'],['k','к'],['l','л'],['m','м'],['n','н'],['o','о'],['p','п'],['q','қ'],['r','р'],['s','с'],['t','т'],['u','у'],['v','в'],['x','х'],['y','й'],['z','з'],["'",''],['ʼ','']];
function latToCyr(s) {
  s = String(s || '').toLowerCase(); var out = '', i = 0;
  while (i < s.length) {
    var hit = false;
    for (var k = 0; k < LAT_CYR.length; k++) { var p = LAT_CYR[k][0]; if (s.substr(i, p.length) === p) { out += LAT_CYR[k][1]; i += p.length; hit = true; break; } }
    if (!hit) { out += s[i]; i++; }
  }
  return out.replace(/ийе/g, 'ие').replace(/([аеёиоуўэюя])йе/g, '$1е').replace(/ий([аеёиоуўэюя])/g, 'и$1');
}
// Ikkala alifbo va imlo variantlarini bir xil kalitga keltiradi: lotin→kirill, keyin ҳ/х/г, ў/у, қ/к, ғ/г, ё/е, й/и, э/е farqlari yo'qotiladi
function nameKey(s) {
  var k = normName(/[a-z]/i.test(String(s)) ? latToCyr(s) : s);
  return k.replace(/ҳ/g, 'х').replace(/ў/g, 'у').replace(/қ/g, 'к').replace(/ғ/g, 'г').replace(/ё/g, 'е').replace(/э/g, 'е').replace(/й/g, 'и').replace(/ь|ъ/g, '');
}
// Xodimni ism bo'yicha topish: token darajasida boshlanish yoki Levenshtein ≤ 2 (ism qisqartmalari va imlo xatolariga chidamli)
function aiFindEmployees(query) {
  var qTok = String(query || '').split(/[\s,.]+/).map(nameKey).filter(function (t) { return t.length >= 2; });
  if (!qTok.length) return [];
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BASE);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues(), seen = {}, out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var p = String(vals[i][COL.PINFL]).trim(), fio = String(vals[i][COL.FIO]).trim();
    if (!p || seen[p]) continue; seen[p] = 1;
    var fTok = fio.split(/[\s,.]+/).map(nameKey).filter(Boolean), score = 0;
    qTok.forEach(function (q) {
      var best = 0;
      fTok.forEach(function (f) {
        var s = 0;
        if (f === q) s = 3; else if (f.indexOf(q) === 0 || q.indexOf(f) === 0) s = 2;
        else if (q.length >= 5 && f.length >= 5 && q[0] === f[0] && lev(q, f) <= (Math.min(q.length, f.length) >= 7 ? 2 : 1)) s = 1; // imlo xatosi: bosh harf bir xil
        if (s > best) best = s;
      });
      score += best;
    });
    if (score >= Math.min(2, qTok.length * 1)) out.push({ pinfl: p, fio: fio, position: String(vals[i][4] || ''), score: score });
  }
  out.sort(function (a, b) { return b.score - a.score; });
  return out.slice(0, 8).map(function (e) { return { pinfl: e.pinfl, fio: e.fio, position: e.position }; });
}
// ---- Asboblar (tools) — model chaqiradi, natija JSON ----
var AI_TOOLS = [
  { type: 'function', function: { name: 'find_employee', description: 'Xodimni familiya/ism bo\'yicha topadi (lotin yoki kirill, taxminiy yozilish ham bo\'ladi). Har qanday xodim haqidagi savol oldidan chaqiring. Bir nechta natija bo\'lsa — foydalanuvchidan aniqlashtiring.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Familiya va/yoki ism' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'get_salary', description: 'Xodimning oylik ma\'lumoti (reja/fakt kunlar, oklad, hisoblangan, mukofot, ta\'til, kasallik, kompensatsiya, JAMI). Davr berilmasa — eng oxirgi oy. Mavjud davrlar ro\'yxati ham qaytadi.',
      parameters: { type: 'object', properties: { pinfl: { type: 'string' }, period: { type: 'string', description: 'Masalan "август 2026", "avgust", "2026-08". Ixtiyoriy.' } }, required: ['pinfl'] } } },
  { type: 'function', function: { name: 'get_employee_info', description: 'Xodim haqida: lavozim, toifa, ishga qabul sanasi, ish staji, oklad.',
      parameters: { type: 'object', properties: { pinfl: { type: 'string' } }, required: ['pinfl'] } } },
  { type: 'function', function: { name: 'get_bonus', description: 'Xodimning qo\'shimcha to\'lovi (надбавка) — oylar va choraklar bo\'yicha, yil jami.',
      parameters: { type: 'object', properties: { pinfl: { type: 'string' } }, required: ['pinfl'] } } },
  { type: 'function', function: { name: 'get_employee_attendance', description: 'Xodimning bir oylik davomati (табель): ishlangan kunlar, qo\'shimcha soat, ta\'til, kasallik, прогул sanalari. month: 0=Yanvar … 11=Dekabr.',
      parameters: { type: 'object', properties: { pinfl: { type: 'string' }, month: { type: 'integer', minimum: 0, maximum: 11 } }, required: ['pinfl', 'month'] } } },
  { type: 'function', function: { name: 'get_daily_attendance', description: 'Butun zavod bo\'yicha bir kunlik davomat: bo\'limlar kesimida kelgan/kelmagan soni va kelmaganlar ismi. days_ago: 0=bugun, 1=kecha …',
      parameters: { type: 'object', properties: { days_ago: { type: 'integer', minimum: 0, maximum: 60 } }, required: ['days_ago'] } } },
  { type: 'function', function: { name: 'get_monthly_attendance', description: 'Butun zavod bo\'yicha oylik davomat yakuni: bo\'limlar kesimida xodimlar, ishlangan kunlar, прогул, ta\'til, kasallik va TOP-10 прогулчилар. months_ago: 0=shu oy, 1=o\'tgan oy …',
      parameters: { type: 'object', properties: { months_ago: { type: 'integer', minimum: 0, maximum: 12 } }, required: ['months_ago'] } } }
];
function aiPeriodMatch(period, rows) { // "avgust 2026" / "август" / "2026-08" → база dagi davr qatori
  if (!period) return rows[rows.length - 1];
  var p = String(period).toLowerCase(), midx = -1, year = (p.match(/20\d\d/) || [''])[0];
  var UZ = MSG.uz.months.map(function (m) { return m.toLowerCase(); }), RU = RU_MONTHS.map(function (m) { return m.toLowerCase().slice(0, 4); });
  for (var i = 0; i < 12; i++) if (p.indexOf(UZ[i].slice(0, 4)) >= 0 || p.indexOf(RU[i]) >= 0 || p.indexOf(latToCyr(UZ[i]).slice(0, 4)) >= 0) midx = i;
  var mNum = p.match(/(?:^|\D)(\d{1,2})(?:\D|$)/); if (midx < 0 && mNum && Number(mNum[1]) >= 1 && Number(mNum[1]) <= 12) midx = Number(mNum[1]) - 1;
  var best = null;
  rows.forEach(function (r) {
    var s = String(r[COL.PERIOD]).toLowerCase();
    var okM = midx < 0 || s.indexOf(RU[midx]) >= 0 || s.indexOf(UZ[midx].slice(0, 4)) >= 0 || new RegExp('(^|\\D)0?' + (midx + 1) + '(\\D|$)').test(s.replace(/20\d\d/, ''));
    var okY = !year || s.indexOf(year) >= 0;
    if (okM && okY) best = r;
  });
  return best;
}
function aiTool(name, a) {
  switch (name) {
    case 'find_employee': return { results: aiFindEmployees(a.query) };
    case 'get_salary': {
      var rows = rowsForPinfl(String(a.pinfl)); if (!rows.length) return { error: 'not_found' };
      var r = aiPeriodMatch(a.period, rows); if (!r) return { error: 'period_not_found', available_periods: rows.slice(-12).map(function (x) { return String(x[COL.PERIOD]); }) };
      var f = {}; SHOW.forEach(function (c) { f[c.ru] = { value: typeof r[c.i] === 'number' ? r[c.i] : parseFloat(String(r[c.i]).replace(/\s| /g, '').replace(',', '.')) || 0, unit: c.days ? 'kun' : "so'm", uz: c.uz }; });
      return { fio: String(r[COL.FIO]), period: String(r[COL.PERIOD]), fields: f, available_periods: rows.slice(-12).map(function (x) { return String(x[COL.PERIOD]); }) };
    }
    case 'get_employee_info': {
      var rr = rowsForPinfl(String(a.pinfl)); if (!rr.length) return { error: 'not_found' };
      var x = rr[rr.length - 1], hired = parseDate(x[5]);
      return { fio: String(x[COL.FIO]), position: String(x[4] || ''), category: String(x[3] || ''), hired: hired ? Utilities.formatDate(hired, Session.getScriptTimeZone(), 'dd.MM.yyyy') : String(x[5] || ''),
        tenure: hired ? tenure(hired, new Date(), 'uz') : '', salary_base: x[8], as_of_period: String(x[COL.PERIOD]) };
    }
    case 'get_bonus': {
      var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BONUS); if (!sh || sh.getLastRow() < 2) return { error: 'no_bonus' };
      var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 23).getValues(), row = null;
      for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === String(a.pinfl)) { row = vals[i]; break; }
      if (!row) return { error: 'no_bonus' };
      var months = {}; for (var q = 0; q < 4; q++) for (var m = 0; m < 3; m++) { var v = row[6 + q * 4 + m]; if (v !== '' && v !== null) months[RU_MONTHS[q * 3 + m]] = v; }
      return { fio: String(row[1]), year: BONUS_YEAR, months: months, quarter_totals: [row[9], row[13], row[17], row[21]], year_total: row[22] };
    }
    case 'get_employee_attendance': {
      var d = tabelData(String(a.pinfl), Number(a.month)); if (!d.found) return { error: 'not_in_tabel', name: d.name };
      var absent = d.days.filter(function (x) { return x.k === 'a'; }).map(function (x) { return x.d; });
      var filled = d.days.some(function (x) { return x.k !== 'u'; }); if (!filled) return { error: 'month_not_filled', month: RU_MONTHS[a.month] };
      return { name: d.name, month: RU_MONTHS[a.month], worked_days: d.totalDays !== null ? d.totalDays : d.w, half_days: d.h, extra_hours: d.extra, vacation: d.v, sick: d.s, bs: d.b, absent_count: absent.length, absent_dates: absent };
    }
    case 'get_daily_attendance': {
      var dd = cached('daily:' + a.days_ago, function () { return dailyData(Number(a.days_ago)); });
      return { date: dd.date[2] + '.' + (dd.date[1] + 1) + '.' + dd.date[0], filled: dd.filled, total: dd.total,
        sections: dd.sections.map(function (s) { return { name: s.name, total: s.n, present: s.w, absent: s.a, unmarked: s.u, absent_people: s.people.map(function (p) { return p.fio + ' (' + (p.k === 'a' ? 'прогул' : p.k === 'v' ? 'отпуск' : p.k === 's' ? 'больничный' : p.k === 'b' ? 'Бс' : p.k === 'h' ? 'полдня' : p.raw) + ')'; }) }; }) };
    }
    case 'get_monthly_attendance': {
      var md = cached('monthly:' + a.months_ago, function () { return monthlyData(Number(a.months_ago)); });
      return { month: RU_MONTHS[md.month[1]] + ' ' + md.month[0], filled: md.filled, total: md.total, sections: md.sections, top_absent: md.top };
    }
    default: return { error: 'unknown_tool' };
  }
}
function aiSystemPrompt(L, name) {
  var t = new Date();
  return "Siz «SMT» zavodi rahbariyati uchun Telegram yordamchisiz. Foydalanuvchi: " + name + " (rahbar). Bugun: " + Utilities.formatDate(t, Session.getScriptTimeZone(), 'dd.MM.yyyy') + " (oy indeksi " + t.getMonth() + ", 0=Yanvar).\n" +
    "QOIDALAR:\n1. Barcha raqam va faktlarni FAQAT asboblar (tools) natijasidan oling. Hech narsani taxmin qilmang, hisoblab chiqarmang (yig'indi kerak bo'lsa ham asbob bergan raqamlardan foydalaning).\n" +
    "2. Xodim haqidagi har qanday savolda avval find_employee chaqiring. Bitta natija bo'lsa — davom eting. Bir nechta bo'lsa — javobni ro'yxat bilan yakunlab, qaysi biri ekanligini so'rang. Topilmasa — shuni ayting.\n" +
    "3. Javob tili: " + (L === 'ru' ? "rus tilida" : "o'zbek tilida (lotin)") + ", agar savol boshqa tilda bo'lsa — savol tilida. Qisqa, aniq, oddiy matn (Markdown, *, # ishlatmang). Kerak bo'lsa qatorlarga ajrating.\n" +
    "4. Summalarni «1 234 567 so'm» ko'rinishida (ming ajratgichi — bo'sh joy), kunlarni butun son bilan yozing. Oy nomlarini javob tilida yozing.\n" +
    "5. Ovozdan tanilgan ismlar noto'g'ri yozilgan bo'lishi mumkin — find_employee taxminiy qidiradi, natijadagi F.I.O. ni javobda to'liq yozing.\n" +
    "6. Ma'lumot yo'q bo'lsa (табель to'ldirilmagan, davr topilmadi) — buni ochiq ayting va mavjud variantlarni taklif qiling.";
}
function aiHistGet(uid) { var s = CacheService.getScriptCache().get('ai_h_' + uid); return s ? JSON.parse(s) : []; }
function aiHistPut(uid, h) { try { CacheService.getScriptCache().put('ai_h_' + uid, JSON.stringify(h.slice(-AI_HIST_TURNS)), AI_HIST_SEC); } catch (e) {} }
function openai(path, payload, isBlobForm) {
  var opt = { method: 'post', headers: { Authorization: 'Bearer ' + prop('OPENAI_API_KEY') }, muteHttpExceptions: true };
  if (isBlobForm) opt.payload = payload; else { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch('https://api.openai.com/v1/' + path, opt), code = res.getResponseCode(), body = res.getContentText();
  if (code >= 300) throw new Error('OpenAI ' + path + ' HTTP ' + code + ': ' + body.slice(0, 300));
  return JSON.parse(body);
}
/** Savolga javob: model → asboblar → matn. Xatolarda tashlaydi. */
function aiAnswer(uid, question, L, name) {
  var hist = aiHistGet(uid);
  var messages = [{ role: 'system', content: aiSystemPrompt(L, name) }].concat(hist, [{ role: 'user', content: question }]);
  var used = [];
  for (var step = 0; step < AI_MAX_STEPS; step++) {
    var r = openai('chat/completions', { model: prop('AI_MODEL') || 'gpt-4o-mini', messages: messages, tools: AI_TOOLS, tool_choice: 'auto', temperature: 0.1, max_tokens: 900 });
    var msg = r.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls || !msg.tool_calls.length) {
      var text = String(msg.content || '').trim();
      aiHistPut(uid, hist.concat([{ role: 'user', content: question }, { role: 'assistant', content: text }]));
      return { text: text, tools: used };
    }
    msg.tool_calls.forEach(function (tc) {
      var args = {}; try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
      var out; try { out = aiTool(tc.function.name, args); } catch (e) { out = { error: String(e) }; }
      used.push(tc.function.name);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(out) });
    });
  }
  throw new Error('AI: juda ko\'p qadam');
}
/** Telegram ovozli xabarini matnga o'giradi */
function aiTranscribe(fileId) {
  var f = tg('getFile', { file_id: fileId });
  if (!f.ok) throw new Error('getFile: ' + JSON.stringify(f));
  var blob = UrlFetchApp.fetch('https://api.telegram.org/file/bot' + prop('BOT_TOKEN') + '/' + f.result.file_path).getBlob().setName('voice.ogg');
  var r = openai('audio/transcriptions', { file: blob, model: prop('AI_STT_MODEL') || 'gpt-4o-mini-transcribe', prompt: 'SMT zavodi, xodimlar, oylik, davomat, табель, прогул. Familiyalar: o\'zbekcha.' }, true);
  return String(r.text || '').trim();
}
/** handleMessage dan chaqiriladi: matn yoki ovoz → javob */
function aiHandle(uid, chat, m, text, L, mgrName) {
  var A = AI_MSG[L] || AI_MSG.uz;
  if (!aiEnabled()) return send(chat, A.off, mainMenu(L));
  try { tg('sendChatAction', { chat_id: chat, action: 'typing' }); } catch (e) {}
  var question = text, heard = '';
  try {
    if (m.voice || m.audio) {
      question = aiTranscribe((m.voice || m.audio).file_id);
      if (!question) return send(chat, A.noVoice, mainMenu(L));
      heard = A.heard + '<i>' + esc(question) + '</i>\n\n';
    }
    var ans = aiAnswer(uid, question, L, mgrName);
    logAction(uid, '', 'ai:' + question.slice(0, 80) + ' [' + ans.tools.join(',') + ']');
    return send(chat, heard + esc(ans.text), mainMenu(L));
  } catch (e) {
    try { send(prop('ADMIN_ID'), '⚠️ AI xatosi: ' + String(e).slice(0, 500)); } catch (x) {}
    return send(chat, heard + A.err, mainMenu(L));
  }
}
