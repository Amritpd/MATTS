import { describe, it, expect, beforeEach } from "vitest";
import { supervisorRouter } from "../../src/router.js";
import { executionNode, generateIdempotencyKey, clearLedgerCache } from "../../src/nodes/execution.js";
import { TravelState, TravelStateAnnotation, maxBudgetReducer } from "../../src/state.js";

describe("Regression Tests: FinTech Guardrails & Boundary Conditions", () => {
  beforeEach(() => {
    clearLedgerCache();
  });

  const templateState: TravelState = {
    intentId: "INTENT-REG-100",
    userInput: "Book flight",
    parsedRequest: { intentId: "INTENT-REG-100", origin: "YVR", destination: "SFO", date: "2026-10-15" },
    maxBudget: 500,
    flightOptions: [],
    approvalStatus: "PENDING",
    finalBookingId: null,
  };

  describe("Boundary Price Limits", () => {
    it("REGRESSION: Exactly matching budget cap ($500.00 flight on $500.00 budget) must clear directly to execution", () => {
      const boundaryState: TravelState = {
        ...templateState,
        maxBudget: 500,
        flightOptions: [{ id: "FL-BOUND-1", cost: 500, airline: "Delta" }],
        approvalStatus: "PENDING",
      };

      const route = supervisorRouter(boundaryState);
      expect(route).toBe("execution");
    });

    it("REGRESSION: 1 cent over budget ($500.01 on $500.00 budget) must trigger manager approval", () => {
      const overCentState: TravelState = {
        ...templateState,
        maxBudget: 500,
        flightOptions: [{ id: "FL-OVER-1", cost: 500.01, airline: "Delta" }],
        approvalStatus: "PENDING",
      };

      const route = supervisorRouter(overCentState);
      expect(route).toBe("manager_approval");
    });

    it("REGRESSION: 1 cent under budget ($499.99 on $500.00 budget) must clear directly to execution", () => {
      const underCentState: TravelState = {
        ...templateState,
        maxBudget: 500,
        flightOptions: [{ id: "FL-UNDER-1", cost: 499.99, airline: "Delta" }],
        approvalStatus: "PENDING",
      };

      const route = supervisorRouter(underCentState);
      expect(route).toBe("execution");
    });
  });

  describe("Multi-Flight Selection Invariants", () => {
    it("REGRESSION: Disordered array where cheapest option is compliant must route to execution", () => {
      const multiFlightState: TravelState = {
        ...templateState,
        maxBudget: 500,
        flightOptions: [
          { id: "FL-EXPENSIVE-1", cost: 1200, airline: "Emirates" },
          { id: "FL-CHEAP-1", cost: 350, airline: "Flair" },
          { id: "FL-EXPENSIVE-2", cost: 800, airline: "WestJet" },
        ],
        approvalStatus: "PENDING",
      };

      const route = supervisorRouter(multiFlightState);
      expect(route).toBe("execution");
    });

    it("REGRESSION: Multiple options all exceeding budget must route to manager_approval", () => {
      const allExpensiveState: TravelState = {
        ...templateState,
        maxBudget: 500,
        flightOptions: [
          { id: "FL-1", cost: 550, airline: "Air Canada" },
          { id: "FL-2", cost: 600, airline: "United" },
          { id: "FL-3", cost: 750, airline: "Delta" },
        ],
        approvalStatus: "PENDING",
      };

      const route = supervisorRouter(allExpensiveState);
      expect(route).toBe("manager_approval");
    });
  });

  describe("Financial Idempotency & Deduplication Invariants", () => {
    it("REGRESSION: Retrying execution with the same intentId replays identical booking ID (Exact-Once / Zero Double Billing)", async () => {
      const executionState: TravelState = {
        ...templateState,
        intentId: "INTENT-STABLE-UUID-001",
        flightOptions: [{ id: "FL-500-DL", cost: 450, airline: "Delta" }],
        approvalStatus: "APPROVED",
      };

      // First run: Creates booking
      const firstRun = await executionNode(executionState);
      expect(firstRun.finalBookingId).toBeDefined();

      // Second run (simulating retry after transient network timeout)
      const secondRun = await executionNode(executionState);
      
      // Must replay EXACT same booking ID, not create a new one
      expect(secondRun.finalBookingId).toBe(firstRun.finalBookingId);
    });

    it("REGRESSION: Different intentIds produce distinct idempotency keys", () => {
      const key1 = generateIdempotencyKey("INTENT-USER-A", "FL-100");
      const key2 = generateIdempotencyKey("INTENT-USER-B", "FL-100");

      expect(key1).not.toBe(key2);
    });
  });

  describe("Policy Immutability Reducer Invariants", () => {
    it("REGRESSION: maxBudget reducer rejects downstream overwrite attempts once established", () => {
      const originalBudget = 500;
      // Downstream node attempts to inject higher budget $10,000
      const corruptedAttempt = maxBudgetReducer(originalBudget, 10000);

      expect(corruptedAttempt).toBe(500); // Must remain $500!
    });

    it("REGRESSION: maxBudget reducer accepts initial budget assignment when prev is 0", () => {
      const initialAssignment = maxBudgetReducer(0, 500);
      expect(initialAssignment).toBe(500);
    });
  });

  describe("Input Validation & Financial Abort Invariants", () => {
    it("REGRESSION: Execution node refuses to charge virtual card when state has error or rejected input", async () => {
      const errorState: TravelState = {
        ...templateState,
        error: "TRIAGE_VALIDATION_ERROR: Could not identify valid origin and destination",
        approvalStatus: "REJECTED_INVALID_INPUT",
        flightOptions: [],
      };

      const delta = await executionNode(errorState);
      expect(delta.finalBookingId).toBeNull();
    });

    it("REGRESSION: Supervisor router routes error state safely to execution to abort rather than crashing", () => {
      const errorState: TravelState = {
        ...templateState,
        error: "TRIAGE_VALIDATION_ERROR: Invalid route",
        approvalStatus: "REJECTED_INVALID_INPUT",
        flightOptions: [],
      };

      const route = supervisorRouter(errorState);
      expect(route).toBe("execution");
    });
  });
});


