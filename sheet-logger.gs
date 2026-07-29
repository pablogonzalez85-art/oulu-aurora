/**
 * Google Apps Script for the Oulu aurora logger.
 * Receives one row per hour from netlify/functions/log.mjs and appends it.
 *
 * SETUP
 *  1. Create a new Google Sheet. Name it whatever you like.
 *  2. Extensions → Apps Script. Delete the placeholder, paste this file in.
 *  3. Change SECRET below to a long random string. Use the same one for the
 *     Netlify environment variable LOG_SECRET.
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as:        Me
 *       Who has access:    Anyone
 *     ("Anyone" is required for Netlify to reach it. The SECRET check is what
 *      actually protects it — nothing is written without a matching key.)
 *  5. Copy the /exec URL it gives you into the Netlify variable SHEET_URL.
 *
 * The sheet gets a header row automatically on the first write. Two extra
 * columns, "observed" and "comment", are yours — fill them in on nights you
 * actually saw something. That pairing is the whole point of the exercise.
 */

var SECRET = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';
var SHEET_NAME = 'log';

var COLUMNS = [
  'ts_utc', 'ts_local', 'sun_alt', 'sun_min_night', 'dark_tier',
  'moon_illum', 'moon_alt', 'moon_az',
  'cloud_pct', 'rain_mm', 'humidity_pct', 'wind_ms', 'temp_c',
  'fmi_oulujarvi_nt', 'fmi_ranua_nt',
  'kp_now', 'kp_peak_24h', 'bz_nt',
  'verdict', 'sw_status', 'notes',
  'observed', 'comment'
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.key !== SECRET) return reply({ error: 'unauthorised' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUMNS);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
    }

    var row = COLUMNS.map(function (c) {
      var v = body.row[c];
      return (v === undefined || v === null) ? '' : v;
    });
    sh.appendRow(row);

    return reply({ ok: true, rows: sh.getLastRow() - 1 });
  } catch (err) {
    return reply({ error: String(err) });
  }
}

function doGet() {
  return reply({ ok: true, hint: 'This endpoint accepts POST only.' });
}

function reply(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
