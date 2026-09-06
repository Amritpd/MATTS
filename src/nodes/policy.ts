import { TravelState } from "../state.js";

/**
 * Policy Node: Simulates a read-only database query for corporate compliance limits.
 */
export async function policyNode(_state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[🏛️ Policy Node] Fetching corporate travel policy constraints from DB...");
  const maxBudget = 500;
  console.log(`[🏛️ Policy Node] Active hard limit: $${maxBudget}`);
  return { maxBudget };
}
