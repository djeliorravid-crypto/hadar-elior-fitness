/* ============================================================
   FitCouple – app.js
   Fitness & nutrition tracker for Elior & Hadar
   ============================================================ */

// ─── Profiles ────────────────────────────────────────────────
const PROFILES = {
  elior: { name: 'אליאור', theme: 'theme-elior', initials: 'א', icon: '💪' },
  hadar: { name: 'הדר',   theme: 'theme-hadar',  initials: 'ה', icon: '🌸' },
};

const WORKOUT_TYPES = [
  { id: 'chest',     label: 'חזה',      emoji: '🏋️' },
  { id: 'back',      label: 'גב',       emoji: '🔙' },
  { id: 'legs',      label: 'רגליים',   emoji: '🦵' },
  { id: 'shoulders', label: 'כתפיים',   emoji: '💆' },
  { id: 'arms',      label: 'ידיים',    emoji: '💪' },
  { id: 'cardio',    label: 'קרדיו',    emoji: '🏃' },
  { id: 'full',      label: 'פול בודי', emoji: '⚡' },
  { id: 'rest',      label: 'מנוחה',    emoji: '😴' },
];

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'ארוחת בוקר',    icon: '🌅' },
  { id: 'lunch',     label: 'ארוחת צהריים',  icon: '☀️' },
  { id: 'dinner',    label: 'ארוחת ערב',     icon: '🌙' },
  { id: 'snack',     label: 'חטיף / נוסף',   icon: '🍎' },
];

const DEFAULT_GOALS = { calories: 2200, protein: 150, carbs: 220, fat: 65, targetWeight: 75 };

// ─── State ────────────────────────────────────────────────────
const state = {
  profile: null,
  tab: 'home',
};

// ─── Firebase real-time sync ──────────────────────────────────
const FIREBASE_URL = 'https://elior-hadar-default-rtdb.firebaseio.com';

function fbPush(key, value) {
  fetch(`${FIREBASE_URL}/data/${key}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).catch(() => {});
}

let _pollInterval = null;

function startRealtimeSync() {
  if (_pollInterval) clearInterval(_pollInterval);
  pollFirebase();
  _pollInterval = setInterval(pollFirebase, 3000);
}

function stopRealtimeSync() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

async function pollFirebase() {
  try {
    const res = await fetch(`${FIREBASE_URL}/data.json`);
    if (!res.ok) return;
    const remote = await res.json();
    if (!remote) return;

    let changed = false;
    Object.entries(remote).forEach(([k, v]) => {
      if (k.includes('photo')) return;
      const remoteStr = JSON.stringify(v);
      if (localStorage.getItem(k) !== remoteStr) {
        localStorage.setItem(k, remoteStr);
        changed = true;
      }
    });

    if (changed && state.profile) {
      renderActiveTab();
      updateStreakBadge();
    }
  } catch {}
}

function showSyncBadge(msg) {
  let el = document.getElementById('sync-badge');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sync-badge';
    el.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);background:rgba(20,20,40,0.9);color:#fff;font-size:0.7rem;padding:4px 14px;border-radius:99px;z-index:999;pointer-events:none;backdrop-filter:blur(6px);';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity = '1';
}
function hideSyncBadge(msg) {
  const el = document.getElementById('sync-badge');
  if (!el) return;
  if (msg) { el.textContent = msg; setTimeout(() => { el.style.opacity = '0'; }, 1200); }
  else el.style.opacity = '0';
}

// ─── DB ──────────────────────────────────────────────────────
const DB = {
  k: (p, k) => `fc_${p}_${k}`,
  get(p, k)    { try { return JSON.parse(localStorage.getItem(DB.k(p,k))); } catch { return null; } },
  set(p, k, v) {
    const key = DB.k(p, k);
    localStorage.setItem(key, JSON.stringify(v));
    if (!k.includes('photo')) fbPush(key, v);
  },

  getMeals(p, date)       { return DB.get(p, `meals_${date}`) || {}; },
  saveMeals(p, date, obj) { DB.set(p, `meals_${date}`, obj); },

  getWorkouts(p)      { return DB.get(p, 'workouts2') || []; },
  saveWorkouts(p, ws) { DB.set(p, 'workouts2', ws); },

  getWeight(p)        { return DB.get(p, 'weight') || []; },
  saveWeight(p, arr)  { DB.set(p, 'weight', arr); },

  getGoals(p)         { return DB.get(p, 'goals') || { ...DEFAULT_GOALS }; },
  saveGoals(p, g)     { DB.set(p, 'goals', g); },

  getPhoto(p)         { return DB.get(p, 'photo'); },
  savePhoto(p, b64)   { DB.set(p, 'photo', b64); },  // saved locally only
};

// ─── Utilities ───────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0,10); }

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function sumMeals(mealsObj) {
  let kcal=0, protein=0, carbs=0, fat=0;
  Object.values(mealsObj).forEach(items =>
    (items||[]).forEach(item => {
      kcal    += item.kcal    || 0;
      protein += item.protein || 0;
      carbs   += item.carbs   || 0;
      fat     += item.fat     || 0;
    })
  );
  return { kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) };
}

function avatarHTML(profile, size=34) {
  const photo = DB.getPhoto(profile);
  const p = PROFILES[profile];
  if (photo) return `<img src="${photo}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;object-position:center top;">`;
  const bg = profile==='elior'
    ? 'linear-gradient(135deg,#6366f1,#a78bfa)'
    : 'linear-gradient(135deg,#ec4899,#f43f5e)';
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.42)}px;font-weight:700;color:#fff;flex-shrink:0;">${p.initials}</div>`;
}

// ─── Modal ───────────────────────────────────────────────────
function openModal(html, onClose) {
  document.getElementById('modal-box').innerHTML = `<div class="modal-handle"></div>${html}`;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay._onClose = onClose || null;
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.getElementById('modal-box').innerHTML = '';
  if (overlay._onClose) { overlay._onClose(); overlay._onClose = null; }
}
window.closeModal = closeModal;

// ─── Smart calorie estimator (no API needed) ─────────────────

// Food DB: per 100g → { kcal, protein, carbs, fat }
// defaultServing: grams assumed when no quantity given
const FOOD_DB_LOCAL = [
  // ── חלבונים ──
  { keys:['חזה עוף','עוף','פילה עוף'],          per100:{kcal:165,protein:31,carbs:0,  fat:3.6}, serving:150 },
  { keys:['שוק עוף','ירך עוף'],                  per100:{kcal:209,protein:26,carbs:0,  fat:11},  serving:120 },
  { keys:['בשר טחון','המבורגר','קציצה','קציצות'], per100:{kcal:254,protein:17,carbs:0,  fat:20},  serving:120 },
  { keys:['סטייק','אנטריקוט','פילה בקר','בקר'],   per100:{kcal:271,protein:26,carbs:0,  fat:18},  serving:200 },
  { keys:['טונה','טונה בשמן','טונה במים'],        per100:{kcal:116,protein:25,carbs:0,  fat:1},   serving:80  },
  { keys:['סלמון','סלמון אפוי','סלמון מבושל'],    per100:{kcal:208,protein:20,carbs:0,  fat:13},  serving:150 },
  { keys:['דג','פילה דג','בקלה'],                 per100:{kcal:105,protein:22,carbs:0,  fat:1},   serving:150 },
  { keys:['ביצה','ביצים'],                        per100:{kcal:155,protein:13,carbs:1,  fat:11},  serving:60  },
  { keys:['חלבון ביצה'],                          per100:{kcal:52, protein:11,carbs:0.7,fat:0.2}, serving:60  },
  { keys:['גבינה צהובה','גבינה'],                 per100:{kcal:402,protein:25,carbs:1,  fat:33},  serving:30  },
  { keys:['גבינה לבנה 5%','גבינה לבנה'],          per100:{kcal:85, protein:11,carbs:4,  fat:2.5}, serving:100 },
  { keys:['קוטג׳','קוטג'],                        per100:{kcal:90, protein:11,carbs:3,  fat:3},   serving:200 },
  { keys:['יוגורט יווני','יוגורט'],               per100:{kcal:97, protein:9, carbs:3.6,fat:5},   serving:200 },
  { keys:['שקדים'],                               per100:{kcal:579,protein:21,carbs:22, fat:50},  serving:30  },
  { keys:['בוטנים'],                              per100:{kcal:567,protein:26,carbs:16, fat:49},  serving:30  },
  { keys:['חמאת בוטנים'],                         per100:{kcal:588,protein:25,carbs:20, fat:50},  serving:32  },
  { keys:['אגוזים','אגוז'],                       per100:{kcal:654,protein:15,carbs:14, fat:65},  serving:30  },
  { keys:['טופו'],                                per100:{kcal:76, protein:8, carbs:2,  fat:4.5}, serving:120 },
  { keys:['גבינת ריקוטה'],                        per100:{kcal:174,protein:11,carbs:3,  fat:13},  serving:100 },
  { keys:['שמנת חמוצה'],                          per100:{kcal:198,protein:2, carbs:3.5,fat:20},  serving:30  },
  // ── פחמימות ──
  { keys:['אורז לבן','אורז מבושל','אורז'],        per100:{kcal:130,protein:2.7,carbs:28,fat:0.3}, serving:150 },
  { keys:['אורז מלא'],                            per100:{kcal:123,protein:2.6,carbs:26,fat:0.9}, serving:150 },
  { keys:['פסטה מבושלת','פסטה'],                  per100:{kcal:158,protein:6,  carbs:31,fat:0.9}, serving:180 },
  { keys:['לחם לבן','לחם'],                       per100:{kcal:265,protein:9,  carbs:49,fat:3},   serving:40  },
  { keys:['לחם מלא','פיתה מלאה'],                 per100:{kcal:247,protein:11, carbs:44,fat:3.5}, serving:40  },
  { keys:['פיתה'],                                per100:{kcal:267,protein:9,  carbs:52,fat:2},   serving:60  },
  { keys:['לאפה','עינאבה'],                       per100:{kcal:280,protein:8,  carbs:54,fat:4},   serving:70  },
  { keys:['שיבולת שועל','קוורקר','אוטמיל'],       per100:{kcal:389,protein:17, carbs:66,fat:7},   serving:80  },
  { keys:['בטטה','בטטות'],                        per100:{kcal:90, protein:2,  carbs:21,fat:0.1}, serving:150 },
  { keys:['תפוח אדמה','תפוח עץ אדמה'],           per100:{kcal:77, protein:2,  carbs:17,fat:0.1}, serving:150 },
  { keys:['לביבות','פנקייק'],                     per100:{kcal:227,protein:5,  carbs:38,fat:7},   serving:100 },
  { keys:['קינואה'],                              per100:{kcal:120,protein:4.4,carbs:21,fat:1.9}, serving:150 },
  { keys:['כוסמת'],                               per100:{kcal:155,protein:5.7,carbs:33,fat:1},   serving:150 },
  { keys:['בורגול'],                              per100:{kcal:83, protein:3,  carbs:19,fat:0.2}, serving:150 },
  { keys:['עדשים','עדשים מבושלות'],               per100:{kcal:116,protein:9,  carbs:20,fat:0.4}, serving:150 },
  { keys:['חומוס מבושל','גרגרי חומוס'],           per100:{kcal:164,protein:8.9,carbs:27,fat:2.6}, serving:150 },
  { keys:['חומוס','חומוסייה'],                    per100:{kcal:166,protein:8,  carbs:14,fat:9.6}, serving:100 },
  { keys:['שעועית'],                              per100:{kcal:127,protein:8.7,carbs:23,fat:0.5}, serving:150 },
  { keys:['תירס','תירס מבושל'],                   per100:{kcal:96, protein:3.4,carbs:21,fat:1.5}, serving:100 },
  { keys:['לחמניה','בגט'],                        per100:{kcal:270,protein:9,  carbs:50,fat:3},   serving:80  },
  // ── פירות ──
  { keys:['בננה','בננות'],                        per100:{kcal:89, protein:1.1,carbs:23,fat:0.3}, serving:120 },
  { keys:['תפוח','תפוחים'],                       per100:{kcal:52, protein:0.3,carbs:14,fat:0.2}, serving:150 },
  { keys:['תפוז','תפוזים'],                       per100:{kcal:47, protein:0.9,carbs:12,fat:0.1}, serving:130 },
  { keys:['ענבים','ענב'],                         per100:{kcal:67, protein:0.6,carbs:17,fat:0.4}, serving:150 },
  { keys:['אבוקדו'],                              per100:{kcal:160,protein:2,  carbs:9, fat:15},  serving:80  },
  { keys:['אוכמניות','בלוברי'],                   per100:{kcal:57, protein:0.7,carbs:14,fat:0.3}, serving:100 },
  { keys:['תות','תותים'],                         per100:{kcal:32, protein:0.7,carbs:8, fat:0.3}, serving:100 },
  { keys:['מנגו'],                                per100:{kcal:60, protein:0.8,carbs:15,fat:0.4}, serving:150 },
  { keys:['אגס'],                                 per100:{kcal:57, protein:0.4,carbs:15,fat:0.1}, serving:150 },
  { keys:['אפרסק'],                               per100:{kcal:39, protein:0.9,carbs:10,fat:0.3}, serving:130 },
  { keys:['אבטיח'],                               per100:{kcal:30, protein:0.6,carbs:8, fat:0.2}, serving:250 },
  { keys:['מלון'],                                per100:{kcal:34, protein:0.8,carbs:8, fat:0.2}, serving:200 },
  { keys:['לימון'],                               per100:{kcal:29, protein:1.1,carbs:9, fat:0.3}, serving:50  },
  // ── ירקות ──
  { keys:['עגבנייה','עגבניות'],                   per100:{kcal:18, protein:0.9,carbs:3.9,fat:0.2},serving:120 },
  { keys:['מלפפון','מלפפונים'],                   per100:{kcal:15, protein:0.7,carbs:3.6,fat:0.1},serving:120 },
  { keys:['גמבה','פלפל'],                         per100:{kcal:31, protein:1,  carbs:6, fat:0.3}, serving:120 },
  { keys:['ברוקולי'],                             per100:{kcal:34, protein:2.8,carbs:7, fat:0.4}, serving:150 },
  { keys:['כרובית'],                              per100:{kcal:25, protein:2,  carbs:5, fat:0.3}, serving:150 },
  { keys:['גזר','גזרים'],                         per100:{kcal:41, protein:0.9,carbs:10,fat:0.2}, serving:100 },
  { keys:['תרד'],                                 per100:{kcal:23, protein:2.9,carbs:3.6,fat:0.4},serving:100 },
  { keys:['חסה','חסה ירוקה'],                     per100:{kcal:15, protein:1.4,carbs:2.9,fat:0.2},serving:80  },
  { keys:['כרוב'],                                per100:{kcal:25, protein:1.3,carbs:6, fat:0.1}, serving:100 },
  { keys:['בצל','בצל ירוק'],                      per100:{kcal:40, protein:1.1,carbs:9, fat:0.1}, serving:80  },
  { keys:['שום'],                                 per100:{kcal:149,protein:6.4,carbs:33,fat:0.5}, serving:10  },
  { keys:['פטרייה','פטריות'],                     per100:{kcal:22, protein:3.1,carbs:3.3,fat:0.3},serving:100 },
  { keys:['חצילים','חציל'],                       per100:{kcal:25, protein:1,  carbs:6, fat:0.2}, serving:150 },
  { keys:['קישואים','קישוא'],                     per100:{kcal:17, protein:1.2,carbs:3.1,fat:0.3},serving:150 },
  { keys:['סלרי'],                                per100:{kcal:16, protein:0.7,carbs:3, fat:0.2}, serving:80  },
  { keys:['סלק'],                                 per100:{kcal:43, protein:1.6,carbs:10,fat:0.2}, serving:100 },
  { keys:['אספרגוס'],                             per100:{kcal:20, protein:2.2,carbs:3.9,fat:0.1},serving:100 },
  { keys:['סלט ירקות','סלט','ירקות מעורבים'],     per100:{kcal:25, protein:1.5,carbs:4, fat:0.5}, serving:200 },
  // ── שמנים ושומנים ──
  { keys:['שמן זית'],                             per100:{kcal:884,protein:0,  carbs:0, fat:100}, serving:10  },
  { keys:['טחינה'],                               per100:{kcal:595,protein:17, carbs:21,fat:54},  serving:20  },
  { keys:['חמאה'],                                per100:{kcal:717,protein:0.9,carbs:0.1,fat:81}, serving:10  },
  { keys:['מיונז'],                               per100:{kcal:680,protein:1,  carbs:1, fat:75},  serving:15  },
  // ── מוצרי חלב ──
  { keys:['חלב','חלב 3%','חלב 1%'],              per100:{kcal:61, protein:3.2,carbs:4.8,fat:3.3},serving:200 },
  { keys:['שמנת'],                                per100:{kcal:345,protein:2.1,carbs:2.8,fat:37}, serving:30  },
  { keys:['גלידה'],                               per100:{kcal:207,protein:3.5,carbs:24,fat:11},  serving:100 },
  // ── ארוחות מוכנות / ישראלי ──
  { keys:['שקשוקה'],                              per100:{kcal:120,protein:7,  carbs:6, fat:8},   serving:300 },
  { keys:['פלאפל'],                               per100:{kcal:333,protein:13, carbs:31,fat:18},  serving:100 },
  { keys:['שאוורמה','שווארמה'],                   per100:{kcal:220,protein:18, carbs:10,fat:12},  serving:200 },
  { keys:['פיצה'],                                per100:{kcal:266,protein:11, carbs:33,fat:10},  serving:200 },
  { keys:['בורגר','המבורגר'],                     per100:{kcal:295,protein:17, carbs:24,fat:14},  serving:200 },
  { keys:['סנדוויץ','סנדביץ'],                    per100:{kcal:230,protein:12, carbs:28,fat:8},   serving:150 },
  { keys:['מרק עוף','מרק'],                       per100:{kcal:40, protein:3,  carbs:4, fat:1.5}, serving:300 },
  { keys:['אומלט'],                               per100:{kcal:149,protein:11, carbs:1, fat:11},  serving:150 },
  { keys:['גרנולה'],                              per100:{kcal:471,protein:10, carbs:64,fat:20},  serving:50  },
  { keys:['קורנפלקס','דגני בוקר'],               per100:{kcal:370,protein:8,  carbs:84,fat:1},   serving:40  },
  { keys:['פריכיות','פריכית'],                    per100:{kcal:387,protein:8,  carbs:80,fat:3},   serving:20  },
  { keys:['חטיף','ביסלי','במבה','קרקרים'],        per100:{kcal:520,protein:8,  carbs:60,fat:28},  serving:30  },
  { keys:['שוקולד'],                              per100:{kcal:546,protein:5,  carbs:60,fat:31},  serving:30  },
  { keys:['עוגה','קפה עוגה'],                     per100:{kcal:350,protein:5,  carbs:50,fat:15},  serving:80  },
  { keys:['קפה עם חלב','קפה לאטה','לאטה'],        per100:{kcal:40, protein:2,  carbs:5, fat:1.5}, serving:300 },
  { keys:['קפה שחור','אספרסו','קפה'],             per100:{kcal:2,  protein:0.3,carbs:0, fat:0},   serving:240 },
  { keys:['מיץ תפוזים','מיץ'],                   per100:{kcal:45, protein:0.7,carbs:10,fat:0.2}, serving:250 },
];

// Unit → grams
const UNITS = {
  'גרם':1,'ג׳':1,'גר':1,'גר׳':1,
  'ק"ג':1000,'קג':1000,'קילו':1000,
  'כוס':240,'כוסות':240,
  'כף':15,'כפות':15,
  'כפית':5,'כפיות':5,
  'פרוסה':35,'פרוסות':35,
  'מ"ל':1,'מל':1,'ליטר':1000,
};
const UNIT_PAT = Object.keys(UNITS).sort((a,b)=>b.length-a.length).join('|');

// Hebrew word → count (must appear as standalone word)
const HE_NUMS = [
  ['אחד וחצי',1.5],['אחת וחצי',1.5],['שתי וחצי',2.5],
  ['שניים',2],['שתיים',2],['שלושה',3],['ארבעה',4],['חמישה',5],
  ['שישה',6],['שבעה',7],['שמונה',8],['תשעה',9],['עשרה',10],
  ['שתי',2],['שני',2],['שלוש',3],['ארבע',4],['חמש',5],
  ['שש',6],['שבע',7],['תשע',9],['עשר',10],
  ['אחד',1],['אחת',1],
];

function wordIn(text, word) {
  // true only when word stands alone (surrounded by space/start/end/punctuation)
  const re = new RegExp(`(?:^|[\\s,])${word}(?=[\\s,]|$)`);
  return re.test(text);
}

function extractQty(nearby, serving) {
  const t = nearby;

  // 1. Digit + unit  (e.g. "200 גרם", "3 כפות", "2 פרוסות")
  const withUnit = t.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PAT})`));
  if (withUnit) {
    const num = parseFloat(withUnit[1].replace(',', '.'));
    return num * UNITS[withUnit[2]];
  }

  // 2. Hebrew number word + optional unit  (e.g. "שתי ביצים", "שלוש כפות")
  for (const [word, val] of HE_NUMS) {
    if (!wordIn(t, word)) continue;
    // check if a unit follows the number word
    const afterWord = t.slice(t.search(word) + word.length);
    const unitMatch = afterWord.match(new RegExp(`^\\s*(${UNIT_PAT})`));
    if (unitMatch) return val * UNITS[unitMatch[1]];
    return val * serving;
  }

  // 3. Bare unit word without digit (e.g. "כוס שיבולת שועל", "כף שמן")
  const bareUnit = t.match(new RegExp(`(?:^|\\s)(${UNIT_PAT})(?=\\s|$)`));
  if (bareUnit && UNITS[bareUnit[1]] > 1) {
    // "כוס" without a digit is ambiguous (density varies) — use food's serving
    if (bareUnit[1] === 'כוס' || bareUnit[1] === 'כוסות') return serving;
    return UNITS[bareUnit[1]];
  }

  // 4. חצי / רבע
  if (/חצי|½/.test(t)) return serving * 0.5;
  if (/רבע|¼/.test(t))  return serving * 0.25;

  // 5. Bare digit  (e.g. "2 ביצים")
  const bareNum = t.match(/(\d+(?:[.,]\d+)?)/);
  if (bareNum) {
    const num = parseFloat(bareNum[1].replace(',', '.'));
    if (num > 0 && num <= 2000) return num < 10 ? num * serving : num;
  }

  return serving;
}

function estimateCaloriesLocal(text) {
  // Split by newlines/commas so each food's quantity is scoped to its own segment
  const segments = text.split(/[\n,،]+/).map(s =>
    s.replace(/['"״]/g, '').replace(/[\-–]/g, ' ').trim()
  ).filter(Boolean);

  if (segments.length === 0) segments.push(text);

  let totalKcal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
  const foundItems = [];
  const counted = new Set();

  for (const seg of segments) {
    for (const food of FOOD_DB_LOCAL) {
      if (counted.has(food.keys[0])) continue;
      for (const key of food.keys) {
        if (!seg.includes(key)) continue;

        const keyIdx = seg.indexOf(key);
        const nearby = seg.slice(Math.max(0, keyIdx - 35), keyIdx + key.length + 35);
        const grams  = extractQty(nearby, food.serving);
        const scale  = grams / 100;

        totalKcal    += Math.round(food.per100.kcal    * scale);
        totalProtein += Math.round(food.per100.protein * scale * 10) / 10;
        totalCarbs   += Math.round(food.per100.carbs   * scale * 10) / 10;
        totalFat     += Math.round(food.per100.fat     * scale * 10) / 10;
        foundItems.push({ name: food.keys[0], grams: Math.round(grams), kcal: Math.round(food.per100.kcal * scale) });
        counted.add(food.keys[0]);
        break;
      }
    }
  }

  if (foundItems.length === 0)
    throw new Error('לא זיהיתי מאכלים בטקסט. נסה לפרט — "2 ביצים, 200 גרם אורז, חזה עוף"');

  const summary = foundItems.map(i => `${i.name} (${i.grams}g · ${i.kcal} קל׳)`).join(' + ');
  return {
    kcal:    Math.round(totalKcal),
    protein: Math.round(totalProtein * 10) / 10,
    carbs:   Math.round(totalCarbs   * 10) / 10,
    fat:     Math.round(totalFat     * 10) / 10,
    summary,
  };
}

// ─── Lobby ───────────────────────────────────────────────────
function renderLobby() {
  document.getElementById('app').innerHTML = `
    <div id="screen-lobby" class="screen">
      <div class="lobby-logo">⚖️</div>
      <div class="lobby-title">אליאור ודרי בדרך להיות רזים ויפים אפילו יותר</div>
      <div class="lobby-sub">בחר פרופיל</div>
      <div class="profiles-row">
        ${profileBtnHTML('elior')}
        ${profileBtnHTML('hadar')}
      </div>
      <div class="lobby-hint">לחיצה ארוכה על תמונה להחלפתה</div>
    </div>
  `;

  attachProfileBtn('elior');
  attachProfileBtn('hadar');
}

function attachProfileBtn(p) {
  const btn    = document.getElementById(`btn-${p}`);
  const circle = btn.querySelector('.profile-circle');
  let pressTimer = null;

  const startLong = () => {
    pressTimer = setTimeout(() => {
      pressTimer = null;
      circle.classList.add('longpress-active');
      pickPhoto(p, () => circle.classList.remove('longpress-active'));
    }, 550);
  };
  const cancelLong = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
  };

  btn.addEventListener('pointerdown',  startLong);
  btn.addEventListener('pointerup',    () => {
    if (pressTimer !== null) {          // short tap → navigate
      cancelLong();
      enterProfile(p);
    }
  });
  btn.addEventListener('pointerleave', cancelLong);
  btn.addEventListener('contextmenu',  e => e.preventDefault()); // suppress mobile long-press menu
}

function profileBtnHTML(p) {
  const prof = PROFILES[p];
  const photo = DB.getPhoto(p);
  const inner = photo
    ? `<img src="${photo}" alt="${prof.name}">`
    : `<span class="avatar-initials">${prof.initials}</span>`;
  return `
    <button class="profile-btn" id="btn-${p}">
      <div class="profile-ring ${p}-ring">
        <div class="profile-circle">
          ${inner}
          <div class="photo-upload-trigger">📷</div>
        </div>
      </div>
      <span class="profile-label ${p}-label">${prof.name}</span>
    </button>`;
}

function pickPhoto(profile, onDone) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      DB.savePhoto(profile, ev.target.result);
      if (onDone) onDone();
      renderLobby();
    };
    reader.readAsDataURL(file);
  };
  inp.oncancel = () => { if (onDone) onDone(); };
  inp.click();
}

// ─── Profile screen shell ─────────────────────────────────────
function enterProfile(profile) {
  state.profile = profile;
  state.tab = 'home';
  document.body.className = PROFILES[profile].theme;
  renderProfileScreen();
  startRealtimeSync();
}

function renderProfileScreen() {
  const prof = PROFILES[state.profile];
  document.getElementById('app').innerHTML = `
    <div id="screen-profile" class="screen">
      <div class="top-header">
        <button class="back-btn" id="btn-back">←</button>
        <div class="header-profile">
          <div class="header-avatar">${avatarHTML(state.profile,34)}</div>
          <div>
            <div class="header-name">${prof.name}</div>
            <div class="header-streak" id="header-streak-val">טוען...</div>
          </div>
        </div>
        <button class="back-btn" id="btn-settings" title="הגדרות">⚙️</button>
      </div>

      <div class="scroll-area" id="tab-scroll">
        <div id="tab-home"      class="tab-pane ${state.tab==='home'     ?'active':''}"></div>
        <div id="tab-meals"     class="tab-pane ${state.tab==='meals'    ?'active':''}"></div>
        <div id="tab-workout"   class="tab-pane ${state.tab==='workout'  ?'active':''}"></div>
        <div id="tab-weight"    class="tab-pane ${state.tab==='weight'   ?'active':''}"></div>
      </div>

      <div class="tab-bar">
        <button class="tab-btn ${state.tab==='home'   ?'active':''}" data-tab="home">
          <span class="tab-icon">🏠</span><span>בית</span>
        </button>
        <button class="tab-btn ${state.tab==='meals'  ?'active':''}" data-tab="meals">
          <span class="tab-icon">🍽️</span><span>ארוחות</span>
        </button>
        <button class="tab-btn ${state.tab==='workout'?'active':''}" data-tab="workout">
          <span class="tab-icon">🏋️</span><span>אימון</span>
        </button>
        <button class="tab-btn ${state.tab==='weight' ?'active':''}" data-tab="weight">
          <span class="tab-icon">⚖️</span><span>שקילות</span>
        </button>
      </div>
    </div>
  `;

  updateStreakBadge();
  renderActiveTab();

  document.getElementById('btn-back').addEventListener('click', () => {
    stopRealtimeSync();
    document.body.className = '';
    renderLobby();
  });
  document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
}

function switchTab(tab) {
  if (tab === state.tab) return;
  state.tab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id===`tab-${tab}`));
  renderActiveTab();
}

function renderActiveTab() {
  switch(state.tab) {
    case 'home':    renderHome();    break;
    case 'meals':   renderMeals();   break;
    case 'workout': renderWorkout(); break;
    case 'weight':  renderWeight();  break;
  }
}

function updateStreakBadge() {
  const streak = calcStreak(DB.getWorkouts(state.profile));
  const el = document.getElementById('header-streak-val');
  if (el) el.textContent = streak > 0 ? `🔥 ${streak} ימים רצופים` : 'בוא נתחיל!';
}

// ─── Home Tab ─────────────────────────────────────────────────
function renderHome() {
  const p = state.profile;
  const prof = PROFILES[p];
  const today = todayStr();
  const meals = DB.getMeals(p, today);
  const totals = sumMeals(meals);
  const goals = DB.getGoals(p);
  const workouts = DB.getWorkouts(p);
  const todayW = workouts.find(w => w.date === today);
  const weightLog = DB.getWeight(p);
  const lastWeight = weightLog.length ? weightLog[weightLog.length-1].value : null;

  const kcalPct = Math.min(1, goals.calories > 0 ? totals.kcal / goals.calories : 0);
  const circumference = 2 * Math.PI * 38;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';

  document.getElementById('tab-home').innerHTML = `
    <div class="home-greeting">
      <h2>${greeting}, ${prof.name}! ${prof.icon}</h2>
      <p>${fmtDate(today)}</p>
    </div>

    <div class="home-ring-row">
      <div class="calorie-ring-card home-ring">
        <div class="ring-wrap">
          <svg class="ring-svg" viewBox="0 0 90 90" width="90" height="90">
            <circle class="ring-bg" cx="45" cy="45" r="38"/>
            <circle class="ring-fill" cx="45" cy="45" r="38"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference*(1-kcalPct)}"/>
          </svg>
          <div class="ring-label">
            <div class="ring-kcal">${totals.kcal}</div>
            <div class="ring-sub">/ ${goals.calories} קל׳</div>
          </div>
        </div>
        <div class="macro-bars">
          ${macroBarsHTML(totals, goals)}
        </div>
      </div>
    </div>

    <div class="home-row-cards">
      <div class="home-mini-card ${todayW ? 'done-card' : ''}">
        <div class="hmc-icon">${todayW ? todayW.emoji : '🏋️'}</div>
        <div class="hmc-label">${todayW ? todayW.typeLabel : 'אין אימון'}</div>
        <div class="hmc-sub">${todayW ? 'בוצע ✓' : 'היום'}</div>
      </div>
      <div class="home-mini-card">
        <div class="hmc-icon">⚖️</div>
        <div class="hmc-label">${lastWeight ? lastWeight + ' ק"ג' : '–'}</div>
        <div class="hmc-sub">משקל אחרון</div>
      </div>
    </div>

    <div class="section-header"><h3>פעולות מהירות</h3></div>
    <div class="quick-actions">
      <button class="quick-btn" id="qb-meal">
        <span class="q-icon">🍽️</span><span>רשום ארוחה</span>
      </button>
      <button class="quick-btn" id="qb-workout">
        <span class="q-icon">🏋️</span><span>רשום אימון</span>
      </button>
      <button class="quick-btn" id="qb-weight">
        <span class="q-icon">⚖️</span><span>רשום משקל</span>
      </button>
    </div>
    <div style="height:1rem"></div>
  `;

  document.getElementById('qb-meal').addEventListener('click', () => { switchTab('meals'); });
  document.getElementById('qb-workout').addEventListener('click', () => { switchTab('workout'); });
  document.getElementById('qb-weight').addEventListener('click', () => { switchTab('weight'); setTimeout(openWeightModal, 80); });
}

function macroBarsHTML(totals, goals) {
  const rows = [
    { name:'חלבון', val:totals.protein, goal:goals.protein, cls:'protein-bar' },
    { name:'פחמימות', val:totals.carbs,  goal:goals.carbs,   cls:'carbs-bar' },
    { name:'שומן',  val:totals.fat,    goal:goals.fat,     cls:'fat-bar' },
  ];
  return rows.map(r => `
    <div class="macro-row">
      <span class="macro-name">${r.name}</span>
      <div class="macro-bar-wrap"><div class="macro-bar ${r.cls}" style="width:${Math.min(100,r.goal>0?r.val/r.goal*100:0)}%"></div></div>
      <span class="macro-val">${r.val}g</span>
    </div>`).join('');
}

// ─── Meals Tab ────────────────────────────────────────────────
function renderMeals() {
  const p = state.profile;
  const today = todayStr();
  const meals = DB.getMeals(p, today);
  const totals = sumMeals(meals);
  const goals = DB.getGoals(p);
  const kcalPct = Math.min(1, goals.calories > 0 ? totals.kcal / goals.calories : 0);
  const circumference = 2 * Math.PI * 38;

  const slotsHTML = MEAL_SLOTS.map(slot => {
    const items = meals[slot.id] || [];
    const slotKcal = items.reduce((s,i)=>s+(i.kcal||0),0);

    const itemsHTML = items.map((item, idx) => `
      <div class="meal-log-item">
        <div class="mli-left">
          <div class="mli-summary">${item.summary || item.description}</div>
          <div class="mli-macros">
            חלבון ${item.protein||0}g · פחמימות ${item.carbs||0}g · שומן ${item.fat||0}g
          </div>
        </div>
        <div class="mli-right">
          <button class="del-food-btn" data-slot="${slot.id}" data-idx="${idx}">✕</button>
          <div class="mli-kcal">${item.kcal||0}</div>
          <div class="mli-kcal-label">קל׳</div>
        </div>
      </div>`).join('');

    return `
      <div class="meal-slot-block">
        <div class="meal-slot-header">
          <div class="meal-slot-title">${slot.icon} ${slot.label}</div>
          <div class="meal-slot-right">
            <span class="meal-slot-kcal">${slotKcal} קל׳</span>
            <button class="add-meal-btn" data-slot="${slot.id}">+ הוסף</button>
          </div>
        </div>
        ${itemsHTML}
        ${items.length===0 ? `<div class="slot-empty">טרם נרשמה ארוחה</div>` : ''}
      </div>`;
  }).join('');

  document.getElementById('tab-meals').innerHTML = `
    <div class="meals-header">
      <h2>ארוחות</h2>
      <span class="date-badge">${fmtDate(today)}</span>
    </div>

    <div class="calorie-ring-card">
      <div class="ring-wrap">
        <svg class="ring-svg" viewBox="0 0 90 90" width="90" height="90">
          <circle class="ring-bg" cx="45" cy="45" r="38"/>
          <circle class="ring-fill" cx="45" cy="45" r="38"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${circumference*(1-kcalPct)}"/>
        </svg>
        <div class="ring-label">
          <div class="ring-kcal">${totals.kcal}</div>
          <div class="ring-sub">/ ${goals.calories} קל׳</div>
        </div>
      </div>
      <div class="macro-bars">${macroBarsHTML(totals, goals)}</div>
    </div>

    ${slotsHTML}
    <div style="height:1rem"></div>
  `;

  document.querySelectorAll('.add-meal-btn').forEach(btn => {
    btn.addEventListener('click', () => openAddMealModal(btn.dataset.slot));
  });
  document.querySelectorAll('.del-food-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteMealItem(btn.dataset.slot, +btn.dataset.idx));
  });
}

function deleteMealItem(slot, idx) {
  const today = todayStr();
  const meals = DB.getMeals(state.profile, today);
  if (meals[slot]) { meals[slot].splice(idx, 1); DB.saveMeals(state.profile, today, meals); }
  renderMeals();
}

function openAddMealModal(slotId) {
  const slot = MEAL_SLOTS.find(s => s.id === slotId);

  openModal(`
    <div class="modal-title">${slot.icon} ${slot.label}</div>
    <div class="meal-desc-hint">תאר מה אכלת — האפליקציה תחשב קלוריות אוטומטית 🧮</div>
    <textarea id="meal-desc-inp" class="meal-textarea" placeholder="למשל: 200 גרם אורז, 150 גרם חזה עוף, עגבנייה ומלפפון..."></textarea>

    <div id="ai-result-area" class="hidden"></div>

    <div class="modal-actions-row">
      <button class="modal-cancel-btn" onclick="closeModal()">ביטול</button>
      <button class="modal-confirm-btn" id="btn-calc-ai">חשב קלוריות 🧮</button>
    </div>
  `);

  document.getElementById('btn-calc-ai').addEventListener('click', () => runAIEstimate(slotId));
  const ta = document.getElementById('meal-desc-inp');
  ta.addEventListener('input', () => { ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; });
  setTimeout(() => ta.focus(), 100);
}

function runAIEstimate(slotId) {
  const desc = document.getElementById('meal-desc-inp').value.trim();
  if (!desc) { document.getElementById('meal-desc-inp').focus(); return; }

  const resultEl = document.getElementById('ai-result-area');
  const calcBtn  = document.getElementById('btn-calc-ai');

  try {
    const data = estimateCaloriesLocal(desc);
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="ai-result-card">
        <div class="ai-result-title">✅ חישוב קלוריות</div>
        <div class="ai-result-summary">${data.summary}</div>
        <div class="ai-macros-row">
          <div class="ai-macro-box"><div class="ai-macro-val">${data.kcal}</div><div class="ai-macro-lbl">קל׳</div></div>
          <div class="ai-macro-box"><div class="ai-macro-val">${data.protein}g</div><div class="ai-macro-lbl">חלבון</div></div>
          <div class="ai-macro-box"><div class="ai-macro-val">${data.carbs}g</div><div class="ai-macro-lbl">פחמימות</div></div>
          <div class="ai-macro-box"><div class="ai-macro-val">${data.fat}g</div><div class="ai-macro-lbl">שומן</div></div>
        </div>
      </div>
      <div class="modal-actions-row" style="margin-top:0.75rem;">
        <button class="modal-cancel-btn" id="btn-re-calc">ערוך</button>
        <button class="modal-confirm-btn" id="btn-save-meal">שמור ✓</button>
      </div>
    `;
    document.getElementById('btn-save-meal').addEventListener('click', () => {
      saveMealItem(slotId, { description: desc, summary: data.summary, kcal: data.kcal, protein: data.protein, carbs: data.carbs, fat: data.fat });
    });
    document.getElementById('btn-re-calc').addEventListener('click', () => {
      resultEl.classList.add('hidden');
      document.getElementById('meal-desc-inp').focus();
    });

  } catch (err) {
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="ai-error-card">
        <div style="font-size:1.5rem;margin-bottom:0.5rem;">🤔</div>
        <div style="font-weight:700;margin-bottom:0.35rem;">לא זיהיתי את המאכל</div>
        <div style="font-size:0.83rem;color:rgba(255,255,255,0.55);line-height:1.5;">${err.message}</div>
      </div>`;
  }
}

function saveMealItem(slotId, item) {
  const today = todayStr();
  const meals = DB.getMeals(state.profile, today);
  if (!meals[slotId]) meals[slotId] = [];
  meals[slotId].push(item);
  DB.saveMeals(state.profile, today, meals);
  closeModal();
  renderMeals();
}

// ─── Workout Tab ──────────────────────────────────────────────
function renderWorkout() {
  const p = state.profile;
  const today = todayStr();
  const workouts = DB.getWorkouts(p);
  const todayW = workouts.find(w => w.date === today);

  // last 14 entries excluding today
  const history = workouts.filter(w => w.date !== today).slice(0, 14);

  const histHTML = history.length === 0
    ? `<div class="empty-state"><div class="empty-icon">📋</div><p>עדיין אין היסטוריה</p></div>`
    : history.map(w => `
        <div class="workout-history-item">
          <div class="whi-emoji">${w.emoji}</div>
          <div class="whi-info">
            <div class="whi-type">${w.typeLabel}</div>
            ${w.notes ? `<div class="whi-notes">${w.notes}</div>` : ''}
          </div>
          <div class="whi-date">${shortDate(w.date)}</div>
        </div>`).join('');

  document.getElementById('tab-workout').innerHTML = `
    <div class="workout-tab-header">
      <h2>אימון היום</h2>
      <span class="date-badge">${fmtDate(today)}</span>
    </div>

    ${todayW ? `
      <div class="today-workout-card done">
        <div class="twc-emoji">${todayW.emoji}</div>
        <div class="twc-info">
          <div class="twc-type">${todayW.typeLabel}</div>
          ${todayW.notes ? `<div class="twc-notes">${todayW.notes}</div>` : ''}
        </div>
        <button class="twc-edit-btn" id="btn-edit-today">✏️</button>
      </div>
    ` : `
      <div class="today-workout-card empty">
        <div class="twc-empty-text">עדיין לא נרשם אימון להיום</div>
      </div>
    `}

    <button class="log-workout-btn" id="btn-log-workout">
      ${todayW ? '✏️ ערוך אימון' : '+ רשום אימון היום'}
    </button>

    <div class="section-header" style="margin-top:0.5rem;"><h3>היסטוריה</h3></div>
    ${histHTML}
    <div style="height:1rem"></div>
  `;

  document.getElementById('btn-log-workout').addEventListener('click', openLogWorkoutModal);
  if (todayW && document.getElementById('btn-edit-today')) {
    document.getElementById('btn-edit-today').addEventListener('click', openLogWorkoutModal);
  }
}

function shortDate(str) {
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { day:'numeric', month:'numeric' });
}

function openLogWorkoutModal() {
  const today = todayStr();
  const workouts = DB.getWorkouts(state.profile);
  const existing = workouts.find(w => w.date === today);
  const selType = existing ? existing.id_type : null;
  const existNotes = existing ? (existing.notes||'') : '';

  openModal(`
    <div class="modal-title">🏋️ מה עשית היום?</div>
    <div class="workout-type-grid" id="wtype-grid">
      ${WORKOUT_TYPES.map(wt => `
        <button class="wtype-btn ${selType===wt.id?'selected':''}" data-wt="${wt.id}" data-label="${wt.label}" data-emoji="${wt.emoji}">
          <span class="wtype-emoji">${wt.emoji}</span>
          <span class="wtype-label">${wt.label}</span>
        </button>`).join('')}
    </div>
    <textarea id="workout-notes-inp" class="meal-textarea" placeholder="הערות (לא חובה) — למשל: לחיצה 80 ק"ג, 4 סטים..." style="margin-top:0.75rem;">${existNotes}</textarea>
    <div class="modal-actions-row">
      <button class="modal-cancel-btn" onclick="closeModal()">ביטול</button>
      <button class="modal-confirm-btn" id="btn-save-workout">שמור</button>
    </div>
  `);

  let selectedType = selType ? WORKOUT_TYPES.find(w=>w.id===selType) : null;

  document.querySelectorAll('.wtype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wtype-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedType = WORKOUT_TYPES.find(w=>w.id===btn.dataset.wt);
    });
  });

  document.getElementById('btn-save-workout').addEventListener('click', () => {
    if (!selectedType) { return; }
    const notes = document.getElementById('workout-notes-inp').value.trim();
    const ws = DB.getWorkouts(state.profile).filter(w=>w.date!==today);
    ws.unshift({ id: uid(), id_type: selectedType.id, typeLabel: selectedType.label, emoji: selectedType.emoji, date: today, notes });
    DB.saveWorkouts(state.profile, ws);
    closeModal();
    updateStreakBadge();
    renderWorkout();
    if (state.tab === 'home') renderHome();
  });
}

// ─── Weight Tab ───────────────────────────────────────────────
function renderWeight() {
  const p = state.profile;
  const log = DB.getWeight(p);
  const goals = DB.getGoals(p);

  const sorted = [...log].sort((a,b)=>a.date.localeCompare(b.date));
  const last = sorted.length ? sorted[sorted.length-1] : null;
  const first = sorted.length > 1 ? sorted[0] : null;
  const diff = (last && first) ? (last.value - first.value).toFixed(1) : null;

  const histHTML = [...sorted].reverse().slice(0,30).map((entry, i) => {
    const prev = sorted[sorted.indexOf(entry)-1]; // reversed, so prev is actually newer
    // calculate diff vs previous in original sorted order
    const origIdx = sorted.indexOf(entry);
    const prevEntry = origIdx > 0 ? sorted[origIdx-1] : null;
    const d = prevEntry ? (entry.value - prevEntry.value) : null;
    const arrow = d===null ? '' : d>0 ? '<span class="weight-up">▲</span>' : d<0 ? '<span class="weight-down">▼</span>' : '→';
    return `
      <div class="weight-row ${i===0?'weight-row-today':''}">
        <span class="wr-date">${fmtDate(entry.date)}</span>
        <span class="wr-val">${entry.value} ק"ג</span>
        <span class="wr-diff">${arrow}${d!==null&&d!==0?Math.abs(d).toFixed(1):'&nbsp;'}</span>
      </div>`;
  }).join('');

  document.getElementById('tab-weight').innerHTML = `
    <div class="weight-header">
      <h2>שקילות</h2>
      <span class="date-badge">${fmtDate(todayStr())}</span>
    </div>

    <div class="weight-summary-cards">
      <div class="wscard">
        <div class="wscard-val">${last ? last.value+' ק"ג' : '–'}</div>
        <div class="wscard-label">משקל אחרון</div>
        <div class="wscard-sub">${last ? fmtDate(last.date) : 'לא נרשם עדיין'}</div>
      </div>
      <div class="wscard">
        <div class="wscard-val">${goals.targetWeight} ק"ג</div>
        <div class="wscard-label">יעד</div>
        <div class="wscard-sub">${last ? `נשאר ${Math.abs(last.value-goals.targetWeight).toFixed(1)} ק"ג` : ''}</div>
      </div>
      <div class="wscard ${diff!==null?(+diff<0?'wscard-green':+diff>0?'wscard-orange':''):''}">
        <div class="wscard-val">${diff!==null?(+diff>=0?'+':'')+diff+' ק"ג':'–'}</div>
        <div class="wscard-label">שינוי כולל</div>
        <div class="wscard-sub">${sorted.length > 1 ? `${sorted.length} שקילות` : ''}</div>
      </div>
    </div>

    ${sorted.length > 1 ? miniWeightChartHTML(sorted) : ''}

    <button class="log-weight-btn" id="btn-log-weight">⚖️ רשום משקל היום</button>

    ${sorted.length > 0 ? `
      <div class="section-header"><h3>היסטוריה</h3></div>
      <div class="weight-history">
        ${histHTML}
      </div>
    ` : `<div class="empty-state"><div class="empty-icon">⚖️</div><p>לא נרשמו שקילות עדיין<br>התחל לעקוב אחר המשקל שלך</p></div>`}

    <div style="height:1rem"></div>
  `;

  document.getElementById('btn-log-weight').addEventListener('click', openWeightModal);
}

function miniWeightChartHTML(sorted) {
  const last8 = sorted.slice(-8);
  const vals = last8.map(e => e.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const bars = last8.map(e => {
    const pct = ((e.value - min) / range * 70 + 10);
    return `<div class="mini-bar-col">
      <div class="mini-bar" style="height:${pct.toFixed(0)}px"></div>
      <div class="mini-bar-label">${e.value}</div>
    </div>`;
  }).join('');
  return `
    <div class="card" style="margin:0 1.25rem 1rem;">
      <div class="card-title">גרף משקל</div>
      <div class="mini-bar-chart" style="height:90px;align-items:flex-end;">${bars}</div>
    </div>`;
}

function openWeightModal() {
  const log = DB.getWeight(state.profile);
  const last = log.length ? log[log.length-1].value : '';
  openModal(`
    <div class="modal-title">⚖️ רשום משקל</div>
    <div style="text-align:center;color:rgba(255,255,255,0.45);font-size:0.88rem;margin-bottom:1rem;">${fmtDate(todayStr())}</div>
    <input class="modal-input" id="weight-inp" type="number" inputmode="decimal" step="0.1" placeholder='משקל בק"ג' value="${last}">
    <div class="modal-actions-row">
      <button class="modal-cancel-btn" onclick="closeModal()">ביטול</button>
      <button class="modal-confirm-btn" id="btn-save-weight">שמור</button>
    </div>
  `);
  setTimeout(() => document.getElementById('weight-inp')?.select(), 50);
  document.getElementById('btn-save-weight').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('weight-inp').value);
    if (!val || val < 20 || val > 300) return;
    const log = DB.getWeight(state.profile);
    // replace today if exists, else push
    const idx = log.findIndex(e => e.date === todayStr());
    if (idx >= 0) log[idx].value = val; else log.push({ date: todayStr(), value: val });
    DB.saveWeight(state.profile, log);
    closeModal();
    renderWeight();
    if (state.tab === 'home') renderHome();
  });
}

// ─── Settings Modal ───────────────────────────────────────────
function openSettingsModal() {
  const goals = DB.getGoals(state.profile);
  openModal(`
    <div class="modal-title">⚙️ יעדים יומיים</div>
    <div class="settings-goals-grid">
      <div class="sg-item"><label>קלוריות</label>
        <input class="modal-input sg-input" id="g-cal"   type="number" inputmode="numeric" value="${goals.calories}">
      </div>
      <div class="sg-item"><label>חלבון (g)</label>
        <input class="modal-input sg-input" id="g-prot"  type="number" inputmode="numeric" value="${goals.protein}">
      </div>
      <div class="sg-item"><label>פחמימות (g)</label>
        <input class="modal-input sg-input" id="g-carbs" type="number" inputmode="numeric" value="${goals.carbs}">
      </div>
      <div class="sg-item"><label>שומן (g)</label>
        <input class="modal-input sg-input" id="g-fat"   type="number" inputmode="numeric" value="${goals.fat}">
      </div>
      <div class="sg-item" style="grid-column:1/-1;"><label>משקל יעד (ק"ג)</label>
        <input class="modal-input sg-input" id="g-tw"    type="number" inputmode="decimal" step="0.1" value="${goals.targetWeight}">
      </div>
    </div>
    <div class="modal-actions-row" style="margin-top:0.75rem;">
      <button class="modal-cancel-btn" onclick="closeModal()">ביטול</button>
      <button class="modal-confirm-btn" id="btn-save-settings">שמור</button>
    </div>
  `);

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    DB.saveGoals(state.profile, {
      calories:     +document.getElementById('g-cal').value   || goals.calories,
      protein:      +document.getElementById('g-prot').value  || goals.protein,
      carbs:        +document.getElementById('g-carbs').value || goals.carbs,
      fat:          +document.getElementById('g-fat').value   || goals.fat,
      targetWeight: +document.getElementById('g-tw').value    || goals.targetWeight,
    });
    closeModal();
    renderActiveTab();
  });
}

// ─── Streak ───────────────────────────────────────────────────
function calcStreak(workouts) {
  const restId = 'rest';
  const activeDays = [...new Set(workouts.filter(w=>w.id_type!==restId).map(w=>w.date))].sort().reverse();
  if (!activeDays.length) return 0;
  let streak = 0;
  let cursor = new Date(); cursor.setHours(0,0,0,0);
  for (const ds of activeDays) {
    const d = new Date(ds+'T00:00:00');
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

// ─── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', renderLobby);
