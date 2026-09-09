import { describe, it, expect, beforeEach } from "vitest";
import { triageNode } from "../../src/nodes/triage.js";
import { policyNode } from "../../src/nodes/policy.js";
import { inventoryNode } from "../../src/nodes/inventory.js";
import { managerApprovalNode } from "../../src/nodes/manager-approval.js";
import { executionNode, generateIdempotencyKey, clearLedgerCache } from "../../src/nodes/execution.js";
import { TravelState } from "../../src/state.js";

describe("Unit Tests: Isolated Node Handlers", () => {
  beforeEach(() => {
    clearLedgerCache();
  });

  const baseState: TravelState = {
    intentId: "INTENT-TEST-123",
    userInput: "Book a flight from YVR to SFO",
    parsedRequest: { intentId: "INTENT-TEST-123", origin: "", destination: "", date: "" },
    maxBudget: 0,
    flightOptions: [],
    approvalStatus: "PENDING",
    finalBookingId: null,
  };

  it("triageNode should parse natural language userInput into structured search parameters and assign deterministic intentId", async () => {
    const delta = await triageNode({
      ...baseState,
      intentId: "",
      userInput: "Please book flight from SEA to JFK on 2026-11-20",
    });

    expect(delta.intentId).toBeDefined();
    expect(delta.intentId).toMatch(/^INTENT-[A-F0-9]{12}$/);
    expect(delta.parsedRequest).toBeDefined();
    expect(delta.parsedRequest?.origin).toBe("SEA");
    expect(delta.parsedRequest?.destination).toBe("JFK");
    expect(delta.parsedRequest?.date).toBe("2026-11-20");
  });

  it("policyNode should return the corporate compliance maximum budget limit", async () => {
    const delta = await policyNode(baseState);
    expect(delta.maxBudget).toBe(500);
  });

  it("inventoryNode should query external flight inventory and return flight options", async () => {
    const delta = await inventoryNode(baseState);
    expect(delta.flightOptions).toBeDefined();
    expect(Array.isArray(delta.flightOptions)).toBe(true);
    expect(delta.flightOptions?.length).toBeGreaterThan(0);
    expect(delta.flightOptions?.[0]).toMatchObject({
      id: "FL-650-AC",
      cost: 650,
      airline: "Air Canada",
    });
  });

  it("managerApprovalNode should escalate and set approvalStatus to APPROVED", async () => {
    const overBudgetState: TravelState = {
      ...baseState,
      maxBudget: 500,
      flightOptions: [{ id: "FL-650-AC", cost: 650, airline: "Air Canada" }],
    };

    const delta = await managerApprovalNode(overBudgetState);
    expect(delta.approvalStatus).toBe("APPROVED");
  });

  it("executionNode should generate intent-scoped idempotency token, charge card, and return booking ID", async () => {
    const approvedState: TravelState = {
      ...baseState,
      maxBudget: 500,
      flightOptions: [{ id: "FL-650-AC", cost: 650, airline: "Air Canada" }],
      approvalStatus: "APPROVED",
    };

    const delta = await executionNode(approvedState);
    expect(delta.finalBookingId).toBeDefined();
    expect(typeof delta.finalBookingId).toBe("string");
    expect(delta.finalBookingId).toMatch(/^BK-[A-F0-9]{8}-FL-650-AC$/);
  });

  it("generateIdempotencyKey should generate deterministic SHA-256 hashed keys for the same intent and flight", () => {
    const key1 = generateIdempotencyKey("INTENT-ABC", "FL-100");
    const key2 = generateIdempotencyKey("INTENT-ABC", "FL-100");
    const key3 = generateIdempotencyKey("INTENT-XYZ", "FL-100");

    expect(key1).toBe(key2); // Exact same key across retries
    expect(key1).not.toBe(key3); // Different intent yields different key
    expect(key1).toMatch(/^IDEMP-[A-F0-9]{16}$/);
  });
});

