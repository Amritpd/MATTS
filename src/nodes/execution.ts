import crypto from "node:crypto";
import { TravelState } from "../state.js";

/**
 * Generates a collision-resistant idempotency key for transactions.
 */
export function generateIdempotencyKey(flightId: string, timestamp: number = Date.now()): string {
  const idempotencyRaw = `${flightId}-${timestamp}`;
  const hash = crypto.createHash("sha256").update(idempotencyRaw).digest("hex").slice(0, 16).toUpperCase();
  return `IDEMP-${hash}`;
}

/**
 * Execution Node: Simulates a resilient POST request with an idempotency key.
 */
export async function executionNode(state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[💳 Execution Node] Initializing financial transaction...");
  
  const selectedFlight = state.flightOptions[0];
  const flightId = selectedFlight?.id ?? "FL-UNKNOWN";
  const idempotencyKey = generateIdempotencyKey(flightId);
  
  console.log(`[💳 Execution Node] Generated Idempotency Key: ${idempotencyKey}`);
  console.log(`[💳 Execution Node] Charging corporate card: $${selectedFlight?.cost ?? 0} on ${selectedFlight?.airline ?? "N/A"}`);
  
  const finalBookingId = `BK-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${flightId}`;
  console.log(`[💳 Execution Node] Booking confirmed with reference: ${finalBookingId}`);

  return { finalBookingId };
}
