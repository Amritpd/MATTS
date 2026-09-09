import crypto from "node:crypto";
import { TravelState } from "../state.js";
import { ParsedRequest } from "../types.js";

/**
 * Triage Node: Simulates an LLM parsing natural language user input into structured search parameters
 * and binds an immutable, deterministic intentId for the commercial lifecycle.
 */
export async function triageNode(state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[📥 Triage Node] Parsing natural language input:", JSON.stringify(state.userInput));
  
  const input = state.userInput || "";
  
  // Extract airport pairs if present (e.g., "from SEA to JFK" or "SEA to SFO" or "YVR -> SFO")
  const routeMatch = input.match(/\bfrom\s+([A-Z]{3})\s+to\s+([A-Z]{3})\b/i) || 
                     input.match(/\b([A-Z]{3})\s*(?:to|->)\s*([A-Z]{3})\b/i);
  const dateMatch = input.match(/\b(\d{4}-\d{2}-\d{2})\b/);

  const origin = routeMatch ? routeMatch[1].toUpperCase() : (state.parsedRequest.origin || "YVR");
  const destination = routeMatch ? routeMatch[2].toUpperCase() : (state.parsedRequest.destination || "SFO");
  const date = dateMatch ? dateMatch[1] : (state.parsedRequest.date || "2026-10-15");


  // Deterministic intentId derived from the commercial parameters (not ephemeral wall-clock)
  const intentRaw = `intent:${origin}:${destination}:${date}`;
  const intentHash = crypto.createHash("sha256").update(intentRaw).digest("hex").slice(0, 12).toUpperCase();
  const intentId = state.intentId || `INTENT-${intentHash}`;

  const parsedRequest: ParsedRequest = {
    intentId,
    origin,
    destination,
    date,
  };

  console.log(`[📥 Triage Node] Bound Commercial Intent: ${intentId}`);
  console.log("[📥 Triage Node] Extracted Parameters:", parsedRequest);
  return { intentId, parsedRequest };
}

