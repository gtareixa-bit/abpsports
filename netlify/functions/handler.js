// ABP Sport – netlify/functions/handler.js
// Procesa ?action=inscripcion | ?action=contacto con CSRF, rate limit, sanitización y antibots.
'use strict';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://abpsports.es,https://www.abpsports.es')
  .split(',').map(s => s.trim());
const LIMITS = { inscripcion: 5, contacto: 3 }; // por IP / hora
const WINDOW_MS = 60 * 60 * 1000;
const MIN_FILL_MS = 3000;
const hits = new Map(); // memoria por instancia (best effort)

const DISCIPLINAS = (process.env.DISCIPLINAS || 'boxeo,kickboxing,muay thai,mma,bjj,grappling,defensa personal')
  .split(',').map(s => s.trim().toLowerCase());

function headers(origin) {
  const h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Credentials'] = 'true';
    h['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return h;
}
const reply = (code, body, origin) => ({ statusCode: code, headers: headers(origin), body: JSON.stringify(body) });

function clientIp(event) {
  return (event.headers['x-nf-client-connection-ip'] ||
    (event.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
}

function rateLimited(key, max) {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  const e = hits.get(key) || { start: now, n: 0 };
  e.n++; hits.set(key, e);
  return e.n > max;
}

function cookie(event, name) {
  const raw = event.headers.cookie || '';
  const m = raw.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const clean = (v, max = 500) => String(v == null ? '' : v)
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/javascript:/gi, '')
  .trim().slice(0, max);

const V = {
  nombre: v => /^[A-Za-zÀ-ÿñÑ' -]{2,80}$/.test(v),
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254,
  telefono: v => /^\+?[0-9 ]{9,15}$/.test(v),
  edad: v => { const n = Number(v); return Number.isInteger(n) && n >= 4 && n <= 99; },
  disciplina: v => DISCIPLINAS.includes(v.toLowerCase()),
  mensaje: v => v.length >= 5 && v.length <= 2000
};

const BOT_UA = /(bot|crawl|spider|curl|wget|python-requests|httpclient|headless|phantom|scrapy)/i;

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  if (event.httpMethod === 'OPTIONS') return reply(204, {}, origin);
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Método no permitido' }, origin);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: 'Origen no permitido' }, origin);

  const action = (event.queryStringParameters || {}).action;
  if (!LIMITS[action]) return reply(400, { error: 'Acción no válida' }, origin);

  const ua = event.headers['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return reply(403, { error: 'Solicitud rechazada' }, origin);

  const ip = clientIp(event);
  if (rateLimited(`${action}:${ip}`, LIMITS[action])) return reply(429, { error: 'Demasiados intentos. Prueba más tarde.' }, origin);

  let data;
  try {
    const ct = (event.headers['content-type'] || '').toLowerCase();
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '');
    if (raw.length > 20000) return reply(413, { error: 'Petición demasiado grande' }, origin);
    data = ct.includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
  } catch { return reply(400, { error: 'Datos no válidos' }, origin); }

  // CSRF: double-submit (cookie == cabecera/campo)
  const sent = event.headers['x-csrf-token'] || data.csrf_token || '';
  if (!safeEqual(cookie(event, 'abp_csrf'), sent) || sent.length < 32) {
    return reply(403, { error: 'Token de seguridad no válido. Recarga la página.' }, origin);
  }

  // Antibots: honeypot + tiempo de rellenado
  if (data.website) return reply(200, { ok: true, message: 'Recibido' }, origin); // silencioso
  const t = Number(data._submit_time);
  if (!t || Date.now() - t < MIN_FILL_MS) return reply(403, { error: 'Envío demasiado rápido' }, origin);

  const required = action === 'inscripcion'
    ? ['nombre', 'email', 'telefono', 'edad', 'disciplina']
    : ['nombre', 'email', 'mensaje'];
  const out = {}; const errors = {};
  for (const f of required) {
    const v = clean(data[f], f === 'mensaje' ? 2000 : 254);
    if (!v || !V[f](v)) errors[f] = 'Campo no válido';
    out[f] = v;
  }
  if (data.telefono && !out.telefono) out.telefono = clean(data.telefono, 20);
  if (Object.keys(errors).length) return reply(422, { error: 'Revisa los campos', fields: errors }, origin);

  // TODO: enviar notificación (Resend/SendGrid) y/o guardar en BD usando variables de entorno.
  // Nunca registrar datos personales completos en logs (RGPD).
  console.log(`[${action}] ok ip=${ip.replace(/\d+$/, 'x')}`);

  return reply(200, {
    ok: true,
    message: action === 'inscripcion' ? '¡Inscripción recibida! Te contactaremos pronto.' : '¡Mensaje enviado! Gracias.'
  }, origin);
};
