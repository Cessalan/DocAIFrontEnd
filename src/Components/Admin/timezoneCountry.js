/**
 * timezoneCountry — IANA timezone → country, for reading funnel rows.
 *
 * WHY THIS EXISTS
 *
 * `funnelEvents` rows carry the browser's timezone (see FunnelService), which
 * is the only country signal the product collects. A timezone is not a country,
 * but for this question it is close enough: nobody sets it by hand, and the
 * ambiguous cases (a shared zone spanning borders) are rare next to the thing
 * being measured — roughly "is this person in the US or not".
 *
 * WHAT IT WILL NOT DO
 *
 * Guess. An unmapped zone returns null and the caller shows the raw zone, so a
 * reader can see that Asia/Karachi was unrecognised rather than being told
 * "Unknown" as though the row were empty. The map covers the zones this app's
 * students actually appear in plus the usual international ones; adding a zone
 * is a one-line change, and a wrong guess would be a fact invented in a table.
 */

/** IANA zone → ISO 3166-1 alpha-2. Legacy aliases included: browsers still emit them. */
const ZONE_COUNTRY = {
  // ── United States ──
  'America/New_York': 'US', 'America/Detroit': 'US', 'America/Chicago': 'US',
  'America/Denver': 'US', 'America/Phoenix': 'US', 'America/Los_Angeles': 'US',
  'America/Anchorage': 'US', 'America/Juneau': 'US', 'America/Sitka': 'US',
  'America/Nome': 'US', 'America/Adak': 'US', 'America/Metlakatla': 'US',
  'America/Boise': 'US', 'America/Indiana/Indianapolis': 'US',
  'America/Indiana/Vincennes': 'US', 'America/Indiana/Knox': 'US',
  'America/Indiana/Winamac': 'US', 'America/Indiana/Marengo': 'US',
  'America/Indiana/Petersburg': 'US', 'America/Indiana/Tell_City': 'US',
  'America/Indiana/Vevay': 'US', 'America/Kentucky/Louisville': 'US',
  'America/Kentucky/Monticello': 'US', 'America/Menominee': 'US',
  'America/North_Dakota/Center': 'US', 'America/North_Dakota/New_Salem': 'US',
  'America/North_Dakota/Beulah': 'US', 'Pacific/Honolulu': 'US',
  'America/Puerto_Rico': 'PR', 'Pacific/Guam': 'GU',
  'US/Eastern': 'US', 'US/Central': 'US', 'US/Mountain': 'US',
  'US/Pacific': 'US', 'US/Hawaii': 'US', 'US/Alaska': 'US',

  // ── Canada ──
  'America/Toronto': 'CA', 'America/Montreal': 'CA', 'America/Vancouver': 'CA',
  'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/St_Johns': 'CA', 'America/Regina': 'CA', 'America/Moncton': 'CA',
  'America/Whitehorse': 'CA', 'America/Yellowknife': 'CA', 'America/Iqaluit': 'CA',
  'Canada/Eastern': 'CA', 'Canada/Pacific': 'CA', 'Canada/Mountain': 'CA',
  'Canada/Central': 'CA', 'Canada/Atlantic': 'CA',

  // ── Caribbean & Latin America ──
  'America/Jamaica': 'JM', 'America/Port_of_Spain': 'TT', 'America/St_Lucia': 'LC',
  'America/Barbados': 'BB', 'America/Santo_Domingo': 'DO', 'America/Nassau': 'BS',
  'America/Guyana': 'GY', 'America/Port-au-Prince': 'HT', 'America/Havana': 'CU',
  'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Monterrey': 'MX',
  'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL',

  // ── Africa ──
  'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA',
  'Africa/Addis_Ababa': 'ET', 'Africa/Kampala': 'UG', 'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN', 'Africa/Harare': 'ZW',

  // ── Europe ──
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Lisbon': 'PT',
  'Europe/Warsaw': 'PL', 'Europe/Bucharest': 'RO', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI',
  'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA',
  'Europe/Moscow': 'RU', 'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU',

  // ── Asia & Middle East ──
  'Asia/Manila': 'PH', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP',
  'Asia/Colombo': 'LK', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB', 'Asia/Jerusalem': 'IL', 'Asia/Baghdad': 'IQ',
  'Asia/Tehran': 'IR', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID', 'Asia/Bangkok': 'TH', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN', 'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW',

  // ── Oceania ──
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Darwin': 'AU',
  'Australia/Hobart': 'AU', 'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ',
};

/** @returns {string|null} ISO country code, or null when the zone isn't mapped. */
export const countryCodeForTimeZone = (tz) =>
  (tz && ZONE_COUNTRY[tz]) || null;

/**
 * "US" → "United States". Uses the browser's own region names so this file
 * carries no second table to fall out of date; the code itself is the fallback.
 */
export const countryName = (code) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

/**
 * What to show a reader for one row: the country when the zone is known, the
 * raw zone when it isn't, and null when the row predates the capture.
 */
export const placeLabel = (tz) => {
  if (!tz) return null;
  const code = countryCodeForTimeZone(tz);
  return code ? countryName(code) : tz;
};
