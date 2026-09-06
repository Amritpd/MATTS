import { TravelState } from "../state.js";
import { ParsedRequest } from "../types.js";

/**
 * Triage Node: Simulates an LLM parsing natural language user input into structured search parameters.
 */
export async function triageNode(state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[📥 Triage Node] Parsing natural language input:", JSON.stringify(state.userInput));
  
  // Simulated LLM entity extraction with default fallback
  const parsedRequest: ParsedRequest = {
    origin: "YVR",
    destination: "SFO",
    date: "2026-10-15",
  };

  console.log("[📥 Triage Node] Extracted Parameters:", parsedRequest);
  return { parsedRequest };
}
