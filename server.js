// שרת HTTP קטן (ללא תלויות) שעוטף את האוטומציה. שני מסלולים:
//   POST /guest/prepare  → מתחבר, ממלא, מחזיר צילום מסך לאישור (לא שומר).
//   POST /guest/confirm  → מתחבר, ממלא, לוחץ שמירה, מחזיר את הודעת החניון.
// אימות: כותרת Authorization: Bearer <API_TOKEN>  (או שדה token בגוף).
// משתני סביבה: HUJI_USER, HUJI_PASS, API_TOKEN, PORT (Cloud Run מזריק PORT).
const http = require('http')
const { runGuest } = require('./parking')

const PORT = process.env.PORT || 8080
const API_TOKEN = process.env.API_TOKEN || ''

function send(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy() })
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) } })
  })
}

function authed(req, body) {
  if (!API_TOKEN) return true // אם לא הוגדר טוקן — פתוח (לא מומלץ לפרודקשן)
  const h = req.headers['authorization'] || ''
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : ''
  return bearer === API_TOKEN || body.token === API_TOKEN
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.method === 'GET' && req.url === '/') return send(res, 200, { ok: true, service: 'har-parking' })

  if (req.method === 'POST' && (req.url === '/guest/prepare' || req.url === '/guest/confirm')) {
    const body = await readBody(req)
    if (!authed(req, body)) return send(res, 401, { ok: false, error: 'unauthorized' })
    const guest = body.guest || {}
    if (!guest.carNumber || !guest.dateFrom) return send(res, 400, { ok: false, error: 'חסר מספר רכב/תאריך' })
    const save = req.url === '/guest/confirm'
    try {
      const result = await runGuest(guest, { save })
      return send(res, 200, result)
    } catch (e) {
      return send(res, 500, { ok: false, error: String(e && e.message || e) })
    }
  }

  send(res, 404, { ok: false, error: 'not found' })
})

server.listen(PORT, () => console.log('har-parking service on :' + PORT))
