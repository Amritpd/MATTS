import crypto from "node:crypto";
import { TravelState } from "../state.js";

/**
 * In-memory ledger simulation storing executed transactions by idempotency key.
 * Guarantees that payment retries with the same intentId replay the exact same booking reference
 * without double-charging or creating duplicate ledger entries.
 */
const executedTransactionsLedger = new Map<string, { bookingId: string; chargedAmount: number; timestamp: number }>();

/**
 * Resets the in-memory ledger cache (primarily for unit test isolation).
 */
export function clearLedgerCache(): void {
  executedTransactionsLedger.clear();
}

/**
 * Generates an intent-scoped idempotency key for transactions.
 * Crucial FinTech Invariant: Retries must send the exact same key derived from the commercial intent,
 * never from an ephemeral clock tick.
 */
export function generateIdempotencyKey(intentId: string, flightId: string): string {
  const idempotencyRaw = `txn:${intentId}:${flightId}`;
  const hash = crypto.createHash("sha256").update(idempotencyRaw).digest("hex").slice(0, 16).toUpperCase();
  return `IDEMP-${hash}`;
}

/**
 * Execution Node: Simulates a resilient payments write path guarded by intent-scoped idempotency.
 */
export async function executionNode(state: TravelState): Promise<Partial<TravelState>> {
  console.log("\n[💳 Execution Node] Initializing financial transaction...");
  
  if (state.error || state.approvalStatus === "REJECTED_INVALID_INPUT" || !state.flightOptions || state.flightOptions.length === 0) {
    console.log(`[💳 Execution Node] 🚫 Execution Aborted: Zero card authorization permitted due to state error (${state.error || "No valid inventory"}).`);
    return { finalBookingId: null };
  }

  const selectedFlight = state.flightOptions[0];
  const flightId = selectedFlight?.id ?? "FL-UNKNOWN";
  const intentId = state.intentId || state.parsedRequest?.intentId || "INTENT-DEFAULT";
  
  const idempotencyKey = generateIdempotencyKey(intentId, flightId);
  console.log(`[💳 Execution Node] Intent ID: ${intentId} -> Idempotency Key: ${idempotencyKey}`);

  // Replay check: Deduplicate if this intent was already processed
  if (executedTransactionsLedger.has(idempotencyKey)) {
    const existingTxn = executedTransactionsLedger.get(idempotencyKey)!;
    console.log(`[💳 Execution Node] 🔁 IDEMPOTENCY HIT: Transaction already captured. Replaying existing booking reference: ${existingTxn.bookingId}`);
    return { finalBookingId: existingTxn.bookingId };
  }

  const cost = selectedFlight?.cost ?? 0;
  console.log(`[💳 Execution Node] ⚡ EXECUTING CHARGE: Authorizing corporate virtual card for $${cost} on ${selectedFlight?.airline ?? "N/A"}`);
  
  const finalBookingId = `BK-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${flightId}`;
  
  // Record to ledger
  executedTransactionsLedger.set(idempotencyKey, {
    bookingId: finalBookingId,
    chargedAmount: cost,
    timestamp: Date.now(),
  });

  console.log(`[💳 Execution Node] Booking confirmed with reference: ${finalBookingId}`);
  return { finalBookingId };
}

