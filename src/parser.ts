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

  // Common English stop words that happen to be 3 letters
  const stopWords = new Set(["the", "and", "for", "out", "via", "way", "one", "get", "any", "all", "new", "day", "you", "not", "how", "who", "why", "now", "are"]);

  // If exact 3-letter word, assume IATA code
  const exactMatch = cleaned.match(/^([a-z]{3})$/i);
  if (exactMatch && !stopWords.has(exactMatch[1].toLowerCase())) {
    return exactMatch[1].toUpperCase();
  }

  // If contains a 3-letter code word surrounded by whitespace/boundaries
  const codeMatch = cleaned.match(/\b([a-z]{3})\b/i);
  if (codeMatch && !stopWords.has(codeMatch[1].toLowerCase())) {
    return codeMatch[1].toUpperCase();
  }

  return "";
}

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/**
 * Parses date string or expressions into YYYY-MM-DD format.
 */
export function parseDate(text: string, defaultDate = "2026-10-15"): string {
  if (!text) return defaultDate;

  // 1. ISO format: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const isoMatch = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    return `${isoMatch[1]}-${month}-${day}`;
  }

  // 2. US format: MM/DD/YYYY or MM-DD-YYYY
  const usDateMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (usDateMatch) {
    const month = usDateMatch[1].padStart(2, "0");
    const day = usDateMatch[2].padStart(2, "0");
    return `${usDateMatch[3]}-${month}-${day}`;
  }

  // 3. "15th of October 2026" or "15 Oct 2027" or "October 15th, 2026"
  const ofMonthMatch = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s*(\d{4}))?\b/i
  );

  if (ofMonthMatch) {
    const dayStr = ofMonthMatch[1];
    const monthName = ofMonthMatch[2].toLowerCase();
    const yearStr = ofMonthMatch[3] || "2026";
    const monthNum = MONTH_MAP[monthName] || "10";
    const dayNum = parseInt(dayStr, 10).toString().padStart(2, "0");
    return `${yearStr}-${monthNum}-${dayNum}`;
  }

  // 4. Month name first: "Oct 15", "October 15, 2026", "Nov 20th"
  const namedMonthMatch = text.match(
    /\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i
  );

  if (namedMonthMatch) {
    const monthName = namedMonthMatch[1].toLowerCase();
    const dayStr = namedMonthMatch[2];
    const yearStr = namedMonthMatch[3] || "2026";
    const monthNum = MONTH_MAP[monthName] || "10";
    const dayNum = parseInt(dayStr, 10).toString().padStart(2, "0");
    return `${yearStr}-${monthNum}-${dayNum}`;
  }

  // 5. Relative terms: in X days, in X weeks
  const inDaysMatch = text.match(/\bin\s+(\d{1,2})\s+days?\b/i);
  const now = new Date(2026, 9, 15); // Base reference date for deterministic simulation: 2026-10-15
  if (inDaysMatch) {
    const offset = parseInt(inDaysMatch[1], 10);
    const target = new Date(now);
    target.setDate(target.getDate() + offset);
    return target.toISOString().split("T")[0];
  }

  const inWeeksMatch = text.match(/\bin\s+(\d{1,2})\s+weeks?\b/i);
  if (inWeeksMatch) {
    const offset = parseInt(inWeeksMatch[1], 10) * 7;
    const target = new Date(now);
    target.setDate(target.getDate() + offset);
    return target.toISOString().split("T")[0];
  }

  // 6. Next [DayOfWeek] (e.g. "next Friday", "this Saturday")
  const dayOfWeekMatch = text.match(/\b(?:next|this)\s+(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i);
  if (dayOfWeekMatch) {
    const targetDay = DAY_OF_WEEK_MAP[dayOfWeekMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + diff);
      return target.toISOString().split("T")[0];
    }
  }

  // 7. Simple relative keywords: today, tomorrow, next week, next month
  if (/\btoday\b/i.test(text)) {
    return now.toISOString().split("T")[0];
  }
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
  if (/\bnext\s+month\b/i.test(text)) {
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.toISOString().split("T")[0];
  }

  return defaultDate;
}

export interface ParseResult {
  origin: string;
  destination: string;
  date: string;
  isValid: boolean;
  errorMessage?: string | null;
}

/**
 * Intelligent natural language parser extracting origin, destination, and departure date.
 * Validates whether meaningful airport/city tokens were extracted.
 */
export function parseNaturalLanguageInput(
  input: string,
  fallbackOrigin = "",
  fallbackDestination = "",
  fallbackDate = "2026-10-15"
): ParseResult {
  if (!input || !input.trim()) {
    return {
      origin: fallbackOrigin,
      destination: fallbackDestination,
      date: fallbackDate,
      isValid: false,
      errorMessage: "Empty or blank input request",
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
  const arrowMatch = text.match(/\b([A-Za-z\s()]{2,20}?)\s+(?:->|-->|=>|to|-)\s+([A-Za-z\s()]{2,20}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);

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

  // Validation checks:
  if (!origin || !destination || origin.length < 3 || destination.length < 3) {
    return {
      origin,
      destination,
      date,
      isValid: false,
      errorMessage: `Could not identify valid origin and destination airports in "${text}"`,
    };
  }

  if (origin === destination) {
    return {
      origin,
      destination,
      date,
      isValid: false,
      errorMessage: `Origin (${origin}) and destination (${destination}) cannot be identical`,
    };
  }

  return {
    origin,
    destination,
    date,
    isValid: true,
    errorMessage: null,
  };
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
  const result = parseNaturalLanguageInput(userInput);

  if (!result.isValid) {
    if (existingParsed?.origin && existingParsed?.destination) {
      const origin = existingParsed.origin;
      const destination = existingParsed.destination;
      const date = existingParsed.date || "2026-10-15";
      const intentId = generateIntentId(origin, destination, date);
      return {
        intentId,
        origin,
        destination,
        date,
        isValid: true,
        errorMessage: null,
      };
    }

    return {
      intentId: "INTENT-INVALID-REQUEST",
      origin: result.origin,
      destination: result.destination,
      date: result.date,
      isValid: false,
      errorMessage: result.errorMessage,
    };
  }

  const intentId = generateIntentId(result.origin, result.destination, result.date);

  return {
    intentId,
    origin: result.origin,
    destination: result.destination,
    date: result.date,
    isValid: true,
    errorMessage: null,
  };
}
