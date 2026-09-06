import { TravelState } from "../state.js";

/**
 * Manager Approval Node: Simulates a human-in-the-loop intercept loop.
 */
export async function managerApprovalNode(state: TravelState): Promise<Partial<TravelState>> {
  const cheapestFlight = state.flightOptions.length > 0 
    ? Math.min(...state.flightOptions.map((f) => f.cost))
    : 0;
    
  console.log("\n[✋ Manager Approval Node] Human-in-the-Loop Intercept Triggered!");
  console.log(`[✋ Manager Approval Node] Cheapest flight ($${cheapestFlight}) exceeds max corporate budget ($${state.maxBudget}).`);
  console.log("[✋ Manager Approval Node] Simulating VP Travel / Manager override approval...");
  
  return { approvalStatus: "APPROVED" };
}
