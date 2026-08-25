// מודול האוטומציה של החניון (Playwright headless). חסר-מצב (stateless) כדי
// להתאים ל-Cloud Run: כל קריאה מריצה דפדפן טרי — התחברות → ניווט ל"כניסת
// מוזמן-רכב" → מילוי; ואז או צילום ("הכנה") או לחיצת שמירה ("אישור").
const { chromium } = require('playwright')

const BASE = 'https://parking.huji.ac.il/Bitachon/'

// פונקציית המילוי — מוזרקת ורצה בתוך הדף. אותה לוגיקה כמו התוסף:
// תווית לפי תא סמוך, תאריכים לפי מיקום, פיצול סלולרי לקידומת+מספר.
function fillInPage(d) {
  const n = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const inputs = () => Array.prototype.filter.call(document.querySelectorAll('input,textarea'), (e) => e.type !== 'hidden' && e.type !== 'radio' && e.type !== 'checkbox' && e.type !== 'file')
  const ctrls = (t) => Array.prototype.slice.call(document.querySelectorAll('input[type=' + t + ']'))
  function lbl(e) {
    if (e.id) { const L = document.getElementsByTagName('label'); for (let i = 0; i < L.length; i++) if (L[i].htmlFor === e.id) return n(L[i].textContent) }
    const td = e.closest && e.closest('td')
    if (td) { for (let p = td.previousElementSibling; p; p = p.previousElementSibling) { const t = n(p.textContent); if (t) return t } for (let x = td.nextElementSibling; x; x = x.nextElementSibling) { const t = n(x.textContent); if (t) return t } }
    return n(e.placeholder || '')
  }
  function ownLabel(e) { const td = e.closest && e.closest('td'); if (!td) return ''; const c = td.cloneNode(true); const rm = c.querySelectorAll('input,select,textarea,button,img,a'); for (let i = 0; i < rm.length; i++) rm[i].remove(); return n(c.textContent) }
  function clbl(e) {
    if (e.id) { const L = document.getElementsByTagName('label'); for (let i = 0; i < L.length; i++) if (L[i].htmlFor === e.id) return n(L[i].textContent) }
    const pl = e.closest && e.closest('label'); if (pl) return n(pl.textContent)
    let s = e.nextSibling, t = ''; while (s) { if (s.nodeType === 1 && s.tagName === 'INPUT') break; if (s.nodeType === 1 && s.getElementsByTagName && s.getElementsByTagName('input').length) break; t += (s.textContent || ''); s = s.nextSibling } return n(t)
  }
  function setVal(e, v) { e.focus(); e.value = v;['input', 'change', 'blur'].forEach((t) => e.dispatchEvent(new Event(t, { bubbles: true }))) }
  function fillText(f, txts, val) { for (let i = 0; i < f.length; i++) { const L = lbl(f[i]); for (let j = 0; j < txts.length; j++) if (L.indexOf(txts[j]) >= 0) { setVal(f[i], val); return txts[0] } } return null }
  function clickCtrl(type, want) { const rs = ctrls(type); let ex = null, inc = null; for (let i = 0; i < rs.length; i++) { const L = clbl(rs[i]); if (L === want) { ex = rs[i]; break } if (!inc && L.indexOf(want) >= 0) inc = rs[i] } const e = ex || inc; if (e) { if (!e.checked) e.click(); return want } return null }
  function selectByText(sel, want) { const w = (want || '').replace(/\D/g, '').replace(/^0+/, ''); if (!w) return false; for (let i = 0; i < sel.options.length; i++) { const o = sel.options[i]; const t = (o.textContent || '').replace(/\D/g, '').replace(/^0+/, ''); const v = (o.value || '').replace(/\D/g, '').replace(/^0+/, ''); if (t === w || v === w) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true } } return false }
  function fillPhone(local) { const ph = (local || '').replace(/\D/g, ''); if (!ph) return false; const input = inputs().find((e) => lbl(e).indexOf('סלולרי') >= 0); if (!input) return false; let prefix = '', rest = ph; if (ph[0] === '0' && ph.length >= 9) { prefix = ph.slice(0, 3); rest = ph.slice(3) } setVal(input, rest); if (prefix) { const td = input.closest && input.closest('td'); const tr = td && td.closest('tr'); const sel = tr && tr.querySelector('select'); if (sel) selectByText(sel, prefix) } return true }
  function fillDates(d) { if (!d.dateFrom && !d.dateTo) return []; const cands = inputs().filter((e) => { const v = (e.value || '').trim(); if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return true; const L = ownLabel(e) + ' ' + lbl(e); return L.indexOf('תאריך') >= 0 || L.indexOf('עד') >= 0 }); let from = cands[0] || null, to = cands[1] || null; if (from && ownLabel(from).indexOf('עד') >= 0 && ownLabel(from).indexOf('תאריך') < 0) { const t = from; from = to; to = t } const done = []; if (d.dateFrom && from) { setVal(from, d.dateFrom); done.push('תאריך') } if (d.dateTo && to) { setVal(to, d.dateTo); done.push('עד') } return done }

  const f = inputs(), done = []
  const T = [['lastName', ['שם משפחה']], ['firstName', ['שם פרטי']], ['email', ['אימייל']], ['carNumber', ['מספר רכב']], ['count', ['כמות כניסות']], ['hour', ['משעה']], ['msgToGuest', ['הודעה למוזמן']]]
  T.forEach((m) => { if (d[m[0]]) { const r = fillText(f, m[1], d[m[0]]); if (r) done.push(r) } })
  if (d.phone && fillPhone(d.phone)) done.push('סלולרי')
  fillDates(d).forEach((x) => done.push(x))
  if (d.gate) { const gm = { all: 'הכל', general: 'כללי', neveShaanan: 'נוה שאנן' }; const r = clickCtrl('checkbox', gm[d.gate]); if (r) done.push('שער') }
  if (d.notify) { const nm = { sms: 'מסרון', email: 'מייל', both: 'מייל+מסרון', none: 'לא' }; const r = clickCtrl('radio', nm[d.notify]); if (r) done.push('דיווח') }
  let sysMsg = ''
  const els = document.querySelectorAll('div,td,span,p')
  for (let i = 0; i < els.length; i++) { const el = els[i]; if (!el.getClientRects().length) continue; const t = n(el.textContent); if (t.indexOf('הודעת מערכת') >= 0 && t.length < 400) { sysMsg = n(t.replace('הודעת מערכת', '').replace(/אישור/g, '')); if (sysMsg) break } }
  return { done, sysMsg }
}

function readSysMsg() {
  const n = (s) => (s || '').replace(/\s+/g, ' ').trim()
  const els = document.querySelectorAll('div,td,span,p')
  for (let i = 0; i < els.length; i++) { const el = els[i]; if (!el.getClientRects().length) continue; const t = n(el.textContent); if (t.indexOf('הודעת מערכת') >= 0 && t.length < 400) { const m = n(t.replace('הודעת מערכת', '').replace(/אישור/g, '')); if (m) return m } }
  return ''
}

// מריץ את זרימת האורח. save=false → צילום לאישור; save=true → לחיצת שמירה.
async function runGuest(guest, { save }) {
  const user = process.env.HUJI_USER, pass = process.env.HUJI_PASS
  if (!user || !pass) throw new Error('חסרים פרטי התחברות (HUJI_USER/HUJI_PASS)')
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    const ctx = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1280, height: 950 } })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(1200)
    if (await page.$('input[name="txtUser"]')) {
      await page.fill('input[name="txtUser"]', user)
      await page.fill('input[name="txtPass"]', pass)
      await Promise.all([page.waitForNavigation({ timeout: 45000 }).catch(() => {}), page.click('input[name="enter"]')])
      await page.waitForTimeout(2500)
    }
    const bodyAfter = ((await page.textContent('body')) || '')
    if (bodyAfter.includes('משהו השתבש')) throw new Error('WAF/שגיאת אתר — headless נחסם')
    if (await page.$('input[name="txtUser"]')) throw new Error('ההתחברות נכשלה — בדוק שם משתמש/סיסמה')

    const url = await page.evaluate(() => { const els = document.querySelectorAll('a,[onclick],li'); for (const e of els) { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (t && t.length < 30 && t.replace(/\s+/g, '').indexOf('כניסתמוזמן-רכב') >= 0) { const s = ((e.getAttribute('onclick') || '') + ' ' + (e.getAttribute('href') || '')); const m = s.match(/Navigate(?:Url|Modul)\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/); if (m) { try { return new URL(m[1], document.baseURI).href } catch (e) { return null } } } } return null })
    if (!url) throw new Error('לא נמצא קישור לטופס "כניסת מוזמן-רכב"')
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForTimeout(1500)

    const res = await page.evaluate(fillInPage, guest)
    await page.waitForTimeout(600)

    // אזהרה שעלתה תוך כדי מילוי (למשל "קיימת כבר הזמנה") — לא שומרים, מדווחים.
    if (res.sysMsg) {
      const shot = await page.screenshot({ fullPage: true })
      return { ok: false, message: res.sysMsg, done: res.done, screenshot: shot.toString('base64') }
    }

    if (!save) {
      const shot = await page.screenshot({ fullPage: true })
      return { ok: true, phase: 'prepared', done: res.done, screenshot: shot.toString('base64') }
    }

    // שמירה
    const btn = await page.$('input[type=submit][value="שמירה"], input[value="שמירה"]')
    if (!btn) throw new Error('לא נמצא כפתור שמירה')
    await btn.click()
    await page.waitForTimeout(3000)
    const message = await page.evaluate(readSysMsg)
    const shot = await page.screenshot({ fullPage: true })
    return { ok: true, phase: 'saved', message: message || 'נשמר', done: res.done, screenshot: shot.toString('base64') }
  } finally {
    await browser.close()
  }
}

module.exports = { runGuest }
