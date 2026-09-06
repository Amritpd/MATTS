import { describe, it, expect } from "vitest";
import { triageNode } from "../../src/nodes/triage.js";
import { policyNode } from "../../src/nodes/policy.js";
import { inventoryNode } from "../../src/nodes/inventory.js";
import { managerApprovalNode } from "../../src/nodes/manager-approval.js";
import { executionNode, generateIdempotencyKey } from "../../src/nodes/execution.js";
import { TravelState } from "../../src/state.js";

describe("Unit Tests: Isolated Node Handlers", () => {
  const baseState: TravelState = {
    userInput: "Book a flight from YVR to SFO",
    parsedRequest: { origin: "", destination: "", date: "" },
    maxBudget: 0,
    flightOptions: [],
    approvalStatus: "PENDING",
    finalBookingId: null,
  };

  it("triageNode should parse natural language userInput into structured search parameters", async () => {
    const delta = await triageNode(baseState);
    expect(delta.parsedRequest).toBeDefined();
    expect(delta.parsedRequest?.origin).toBe("YVR");
    expect(delta.parsedRequest?.destination).toBe("SFO");
    expect(delta.parsedRequest?.date).toBe("2026-10-15");
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

  it("executionNode should generate idempotency token, charge card, and return booking ID", async () => {
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

  it("generateIdempotencyKey should generate consistent SHA-256 hashed keys for same input", () => {
    const key1 = generateIdempotencyKey("FL-100", 1700000000000);
    const key2 = generateIdempotencyKey("FL-100", 1700000000000);
    const key3 = generateIdempotencyKey("FL-200", 1700000000000);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^IDEMP-[A-F0-9]{16}$/);
  });
});
