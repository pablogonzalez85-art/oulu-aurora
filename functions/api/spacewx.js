// Space weather for the Oulu page, fetched server-side where CORS does not apply.
//  - local magnetic disturbance from FMI magnetometers (CC BY 4.0)
//  - planetary Kp, now and forecast, from NOAA SWPC
//  - solar wind Bz from NOAA SWPC
// Each source fails independently; failures land in `notes`.

const BUILD = '2026-07-28-health';

const FMI = 'https://opendata.fmi.fi/wfs';
const FMI_SQ = 'fmi::observations::magnetometer::simple';
const WINDOW_MIN = 90;

// The magnetometer stored query ignores bbox/place and always returns the whole
// network, so we fetch once and split by coordinates ourselves.
const STATIONS = [
  { name: 'Oulujärvi', km: 100, lat: 64.5107, lon: 27.2267 },
  { name: 'Ranua',     km: 107, lat: 65.8957, lon: 26.4092 }
];

const KP_NOW = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const KP_FC = [
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
  'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
];
const BZ = [
  'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
  'https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json',
  'https://services.swpc.noaa.gov/products/solar-wind/mag-6-hour.json',
  'https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json'
];

const UA = { 'user-agent': 'oulu-darkness/1.0' };
// No access-control-allow-origin header. The page is served from the same origin so
// it needs none, and its absence means a copy of this site hosted elsewhere cannot
// use this endpoint as its backend. To deliberately allow an embed later, add
// 'access-control-allow-origin': '<https://that-domain>' for that origin only.
const HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'public, max-age=300'
};

const isoZ = d => new Date(d).toISOString().replace(/\.\d+Z$/, 'Z');
const range = a => Math.max.apply(null, a) - Math.min.apply(null, a);

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ---------- FMI: split the network response by station position ---------- */
function byStation(xml) {
  const out = {};
  const re = /<BsWfs:BsWfsElement\b[\s\S]*?<\/BsWfs:BsWfsElement>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const b = m[0];
    const pos = b.match(/<gml:pos>\s*(-?[\d.]+)\s+(-?[\d.]+)/);
    const nm = b.match(/<BsWfs:ParameterName>([^<]+)</);
    const vv = b.match(/<BsWfs:ParameterValue>([^<]+)</);
    if (!pos || !nm || !vv) continue;
    const v = parseFloat(vv[1]);
    if (isNaN(v)) continue;
    const key = (+pos[1]).toFixed(3) + ',' + (+pos[2]).toFixed(3);
    if (!out[key]) out[key] = { lat: +pos[1], lon: +pos[2], X: [], Y: [] };
    if (nm[1].startsWith('MAGNX')) out[key].X.push(v);
    else if (nm[1].startsWith('MAGNY')) out[key].Y.push(v);
  }
  return out;
}

async function localDisturbance(notes) {
  const end = Date.now(), start = end - WINDOW_MIN * 60000;
  const url = `${FMI}?service=WFS&version=2.0.0&request=getFeature`
    + `&storedquery_id=${FMI_SQ}`
    + `&parameters=MAGNX_PT1M_AVG,MAGNY_PT1M_AVG`
    + `&starttime=${isoZ(start)}&endtime=${isoZ(end)}&timestep=3`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const groups = byStation(await r.text());
  const seen = Object.keys(groups).length;

  const found = [];
  for (const st of STATIONS) {
    let hit = null;
    for (const k in groups) {
      const g = groups[k];
      if (Math.abs(g.lat - st.lat) < 0.05 && Math.abs(g.lon - st.lon) < 0.10) { hit = g; break; }
    }
    if (!hit) { notes.push(`fmi ${st.name}: no matching station in response`); continue; }
    if (hit.X.length < 5 || hit.Y.length < 5) {
      notes.push(`fmi ${st.name}: only ${hit.X.length}/${hit.Y.length} samples`); continue;
    }
    // Maximum fluctuation of the horizontal field. Using the RANGE of each
    // component cancels the station baseline, so this is valid whether the
    // station reports absolute field or deviations.
    found.push({
      station: st.name, km: st.km, minutes: WINDOW_MIN,
      r: +Math.max(range(hit.X), range(hit.Y)).toFixed(1),
      samples: hit.X.length
    });
  }
  if (!found.length) throw new Error(`no usable station (saw ${seen} in response)`);
  // STATIONS is in distance order, so found[0] is the nearest that reported.
  return { best: found[0], all: found, stationsSeen: seen };
}

/* ---------- NOAA ---------- */
async function kpNow(notes) {
  try {
    const rows = await getJson(KP_NOW);
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = parseFloat(rows[i].kp_index);
      if (!isNaN(v)) return v;
    }
    notes.push('kp now: no numeric kp_index');
  } catch (e) { notes.push('kp now: ' + e.message); }
  return null;
}

const pickKey = (obj, re) => { for (const k in obj) if (re.test(k)) return k; return null; };
const parseT = raw => Date.parse(/[TZ]/.test(raw) ? raw : String(raw).replace(' ', 'T') + 'Z');

async function kpForecast(notes) {
  for (const url of KP_FC) {
    try {
      const rows = await getJson(url);
      if (!Array.isArray(rows) || rows.length < 2) throw new Error('not an array');
      let body = rows, getT, getK;
      if (Array.isArray(rows[0])) {                 // header row + arrays
        const head = rows[0].map(x => String(x));
        const ti = head.findIndex(h => /time/i.test(h));
        const ki = head.findIndex(h => /^kp|kp_?index|k_?index/i.test(h));
        if (ti < 0 || ki < 0) throw new Error('cols=' + head.join('|'));
        body = rows.slice(1); getT = r => r[ti]; getK = r => r[ki];
      } else {                                      // array of objects
        const tk = pickKey(rows[0], /time/i);
        const kk = pickKey(rows[0], /^kp|kp_?index|k_?index/i);
        if (!tk || !kk) throw new Error('keys=' + Object.keys(rows[0]).join('|'));
        getT = r => r[tk]; getK = r => r[kk];
      }
      const t0 = Date.now(), out = [];
      for (const r of body) {
        const v = parseFloat(getK(r)), t = parseT(getT(r));
        if (isNaN(v) || isNaN(t) || t < t0 - 6 * 36e5) continue;
        out.push({ t: new Date(t).toISOString(), kp: v });
      }
      if (!out.length) throw new Error(`${body.length} rows, none in range`);
      return out;
    } catch (e) { notes.push('kp fc: ' + e.message); }
  }
  return [];
}

async function solarBz(notes) {
  const BZRE = /^bz|bz_?gsm|bz_?gse/i;
  for (const url of BZ) {
    try {
      const d = await getJson(url);
      if (Array.isArray(d)) {
        if (!d.length) throw new Error('empty array');
        if (Array.isArray(d[0])) {                  // header row + arrays
          const head = d[0].map(x => String(x));
          const bi = head.findIndex(h => BZRE.test(h));
          if (bi < 0) throw new Error('cols=' + head.join('|'));
          for (let i = d.length - 1; i >= 1; i--) {
            const v = parseFloat(d[i][bi]); if (!isNaN(v)) return v;
          }
          throw new Error('no numeric value in bz column');
        }
        const bk = pickKey(d[0], BZRE);             // array of objects
        if (!bk) throw new Error('keys=' + Object.keys(d[0]).join('|'));
        for (let i = d.length - 1; i >= 0; i--) {
          const v = parseFloat(d[i][bk]); if (!isNaN(v)) return v;
        }
        throw new Error('no numeric ' + bk);
      }
      const bk = pickKey(d, BZRE);                  // single object
      if (!bk) throw new Error('keys=' + Object.keys(d).join('|'));
      const v = parseFloat(d[bk]);
      if (isNaN(v)) throw new Error(bk + ' not numeric');
      return v;
    } catch (e) { notes.push('bz: ' + e.message); }
  }
  return null;
}

/* ---------- handler ---------- */
export async function onRequestGet() {
  const notes = [];
  const [local, current, forecast, bz] = await Promise.all([
    localDisturbance(notes).catch(e => { notes.push('fmi: ' + e.message); return null; }),
    kpNow(notes),
    kpForecast(notes),
    solarBz(notes)
  ]);

  let peak = null;
  const t0 = Date.now();
  forecast.forEach(f => {
    const t = Date.parse(f.t);
    if (t <= t0 + 24 * 36e5 && (peak === null || f.kp > peak)) peak = f.kp;
  });

  // Health summary for uptime monitoring. `status` is a literal string so an
  // external monitor can keyword-match on "status":"ok" without parsing JSON.
  // fmi + kp are what drive the verdict; forecast and bz are enhancements.
  const health = {
    fmi: !!local,
    kp: current !== null,
    forecast: forecast.length > 0,
    bz: bz !== null
  };
  const status = (health.fmi && health.kp) ? 'ok'
               : (health.fmi || health.kp) ? 'degraded' : 'down';

  const out = { status, health, current, peak, forecast, bz, local, notes,
                build: BUILD, fetched: new Date().toISOString() };
  return new Response(JSON.stringify(out), { status: status === 'down' ? 502 : 200, headers: HEADERS });
}
