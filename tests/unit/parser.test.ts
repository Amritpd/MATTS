import { describe, it, expect } from "vitest";
import { parseNaturalLanguageInput, normalizeLocation, parseDate, parseTriageRequest } from "../../src/parser.js";

describe("Unit Tests: Smart Natural Language Request Parser", () => {
  it("parses classic airport code routes (e.g. 'book a flight from SFO to YVR')", () => {
    const res = parseNaturalLanguageInput("book a flight from SFO to YVR");
    expect(res.origin).toBe("SFO");
    expect(res.destination).toBe("YVR");
  });

  it("parses arrow notations (e.g. 'SEA -> JFK on 2026-11-20')", () => {
    const res = parseNaturalLanguageInput("SEA -> JFK on 2026-11-20");
    expect(res.origin).toBe("SEA");
    expect(res.destination).toBe("JFK");
    expect(res.date).toBe("2026-11-20");
  });

  it("parses city names to standard IATA codes (e.g. 'from San Francisco to New York on October 25')", () => {
    const res = parseNaturalLanguageInput("from San Francisco to New York on October 25");
    expect(res.origin).toBe("SFO");
    expect(res.destination).toBe("JFK");
    expect(res.date).toBe("2026-10-25");
  });

  it("parses reverse syntax (e.g. 'fly to London from Tokyo on Nov 15')", () => {
    const res = parseNaturalLanguageInput("fly to London from Tokyo on Nov 15");
    expect(res.origin).toBe("HND");
    expect(res.destination).toBe("LHR");
    expect(res.date).toBe("2026-11-15");
  });

  it("parses natural language with 'tomorrow'", () => {
    const res = parseNaturalLanguageInput("Book flight from Seattle to Paris tomorrow");
    expect(res.origin).toBe("SEA");
    expect(res.destination).toBe("CDG");
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses 'Book cheap flight YVR to SFO'", () => {
    const res = parseNaturalLanguageInput("Book cheap flight YVR to SFO");
    expect(res.origin).toBe("YVR");
    expect(res.destination).toBe("SFO");
  });

  it("parses user's exact screenshot prompt 'book a flight from SFO to YVR'", () => {
    const res = parseNaturalLanguageInput("book a flight from SFO to YVR");
    expect(res.origin).toBe("SFO");
    expect(res.destination).toBe("YVR");
  });

  it("parses 'I need a one way flight leaving LAX heading to JFK next week'", () => {
    const res = parseNaturalLanguageInput("I need a one way flight leaving LAX heading to JFK next week");
    expect(res.origin).toBe("LAX");
    expect(res.destination).toBe("JFK");
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("detects and flags junk input (e.g. 'asdfghjkl' or 'banana potato helicopter')", () => {
    const res1 = parseNaturalLanguageInput("asdfghjkl");
    expect(res1.isValid).toBe(false);
    expect(res1.errorMessage).toBeDefined();

    const res2 = parseNaturalLanguageInput("banana potato helicopter");
    expect(res2.isValid).toBe(false);
    expect(res2.errorMessage).toBeDefined();
  });

  it("detects and flags identical origin and destination (e.g. 'fly from SFO to SFO')", () => {
    const res = parseNaturalLanguageInput("fly from SFO to SFO");
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain("identical");
  });

  it("parseTriageRequest returns INTENT-INVALID-REQUEST and isValid: false for junk", () => {
    const parsed = parseTriageRequest("random gibberish with no route");
    expect(parsed.isValid).toBe(false);
    expect(parsed.intentId).toBe("INTENT-INVALID-REQUEST");
    expect(parsed.errorMessage).toBeDefined();
  });

  it("generates deterministic intentId bound to extracted route", () => {
    const parsed1 = parseTriageRequest("flight from SFO to YVR on 2026-10-15");
    const parsed2 = parseTriageRequest("flight from SFO to YVR on 2026-10-15");
    const parsedDiff = parseTriageRequest("flight from JFK to LHR on 2026-10-15");

    expect(parsed1.intentId).toBe(parsed2.intentId);
    expect(parsed1.intentId).not.toBe(parsedDiff.intentId);
    expect(parsed1.origin).toBe("SFO");
    expect(parsed1.destination).toBe("YVR");
  });
});
