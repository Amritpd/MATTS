import { describe, it, expect } from "vitest";
import { supervisorRouter } from "../../src/router.js";
import { TravelState } from "../../src/state.js";

describe("Unit Tests: Supervisor Deterministic Guardrail Router", () => {
  const baseState: TravelState = {
    userInput: "Book flight",
    parsedRequest: { origin: "YVR", destination: "SFO", date: "2026-10-15" },
    maxBudget: 500,
    flightOptions: [],
    approvalStatus: "PENDING",
    finalBookingId: null,
  };

  it("should route to 'manager_approval' when cheapest flight > maxBudget and approvalStatus is PENDING", () => {
    const state: TravelState = {
      ...baseState,
      maxBudget: 500,
      flightOptions: [
        { id: "FL-1", cost: 650, airline: "Air Canada" },
        { id: "FL-2", cost: 720, airline: "United" },
      ],
      approvalStatus: "PENDING",
    };

    const route = supervisorRouter(state);
    expect(route).toBe("manager_approval");
  });

  it("should route to 'execution' when cheapest flight <= maxBudget even if approvalStatus is PENDING", () => {
    const state: TravelState = {
      ...baseState,
      maxBudget: 500,
      flightOptions: [
        { id: "FL-1", cost: 480, airline: "Air Canada" },
        { id: "FL-2", cost: 650, airline: "United" },
      ],
      approvalStatus: "PENDING",
    };

    const route = supervisorRouter(state);
    expect(route).toBe("execution");
  });

  it("should route to 'execution' when flight is over budget but approvalStatus is APPROVED", () => {
    const state: TravelState = {
      ...baseState,
      maxBudget: 500,
      flightOptions: [{ id: "FL-1", cost: 650, airline: "Air Canada" }],
      approvalStatus: "APPROVED",
    };

    const route = supervisorRouter(state);
    expect(route).toBe("execution");
  });

  it("should throw an error when flightOptions is empty", () => {
    const emptyState: TravelState = {
      ...baseState,
      flightOptions: [],
    };

    expect(() => supervisorRouter(emptyState)).toThrowError(
      "[Guardrail Violation] No flight options available to evaluate."
    );
  });
});
