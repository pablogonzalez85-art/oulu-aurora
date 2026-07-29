# Oulu — darkness & aurora

Answers one question: can you see the northern lights in Oulu tonight?

Live darkness, cloud, rain, moon and space weather, in five languages, with a local
magnetic disturbance reading from the Finnish Meteorological Institute's nearest
magnetometers rather than a global average.

---

## What's here

```
index.html              the whole site — CSS and JS inline, no build step
functions/api/
  spacewx.js            fetches FMI + NOAA server-side (they don't allow CORS)
  log.js                hourly logger, writes one row to a Google Sheet
_headers                security headers and cache policy
sheet-logger.gs         paste this into the Sheet's Apps Script editor
favicon.*, icon-*, og.png, site.webmanifest
TODO.md                 outstanding work and decisions taken
```

Runs on **Cloudflare Pages**. Functions are Workers, so JavaScript only — no PHP or
Python, no filesystem, no state between requests, 10ms CPU per request on the free
plan.

---

## Deploying

Deploys come from GitHub. Cloudflare watches the repository and rebuilds on every
change — **the dashboard's drag-and-drop upload does not work for this project**,
because it doesn't compile the `functions/` folder. Git connection does.

### One-time setup, about 15 minutes

**Part 1 — put the files on GitHub**

1. **github.com** → sign in or sign up
2. Top right **+** → **New repository**
3. Name it **`oulu-aurora`** — this becomes the `.pages.dev` subdomain, and the four
   share-card URLs in `index.html` already assume it. Private is fine.
4. Leave everything else alone → **Create repository**
5. On the empty repo page, click **uploading an existing file**
6. **Drag in every file, and the `functions` folder with them.** The web uploader keeps
   folder structure, so `functions/api/spacewx.js` stays where it belongs.
7. **Commit changes**

**Part 2 — connect Cloudflare**

8. **dash.cloudflare.com** → **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**
9. Authorise GitHub, then pick the `oulu-aurora` repository
10. Build settings — all three matter:
    - **Framework preset:** None
    - **Build command:** leave empty
    - **Build output directory:** leave empty
11. **Save and Deploy**

A minute or two later you get `https://oulu-aurora.pages.dev`.

> If that subdomain is taken you'll be given a suffixed one. In that case update the
> four absolute URLs in the `<head>` of `index.html` — `canonical`, `og:url`,
> `og:image` and `twitter:image` — or the share card will point at the wrong site.

### Changing something afterwards

On GitHub, click the file → **pencil icon** → edit → **Commit changes**. Cloudflare
rebuilds automatically in under a minute. For several files at once, use **Add file →
Upload files** and drop the replacements in.

**500 builds a month** on the free plan, so deploy as often as you like. Every
deployment is kept, and **Deployments → ⋯ → Rollback** returns to any earlier one.

### On custom domains

Cloudflare Pages needs a **CNAME** for a custom domain. DuckDNS only supports A
records, so `aurorasoulu.duckdns.org` **cannot** point at Pages. Use the `.pages.dev`
address, or register a real domain — which would also let you put Cloudflare's proxy
in front and improve latency.

### Optional: command line

```
npm i -g wrangler
wrangler pages deploy .              # deploy without GitHub
wrangler pages dev .                 # run locally, functions included, port 8788
```

`wrangler pages dev` is the only way to test the functions locally — a plain static
server can't run them. Not needed if you're happy deploying through GitHub.

---

## Environment variables

Dashboard → your project → Settings → **Variables and Secrets**. Add to **Production**
(and Preview, if you want the logger working there too):

| Name | Value |
|---|---|
| `LOG_SECRET` | a long random string |
| `SHEET_URL` | the `/exec` URL of the deployed Apps Script |

Neither is needed for the site itself — only for the logger. **Without `LOG_SECRET`
the logger refuses every request**, so deploying before you set them is safe.

---

## Testing after a deploy

Work down this list; each step assumes the previous one passed.

**1. The page loads and the sky is drawn**
Sun position, twilight chart, moon phase, year strip and sky diagram are all computed
in the browser. If these are wrong, nothing else matters.

**2. Open the Status section at the bottom.** You want five green ticks:

```
Sun and moon              computed locally, no network needed
Weather · Open-Meteo      cloud, rain, temperature, sun times
Magnetometer · FMI        Oulujärvi __ nT · Ranua __ nT · 90 min · CC BY 4.0
Planetary Kp · NOAA SWPC  now __ · peak __/24h · __ pts
Solar wind · NOAA SWPC    Bz __ nT
```

A red line names the failing source and why.

**3. Hit the API directly** — `https://<domain>/api/spacewx`

Expect `"status":"ok"`, a `local` block with both stations, a `forecast` array, a `bz`
number, and `"notes":[]`. Anything in `notes` is a partial failure worth reading.

**4. Check the languages.** Switch through all five. Look for untranslated strings and
for text overflowing its box — German and Finnish run longest.

**5. Check night mode.** The ◑ button. Everything should go deep red, including the
charts and icons. The phone status bar should follow.

**6. Check it on a phone.** The charts switch to a narrower layout below 620px. This is
the main way it will be used, outdoors, one-handed.

**7. Logger, once configured** — `https://<domain>/api/log?key=<LOG_SECRET>`
Expect JSON with a `row` object and `"sheet":"ok"`, and a new row in the Sheet.
Without the key: `{"error":"unauthorised"}`.

**8. Share card.** Paste the URL into any Open Graph debugger, or into a WhatsApp
message to yourself.

### Only testable in darkness

Aurora season in Oulu resumes around **18 August**. Until then these paths never run:

- the best-window band on the twilight chart
- the "Go outside", "Go outside now" and "Cloud in the way" headlines
- the storm eyebrow
- camera settings under real activity
- the aurora band on the sky diagram at anything above its lowest position

---

## Data sources

| What | Where | Notes |
|---|---|---|
| Sun and moon | computed locally | no network needed |
| Cloud, rain, temperature, sun times | Open-Meteo | browser-side, allows CORS |
| Local magnetic disturbance | Ilmatieteen laitos open data | CC BY 4.0, credited on the page |
| Kp and solar wind | NOAA SWPC | server-side only; NOAA sends no CORS headers |

`/api/spacewx` deliberately sends **no** `access-control-allow-origin` header. The page
is same-origin so it needs none, and its absence stops a copy of this site hosted
elsewhere using this endpoint as its backend.

---

## Known caveats

- **Local nT thresholds are provisional.** Anchored on one quiet-day reading of about
  60 nT on 28/07/2026. See TODO.md.
- **Finnish, German and French were machine-written** and need native review before
  the site is promoted.
- **Typefaces load from Google Fonts**, which sees visitors' IP addresses. Self-hosting
  them is on the list.
