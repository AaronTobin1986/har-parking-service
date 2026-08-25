# הר — שירות חניון (Cloud Run)

דפדפן headless (Playwright) שממלא את טופס "כניסת מוזמן-רכב" של החניון עבור הר,
כדי לאפשר הוספת אורח **מהטלפון** (איפה שאין תוסף). חסר-מצב, scale-to-zero.

## מסלולי API
- `GET /` — בדיקת חיים.
- `POST /guest/prepare` — `{ token, guest }` → מתחבר, ממלא, מחזיר `{ ok, screenshot(base64), done }` (לא שומר).
- `POST /guest/confirm` — `{ token, guest }` → מתחבר, ממלא, לוחץ שמירה → `{ ok, message, done }`.

`guest`: `{ carNumber, phone, firstName, lastName, email, dateFrom, dateTo, gate, notify, count, hour, msgToGuest }`
(תאריכים DD/MM/YYYY; טלפון מקומי 05XXXXXXXX; gate: all|general|neveShaanan; notify: sms|email|both|none)

## פריסה ל-Cloud Run (מ-Cloud Shell, אזור תל אביב)
```bash
git clone https://github.com/AaronTobin1986/har-parking-service
cd har-parking-service
gcloud run deploy har-parking \
  --source . --region me-west1 --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 120 \
  --set-env-vars "HUJI_USER=emek.lehar,HUJI_PASS=<סיסמה>,API_TOKEN=<טוקן>"
```
scale-to-zero (מינימום 0 מופעים) → 0 ₪ כשלא בשימוש; מכסת החינם מכסה שימוש נמוך.

## משתני סביבה
- `HUJI_USER`, `HUJI_PASS` — פרטי ההתחברות לאתר החניון.
- `API_TOKEN` — טוקן שמגן על ה-API (נשלח מהאתר של הר בכותרת Authorization).

## פיתוח מקומי
`npm ci && npx playwright install chromium` ואז `npm run poc` / `npm run test-guest`.
