import { TravelState } from "../state.js";
import { parseTriageRequest } from "../parser.js";

/**
 * Triage Node: Simulates an LLM parsing natural language user input into structured search parameters
 * and binds an immutable, deterministic intentId for the commercial lifecycle.
 */
export async function triageNode(state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[📥 Triage Node] Parsing natural language input:", JSON.stringify(state.userInput));
  
  const parsedRequest = parseTriageRequest(state.userInput, state.parsedRequest);
  
  if (!parsedRequest.isValid) {
    console.error(`[📥 Triage Node] ❌ Semantic Parsing Error: ${parsedRequest.errorMessage}`);
    return {
      intentId: "INTENT-INVALID",
      parsedRequest,
      error: `TRIAGE_VALIDATION_ERROR: ${parsedRequest.errorMessage}`,
      approvalStatus: "REJECTED_INVALID_INPUT",
    };
  }

  const intentId = state.intentId || parsedRequest.intentId || "INTENT-UNKNOWN";
  parsedRequest.intentId = intentId;

  console.log(`[📥 Triage Node] Bound Commercial Intent: ${intentId}`);
  console.log("[📥 Triage Node] Extracted Parameters:", parsedRequest);
  return { intentId, parsedRequest, error: null };
}


