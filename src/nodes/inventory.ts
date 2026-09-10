import { TravelState } from "../state.js";
import { FlightOption } from "../types.js";

/**
 * Inventory Node: Simulates querying an external Global Distribution System (GDS) API.
 * By default returns a single $650 flight to trigger supervisor approval guardrail.
 */
export async function inventoryNode(state: TravelState): Promise<Partial<TravelState>> {
  if (state.error || state.parsedRequest?.isValid === false) {
    console.log(`\n[🔎 Inventory Node] Bypassing GDS API query: upstream validation error (${state.error || "invalid route"}).`);
    return { flightOptions: [] };
  }

  console.log(`\n[🔎 Inventory Node] Querying GDS API for ${state.parsedRequest.origin || "YVR"} -> ${state.parsedRequest.destination || "SFO"}...`);
  
  // Default mock inventory (Single option exceeding the $500 cap to test approval loop)
  const flightOptions: FlightOption[] = [
    {
      id: "FL-650-AC",
      cost: 650,
      airline: "Air Canada",
    },
  ];

  console.log("[🔎 Inventory Node] Received Flight Options:", flightOptions);
  return { flightOptions };
}
