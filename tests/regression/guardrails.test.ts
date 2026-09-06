import { describe, it, expect } from "vitest";
import { supervisorRouter } from "../../src/router.js";
import { generateIdempotencyKey } from "../../src/nodes/execution.js";
import { TravelState } from "../../src/state.js";

describe("Regression Tests: FinTech Guardrails & Boundary Conditions", () => {
  const templateState: TravelState = {
    userInput: "Book flight",
    parsedRequest: { origin: "YVR", destination: "SFO", date: "2026-10-15" },
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

  describe("Financial Idempotency Invariants", () => {
    it("REGRESSION: High-frequency sequential charges generate distinct idempotency keys per millisecond tick", () => {
      const keys = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        // simulate distinct timestamps
        const key = generateIdempotencyKey("FL-IDEMP-TEST", 1700000000000 + i);
        keys.add(key);
      }

      expect(keys.size).toBe(iterations);
    });
  });
});
