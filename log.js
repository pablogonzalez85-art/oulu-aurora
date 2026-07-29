// Hourly logger. Not linked from the site and not called by visitors — an external
// cron hits it with the shared secret, it gathers one snapshot and appends a row to
// a Google Sheet.
//
// Environment variables (Cloudflare dashboard → Workers & Pages → your project →
// Settings → Variables and Secrets). Add them to Production, and to Preview if you
// want the logger working on preview deployments too.
//   LOG_SECRET  a long random string, also used by the cron URL and the Apps Script
//   SHEET_URL   the /exec URL of the deployed Apps Script web app
//
// Raw inputs are stored alongside the computed headline, so if the verdict logic
// changes later the history can be re-derived from what was actually measured.

const BUILD = '2026-07-29-cloudflare';
const LAT = 65.0121, LON = 25.4651, RAD = Math.PI / 180, TZ = 'Europe/Helsinki';

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

/* Provisional thresholds in nT — must match NT in index.html. Revised 29/07/2026. */
const NT = { quiet: 40, active: 80, storm: 250 };

/* ---------- astronomy, same maths as the page ---------- */
const dnum = d => d.getTime() / 86400000 + 2440587.5 - 2451545.0;
const sunEclLon = d => { const L = (280.460 + 0.9856474 * d) % 360, g = (357.528 + 0.9856003 * d) % 360;
  return L + 1.915 * Math.sin(g * RAD) + 0.020 * Math.sin(2 * g * RAD); };
const gmstDeg = d => { let g = (18.697374558 + 24.06570982441908 * d) % 24; if (g < 0) g += 24; return g * 15; };
function altAz(ra, dec, d) {
  const ha = ((gmstDeg(d) + LON - ra) % 360 + 540) % 360 - 180;
  const alt = Math.asin(Math.sin(LAT * RAD) * Math.sin(dec * RAD)
    + Math.cos(LAT * RAD) * Math.cos(dec * RAD) * Math.cos(ha * RAD)) / RAD;
  const sinA = -Math.sin(ha * RAD) * Math.cos(dec * RAD) / Math.cos(alt * RAD);
  const cosA = (Math.sin(dec * RAD) - Math.sin(alt * RAD) * Math.sin(LAT * RAD))
    / (Math.cos(alt * RAD) * Math.cos(LAT * RAD));
  return { alt, az: ((Math.atan2(sinA, cosA) / RAD) % 360 + 360) % 360 };
}
function sunAlt(x) {
  const d = dnum(x), lam = sunEclLon(d), e = 23.4397;
  return altAz(Math.atan2(Math.cos(e * RAD) * Math.sin(lam * RAD), Math.cos(lam * RAD)) / RAD,
    Math.asin(Math.sin(e * RAD) * Math.sin(lam * RAD)) / RAD, d).alt;
}
function moonAt(x) {
  const d = dnum(x), e = 23.4397;
  const L = 218.316 + 13.176396 * d, M = 134.963 + 13.064993 * d, F = 93.272 + 13.229350 * d;
  const lam = L + 6.289 * Math.sin(M * RAD), bet = 5.128 * Math.sin(F * RAD);
  const ra = Math.atan2(Math.sin(lam * RAD) * Math.cos(e * RAD) - Math.tan(bet * RAD) * Math.sin(e * RAD),
    Math.cos(lam * RAD)) / RAD;
  const dec = Math.asin(Math.sin(bet * RAD) * Math.cos(e * RAD)
    + Math.cos(bet * RAD) * Math.sin(e * RAD) * Math.sin(lam * RAD)) / RAD;
  const el = ((lam - sunEclLon(d)) % 360 + 360) % 360, pa = altAz(ra, dec, d);
  return { alt: pa.alt, az: pa.az, illum: (1 - Math.cos(el * RAD)) / 2 };
}
/* lowest the sun gets on the night starting from this instant */
function minSunTonight(now) {
  let lo = 90;
  for (let m = 0; m <= 1440; m += 15) { const v = sunAlt(new Date(now.getTime() + m * 60000)); if (v < lo) lo = v; }
  return lo;
}
const tierOf = e => e > -6 ? 0 : e > -12 ? 1 : e > -18 ? 2 : 3;

/* ---------- verdict cascade, mirrored from index.html ---------- */
const VERDICT_RULES = [
  ['darkNever', c => c.darkT === 0],
  ['nautQuiet', c => c.darkT === 1 && c.quiet],
  ['naut',      c => c.darkT === 1],
  ['overcast',  c => c.overcast],
  ['quiet',     c => c.quiet],
  ['goNow',     c => c.storm && c.clear],
  ['go',        c => c.good  && c.clear],
  ['moon',      c => c.moonBad],
  ['cloudWay',  c => c.murky],
  ['look',      () => true]
];
const verdictKey = c => VERDICT_RULES.find(r => r[1](c))[0];

const localTime = d => new Intl.DateTimeFormat('sv-SE',
  { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(' ', ' ');

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const secret = context.env.LOG_SECRET;
  if (!secret || url.searchParams.get('key') !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorised' }), { status: 401, headers: HEADERS });
  }

  const now = new Date();
  const notes = [];

  /* space weather, straight from the endpoint the page uses */
  let sw = {};
  try {
    const r = await fetch(url.origin + '/api/spacewx');
    sw = await r.json();
  } catch (e) { notes.push('spacewx: ' + e.message); }

  /* current weather */
  let wx = {};
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
      + `&current=temperature_2m,cloud_cover,precipitation,relative_humidity_2m,wind_speed_10m`
      + `&timezone=Europe%2FHelsinki`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    wx = (await r.json()).current || {};
  } catch (e) { notes.push('open-meteo: ' + e.message); }

  /* local astronomy */
  const sun = sunAlt(now), minSun = minSunTonight(now), moon = moonAt(now);
  const darkT = tierOf(minSun);

  const oulujarvi = sw.local?.all?.find(x => x.station === 'Oulujärvi')?.r ?? null;
  const ranua     = sw.local?.all?.find(x => x.station === 'Ranua')?.r ?? null;
  const lr        = sw.local?.best?.r ?? null;
  const kp        = sw.peak ?? sw.current ?? null;
  const cloud     = wx.cloud_cover ?? null;

  const key = verdictKey({
    darkT,
    quiet:    lr !== null ? lr < NT.quiet   : (kp !== null && kp < 1.5),
    good:     lr !== null ? lr >= NT.active : (kp !== null && kp >= 3.5),
    storm:    lr !== null ? lr >= NT.storm  : (kp !== null && kp >= 5),
    clear:    cloud === null || cloud < 45,
    murky:    cloud !== null && cloud >= 45 && cloud <= 80,
    overcast: cloud !== null && cloud > 80,
    moonBad:  moon.alt > 0 && moon.illum > 0.7
  });

  const row = {
    ts_utc:        now.toISOString(),
    ts_local:      localTime(now),
    sun_alt:       +sun.toFixed(2),
    sun_min_night: +minSun.toFixed(2),
    dark_tier:     darkT,
    moon_illum:    +(moon.illum * 100).toFixed(1),
    moon_alt:      +moon.alt.toFixed(1),
    moon_az:       +moon.az.toFixed(1),
    cloud_pct:     cloud,
    rain_mm:       wx.precipitation ?? null,
    humidity_pct:  wx.relative_humidity_2m ?? null,
    wind_ms:       wx.wind_speed_10m ?? null,
    temp_c:        wx.temperature_2m ?? null,
    fmi_oulujarvi_nt: oulujarvi,
    fmi_ranua_nt:     ranua,
    kp_now:        sw.current ?? null,
    kp_peak_24h:   sw.peak ?? null,
    bz_nt:         sw.bz ?? null,
    verdict:       key,
    sw_status:     sw.status ?? null,
    notes:         [...(sw.notes || []), ...notes].join(' | ')
  };

  let sheet = 'not configured';
  if (context.env.SHEET_URL) {
    try {
      const r = await fetch(context.env.SHEET_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: secret, row })
      });
      sheet = r.ok ? 'ok' : 'HTTP ' + r.status;
    } catch (e) { sheet = 'failed: ' + e.message; }
  }

  return new Response(JSON.stringify({ build: BUILD, sheet, row }, null, 1), { headers: HEADERS });
}
