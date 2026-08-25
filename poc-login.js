// POC: מוודא שדפדפן headless (Playwright) מצליח להתחבר לאתר החניון ולהגיע לטופס
// "כניסת מוזמן-רכב" — כדי לאמת שהכיוון אפשרי לפני שבונים שירות מלא.
// הרצה:  $env:HUJI_USER='emek.lehar'; $env:HUJI_PASS='...'; node poc-login.js
const { chromium } = require('playwright')

const USER = process.env.HUJI_USER
const PASS = process.env.HUJI_PASS
const BASE = 'https://parking.huji.ac.il/Bitachon/'
const HEADLESS = process.env.HEADFUL ? false : true

function noSpace(s) { return (s || '').replace(/\s+/g, '') }

;(async () => {
  if (!USER || !PASS) { console.log('חסר HUJI_USER / HUJI_PASS בסביבה'); process.exit(2) }
  const browser = await chromium.launch({ headless: HEADLESS })
  const ctx = await browser.newContext({ locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  try {
    console.log('→ goto', BASE)
    const resp = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
    console.log('   HTTP', resp && resp.status(), '| url:', page.url())
    await page.waitForTimeout(1500)

    // דף התחברות?
    if (await page.$('input[name="txtUser"]')) {
      console.log('→ דף התחברות זוהה — מתחבר…')
      await page.fill('input[name="txtUser"]', USER)
      await page.fill('input[name="txtPass"]', PASS)
      await Promise.all([
        page.waitForNavigation({ timeout: 45000 }).catch(() => {}),
        page.click('input[name="enter"]'),
      ])
      await page.waitForTimeout(2500)
    }

    const title = await page.title()
    const body = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').trim()
    console.log('→ אחרי התחברות | title:', title, '| url:', page.url())
    console.log('   body:', body.slice(0, 160))
    await page.screenshot({ path: 'after-login.png', fullPage: true })
    console.log('   📸 after-login.png נשמר')

    if (body.includes('משהו השתבש') || /error/i.test(title)) {
      console.log('❌ נראה דף שגיאה/WAF — headless נחסם.')
    } else if (body.includes('ברוך') || body.includes('אישורי כניסה') || body.includes('שוברי כניסה')) {
      console.log('✅ התחברות עברה! (ה-WAF לא חסם דפדפן headless)')
      // ניסיון ניווט לטופס "כניסת מוזמן-רכב" לפי קישור התפריט
      const url = await page.evaluate(() => {
        const els = document.querySelectorAll('a,[onclick],li')
        for (const e of els) {
          const t = (e.textContent || '').replace(/\s+/g, ' ').trim()
          if (t && t.length < 30 && t.replace(/\s+/g, '').indexOf('כניסתמוזמן-רכב') >= 0) {
            const s = ((e.getAttribute('onclick') || '') + ' ' + (e.getAttribute('href') || ''))
            const m = s.match(/Navigate(?:Url|Modul)\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]+)['"]/)
            if (m) { try { return new URL(m[1], document.baseURI).href } catch (e) { return null } }
          }
        }
        return null
      })
      console.log('   קישור "כניסת מוזמן-רכב":', url)
      if (url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(1500)
        const t2 = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').trim()
        console.log('   מסך היעד body:', t2.slice(0, 120))
        await page.screenshot({ path: 'temp-form.png', fullPage: true })
        console.log('   📸 temp-form.png נשמר', t2.includes('כמות כניסות') ? '— זוהה טופס כניסת מוזמן ✅' : '')
      }
    } else {
      console.log('⚠️ לא ברור — בדוק את after-login.png')
    }
  } catch (e) {
    console.log('שגיאה:', e.message)
  } finally {
    await browser.close()
  }
})()
