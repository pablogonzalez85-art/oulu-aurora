# Oulu darkness & aurora — before promoting

Running list. Last updated 28/07/2026.

---

## Rollout plan

| Phase | When | What |
|---|---|---|
| **Now** | Aug 2026 | Custom domain. Quiet launch. Share directly with Roosa and Andreas. No promotion. |
| **Calibrate** | Aug–Sep 2026 | Use it on real nights from ~18 Aug. Log nT readings against what is actually visible. Tighten thresholds. Fix whatever irritates in use. |
| **Promote** | Oct 2026 onward | Once the numbers mean something. Season peaks around the equinoxes, so nothing is lost by waiting. |

---

## Blocking — settle before any promotion

### Ownership and positioning
- **Settled 28/07/2026:** Pablo owns it as a personal asset, built outside work time
  and duties. Any sharing with the organisation is his decision.
- **Settled:** BusinessOulu / Visit Oulu would recommend it as a third-party site, not
  embed it or adopt it as official digital infrastructure. No public-body accessibility
  obligation follows from a side recommendation.
- [ ] Keep the boundary clean: credit Visit Oulu as the source of the viewing-spot
      guidance (**done** — credit line added under the spots section).
- [ ] If Andreas's VNF white-label proposal advances, agree licensing terms in writing
      before any code is handed over.

### Content correctness
- [ ] **Native review of the Finnish** (~60 prose strings). Highest reputational risk.
- [ ] **Native review of German and French** (~60 strings each). Both written by Claude.
- [ ] Review the Spanish (Pablo, native).
- [ ] **Verify the four viewing spots** — locations come from Visit Oulu, but distances
      and the character of each view are inference. Check Nallikari, Hollihaka,
      Kuivasjärvi, Pyykösjärvi. Consider adding darker options further out.

### Infrastructure
- **Moved to Cloudflare Pages, 29/07/2026.** Netlify's credit model gave 300 credits a
  month at 15 per deploy — about 20 deploys, after which the site is *paused* until the
  next billing cycle. Unworkable for a page being recommended to visitors.
  Cloudflare free: 500 builds/month, unlimited bandwidth and static requests, and
  100,000 Workers requests/day for the functions.
- [ ] **Name the Cloudflare project `oulu-aurora`**, or edit the four share-card URLs
      in the `<head>` to match whatever it is called.
- [ ] **Custom domain** — a `.pages.dev` URL is fine to start but not to promote.
      Update the same four URLs when it changes.
- [ ] Watch the Workers quota. Every page load calls `/api/spacewx`, and an open tab
      re-runs every 5 minutes. 100k/day is generous but not infinite.
- [ ] Ask Andreas what the VNF platform runs on. Cloudflare Workers are JavaScript
      only — if that platform is PHP, the functions need porting again.

---

## Should do before wide promotion

### Uptime monitoring — set this up
The function returns a health summary. Use an external monitor; no code needed.

- [ ] Create a free monitor (UptimeRobot, Better Stack or similar) against
      `https://<domain>/api/spacewx`
- [ ] Interval: 15 minutes is plenty. The function caches for 5 minutes, so more
      frequent checks just serve the cache.
- [ ] **Keyword to watch for:** `"status":"ok"` — alert when *absent*.
      The function returns `ok` when both the FMI magnetometer and NOAA Kp are live,
      `degraded` when only one is, and `down` (HTTP 502) when neither is.
- [ ] Optional second monitor on the page itself for plain availability.
- [ ] Point alerts at an address actually read in winter.

### Deferred by decision
- **Webcams — not for now (28/07/2026).** Researched and parked. If revisited, link
  rather than embed: embedding uses someone else's bandwidth, risks terms-of-use
  problems, adds page weight and breaks silently.
  - Best candidate: **Sodankylä all-sky camera, run by the University of Oulu** —
    institutional and reliable, same university as the observatory behind the
    magnetometer data.
  - Others exist for Oulu itself and Kalajoki (~110 km down the coast), both
    apparently privately operated — verify before linking.
  - Worth stating alongside any link: Sodankylä is ~400 km north, so the auroral oval
    reaches it well before Oulu. Sodankylä dark means Oulu has nothing; Sodankylä
    glowing does **not** mean Oulu will. A one-way signal.
- **Real aurora photographs — not for now.** Always long exposures showing far more
  than the eye sees, which works against a page whose value is not overselling. If
  ever revisited, note that Visit Oulu's media bank would tie the personal project to
  employer assets.

### Other
- [ ] **Self-host the two typefaces** instead of loading from Google Fonts. Currently
      the only third-party call that sees a visitor's IP without needing to. Also
      faster. Download the woff2 files for Space Grotesk and IBM Plex Mono, drop them
      in the folder, replace the `<link>` with `@font-face` rules — then the privacy
      note can drop that clause.
- [x] Short disclaimer line — done, visible above the footer.
- [x] Privacy note — done, collapsible section, five languages.
- [ ] Accessibility pass on the SVG charts. Not a legal requirement given the site is
      only being recommended rather than adopted, but the twilight and season charts
      convey information no screen reader can currently reach.
- [ ] Analytics: agreed none for now. If ever needed, cookieless only (Cloudflare Web
      Analytics is free; Netlify Analytics is server-side). Avoid Google Analytics — it
      would force a consent banner onto a page whose point is being glanceable in the dark.

---

## Headline verdicts — agreed 28/07/2026, not yet implemented

Nine states, evaluated as a cascade, first match wins. No idioms in any of them, so
all five languages translate directly.

| # | Headline | Fires when |
|---|---|---|
| 1 | Not tonight | Sun never below −6°, **or** nautical twilight + under 100 nT |
| 2 | Probably not | Nautical twilight + 100 nT or more |
| 3 | Clouded out | Cloud over 80% |
| 4 | Quiet sky | Under 100 nT |
| 5 | Go outside now | 500 nT or more **and** cloud under 45% |
| 6 | Go outside | 250 nT or more **and** cloud under 45% |
| 7 | Moon in the way | Moon above horizon and over 70% lit |
| 8 | Cloud in the way | Cloud 45–80% |
| 9 | Worth a look | Everything else |

**Eyebrow is separate from the headline.** It reads "Aurora tonight" normally, and
switches to "Geomagnetic storm" (in pink) whenever the reading is 500 nT or more —
regardless of cloud, moon or daylight. The eyebrow says what the sun is doing; the
headline says whether you will see it. So "Geomagnetic storm" above "Cloud in the way"
is a valid and useful combination: it is happening, just not visible from here.

State 5 also renders larger (52px against 40px). Three restrained signals, no
animation — it may fire twice a winter or not at all.

Changes from the current five states:
- "Probably not" no longer judges darkness alone; a dead sky in nautical twilight is
  now "Not tonight"
- Strong activity overrides the moon check (previously 450 nT under a full moon
  wrongly read "Moon in the way")
- "Cloud in the way" splits the old catch-all, and pairs grammatically with
  "Moon in the way"
- Timing can appear in the subtext — "Best from 23:40" — when the window has not
  started yet

- [ ] **Implement the nine states**, including all five translations.
- [ ] **Review the wording again once it has run in darkness.** Several of these have
      never been seen in situ.
- [ ] **Track how often state 5 fires.** If 500 nT turns out to be commonplace at this
      latitude, the rare state becomes routine and the pink eyebrow stops meaning
      anything. Threshold and frequency both need checking, not just the threshold.

---

## Calibration — needs real darkness

Aurora season in Oulu resumes around **18 August 2026**. Nothing below can be tested
before then.

- [ ] Log the local nT reading on nights aurora are actually visible. Current
      thresholds (quiet <100, active >250, storm >500 nT) are anchored on a single
      quiet-day observation of ~60 nT on 28/07/2026.
- [ ] Test the paths that only fire in darkness: best-window band, "Go outside"
      verdict, camera settings during real activity.
- [ ] Sanity-check the three-night outlook against what actually happened.
- [ ] Compare local disturbance against global Kp over several weeks to see whether
      the local reading genuinely leads or tracks it.

---

## Nice to have

- [ ] Bortle / sky-brightness rating per viewing spot (the light-pollution answer
      without a map library).
- [ ] Aperture selector for the camera settings — currently assumes f/2.8, which is
      wrong for anyone on a kit lens.
- [ ] Parameterise location if the VNF white-label goes ahead: coordinates, FMI
      station list, spot list and thresholds are all currently hardcoded to Oulu.

---

## Done

- Five languages with a select control (en / fi / de / fr / es)
- Local magnetic disturbance from FMI magnetometers (Oulujärvi, Ranua)
- Planetary Kp, 3-day forecast and solar wind Bz from NOAA SWPC
- Cloud, rain, temperature and sun times from Open-Meteo
- Sun and moon computed locally — works with no network at all
- Interpretation scales for local nT, Kp and Bz in the explanation boxes
- Red night mode, favicon set, home-screen install, social share card
- Timezone pinned to Europe/Helsinki regardless of visitor location
- Per-source status panel with independent failure reporting
- Health summary and `status` keyword in the function, for uptime monitoring
- Disclaimer line, privacy note and Visit Oulu source credit
- Ported to Cloudflare Pages Functions; endpoint moved to `/api/spacewx`
- Endpoint locked to same-origin — no CORS header, so a clone hosted elsewhere
  cannot use this backend
- `_headers` file with nosniff, referrer policy and permissions policy
- README with deployment steps and an eight-point post-deploy test list
- Google Maps links and verified coordinates per viewing spot (which corrected two
  wrong directions: Nallikari is north-west, Hollihaka is in the centre)
- "Before you go" — six aurora-hunting tips, five languages
- Drawn moon phase in the moon gate, accurate to tonight's illumination
- "Where to look" sky diagram: aurora band placed by activity level, real moon
  position, treeline showing why a low horizon matters
