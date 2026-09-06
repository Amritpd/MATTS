import { TravelState } from "./state.js";

export type SupervisorRoute = "manager_approval" | "execution";

/**
 * supervisorRouter: Pure, deterministic guardrail evaluation function.
 * Evaluates state against hard compliance policies to route execution.
 * 
 * Routing Rules:
 * - If cheapest flight > maxBudget AND approvalStatus !== "APPROVED" -> "manager_approval"
 * - If cheapest flight <= maxBudget OR approvalStatus === "APPROVED" -> "execution"
 */
export function supervisorRouter(state: TravelState): SupervisorRoute {
  if (!state.flightOptions || state.flightOptions.length === 0) {
    throw new Error("[Guardrail Violation] No flight options available to evaluate.");
  }

  const cheapestCost = Math.min(...state.flightOptions.map((f) => f.cost));
  const isOverBudget = cheapestCost > state.maxBudget;
  const isApproved = state.approvalStatus === "APPROVED";

  console.log("\n[🚦 Supervisor Router] Evaluating deterministic guardrails:");
  console.log(`   - Cheapest Flight: $${cheapestCost}`);
  console.log(`   - Max Budget Cap:  $${state.maxBudget}`);
  console.log(`   - Approval Status: ${state.approvalStatus}`);

  if (isOverBudget && !isApproved) {
    console.log("   -> Policy breach detected without manager sign-off. Routing to [manager_approval].");
    return "manager_approval";
  }

  console.log("   -> Policy checks cleared. Routing directly to [execution].");
  return "execution";
}
