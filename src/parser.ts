import crypto from "node:crypto";
import { ParsedRequest } from "./types.js";

// Canonical mapping of major cities and metros to primary IATA airport codes
const CITY_TO_IATA: Record<string, string> = {
  "san francisco": "SFO",
  "sf": "SFO",
  "bay area": "SFO",
  "sfo": "SFO",
  "vancouver": "YVR",
  "yvr": "YVR",
  "new york": "JFK",
  "new york city": "JFK",
  "nyc": "JFK",
  "jfk": "JFK",
  "laguardia": "LGA",
  "lga": "LGA",
  "newark": "EWR",
  "ewr": "EWR",
  "seattle": "SEA",
  "sea": "SEA",
  "los angeles": "LAX",
  "la": "LAX",
  "lax": "LAX",
  "chicago": "ORD",
  "ord": "ORD",
  "midway": "MDW",
  "toronto": "YYZ",
  "yyz": "YYZ",
  "london": "LHR",
  "heathrow": "LHR",
  "lhr": "LHR",
  "gatwick": "LGW",
  "tokyo": "HND",
  "haneda": "HND",
  "hnd": "HND",
  "narita": "NRT",
  "nrt": "NRT",
  "paris": "CDG",
  "cdg": "CDG",
  "orly": "ORY",
  "miami": "MIA",
  "mia": "MIA",
  "dallas": "DFW",
  "dfw": "DFW",
  "atlanta": "ATL",
  "atl": "ATL",
  "boston": "BOS",
  "bos": "BOS",
  "denver": "DEN",
  "den": "DEN",
  "austin": "AUS",
  "aus": "AUS",
  "las vegas": "LAS",
  "vegas": "LAS",
  "las": "LAS",
  "honolulu": "HNL",
  "hawaii": "HNL",
  "hnl": "HNL",
  "montreal": "YUL",
  "yul": "YUL",
  "calgary": "YYC",
  "yyc": "YYC",
  "frankfurt": "FRA",
  "fra": "FRA",
  "amsterdam": "AMS",
  "ams": "AMS",
  "dubai": "DXB",
  "dxb": "DXB",
  "singapore": "SIN",
  "sin": "SIN",
  "sydney": "SYD",
  "syd": "SYD",
  "washington": "IAD",
  "dc": "IAD",
  "iad": "IAD",
  "houston": "IAH",
  "iah": "IAH",
  "phoenix": "PHX",
  "phx": "PHX",
  "san diego": "SAN",
  "san": "SAN",
  "orlando": "MCO",
  "mco": "MCO",
  "portland": "PDX",
  "pdx": "PDX",
  "berlin": "BER",
  "ber": "BER",
  "rome": "FCO",
  "fco": "FCO",
  "madrid": "MAD",
  "mad": "MAD",
  "hong kong": "HKG",
  "hkg": "HKG",
  "seoul": "ICN",
  "icn": "ICN",
  "cancun": "CUN",
  "cun": "CUN",
};

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

/**
 * Normalizes location string (airport code or city name) into a standardized 3-letter IATA code.
 */
export function normalizeLocation(locStr: string): string {
  if (!locStr) return "";
  let cleaned = locStr.trim().toLowerCase().replace(/[(),]/g, " ");
  // Strip individual noise words
  cleaned = cleaned.replace(/\b(tomorrow|today|tonight|next\s+\w+|on|for|cheap|cheapest|flights?|tickets?|please|date|dep|arr|book|booking|fly|find|leaving|heading|arriving)\b/gi, " ").trim();
  cleaned = cleaned.replace(/\s+/g, " ");

  if (CITY_TO_IATA[cleaned]) {
    return CITY_TO_IATA[cleaned];
  }

  // Check if any multi-word city or single-word city is contained within cleaned
  for (const [cityName, code] of Object.entries(CITY_TO_IATA)) {
    const regex = new RegExp(`\\b${cityName}\\b`, "i");
    if (regex.test(cleaned)) {
      return code;
    }
  }

  // If 3 letters, assume IATA code
  const codeMatch = cleaned.match(/\b([a-z]{3})\b/i);
  if (codeMatch) {
    return codeMatch[1].toUpperCase();
  }

  return cleaned.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3);
}

/**
 * Parses date string or expressions into YYYY-MM-DD format.
 */
export function parseDate(text: string, defaultDate = "2026-10-15"): string {
  if (!text) return defaultDate;

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // 2. US format: MM/DD/YYYY
  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (usDateMatch) {
    const month = usDateMatch[1].padStart(2, "0");
    const day = usDateMatch[2].padStart(2, "0");
    return `${usDateMatch[3]}-${month}-${day}`;
  }

  // 3. Named month: e.g. "Oct 15", "October 15, 2026", "15 Oct 2026", "Nov 20"
  const namedMonthMatch = text.match(
    /\b(?:on\s+)?(\d{1,2})?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})?(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i
  );

  if (namedMonthMatch) {
    const dayStr = namedMonthMatch[1] || namedMonthMatch[3] || "15";
    const monthName = namedMonthMatch[2].toLowerCase();
    const yearStr = namedMonthMatch[4] || "2026";
    const monthNum = MONTH_MAP[monthName] || "10";
    const dayNum = parseInt(dayStr, 10).toString().padStart(2, "0");
    return `${yearStr}-${monthNum}-${dayNum}`;
  }

  // 4. Relative terms: tomorrow, next week, next month
  const now = new Date(2026, 9, 15); // Base reference date
  if (/\btomorrow\b/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }
  if (/\bnext\s+week\b/i.test(text)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  }

  return defaultDate;
}

/**
 * Intelligent natural language parser extracting origin, destination, and departure date.
 */
export function parseNaturalLanguageInput(
  input: string,
  fallbackOrigin = "YVR",
  fallbackDestination = "SFO",
  fallbackDate = "2026-10-15"
): { origin: string; destination: string; date: string } {
  if (!input || !input.trim()) {
    return {
      origin: fallbackOrigin,
      destination: fallbackDestination,
      date: fallbackDate,
    };
  }

  const text = input.trim();
  let rawOrigin = "";
  let rawDestination = "";

  // Pattern A: "from [Origin] to [Destination]"
  const fromToMatch = text.match(/\bfrom\s+([A-Za-z\s()]{2,25}?)\s+to\s+([A-Za-z\s()]{2,25}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);
  
  // Pattern B: "to [Destination] from [Origin]" (e.g. "fly to Paris from San Francisco")
  const toFromMatch = text.match(/\b(?:to|heading to|flying to)\s+([A-Za-z\s()]{2,25}?)\s+from\s+([A-Za-z\s()]{2,25}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);

  // Pattern C: "[Origin] to [Destination]" or "[Origin] -> [Destination]" or "[Origin] - [Destination]"
  const arrowMatch = text.match(/\b([A-Za-z\s()]{2,20}?)\s*(?:->|-->|=>|to|-)\s*([A-Za-z\s()]{2,20}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);

  if (fromToMatch) {
    rawOrigin = fromToMatch[1];
    rawDestination = fromToMatch[2];
  } else if (toFromMatch) {
    rawDestination = toFromMatch[1];
    rawOrigin = toFromMatch[2];
  } else if (arrowMatch) {
    rawOrigin = arrowMatch[1];
    rawDestination = arrowMatch[2];
  } else {
    // Fallback search for isolated "from X" and "to Y"
    const fromMatch = text.match(/\bfrom\s+([A-Za-z]{3,20})\b/i);
    const toMatch = text.match(/\bto\s+([A-Za-z]{3,20})\b/i);
    if (fromMatch) rawOrigin = fromMatch[1];
    if (toMatch) rawDestination = toMatch[1];
  }

  const origin = rawOrigin ? normalizeLocation(rawOrigin) : fallbackOrigin;
  const destination = rawDestination ? normalizeLocation(rawDestination) : fallbackDestination;
  const date = parseDate(text, fallbackDate);

  return { origin, destination, date };
}

/**
 * Computes deterministic commercial intent ID from parameters.
 */
export function generateIntentId(origin: string, destination: string, date: string): string {
  const intentRaw = `intent:${origin}:${destination}:${date}`;
  const intentHash = crypto.createHash("sha256").update(intentRaw).digest("hex").slice(0, 12).toUpperCase();
  return `INTENT-${intentHash}`;
}

export function parseTriageRequest(
  userInput: string,
  existingParsed?: Partial<ParsedRequest>
): ParsedRequest {
  const extracted = parseNaturalLanguageInput(
    userInput,
    existingParsed?.origin || "YVR",
    existingParsed?.destination || "SFO",
    existingParsed?.date || "2026-10-15"
  );

  const intentId = generateIntentId(extracted.origin, extracted.destination, extracted.date);

  return {
    intentId,
    origin: extracted.origin,
    destination: extracted.destination,
    date: extracted.date,
  };
}
