import { describe, it, expect, vi } from "vitest";
import { buildMattsGraph } from "../../src/graph.js";
import { TravelState } from "../../src/state.js";

describe("Integration Tests: MATTS StateGraph Full LifeCycle", () => {
  it("INTEGRATION: Over-budget flight triggers Manager Approval loop and executes booking", async () => {
    const app = buildMattsGraph();

    const initialState = {
      userInput: "Book a flight from YVR to SFO on 2026-10-15",
    };

    const finalState = await app.invoke(initialState) as TravelState;

    // Assert complete traversal
    expect(finalState.userInput).toBe(initialState.userInput);
    expect(finalState.parsedRequest).toMatchObject({
      origin: "YVR",
      destination: "SFO",
      date: "2026-10-15",
    });
    expect(finalState.maxBudget).toBe(500);
    expect(finalState.flightOptions).toHaveLength(1);
    expect(finalState.flightOptions[0].cost).toBe(650);

    // Assert approval loop was intercepted and approved
    expect(finalState.approvalStatus).toBe("APPROVED");

    // Assert execution occurred
    expect(finalState.finalBookingId).toBeDefined();
    expect(finalState.finalBookingId).toMatch(/^BK-[A-F0-9]{8}-FL-650-AC$/);
  });

  it("INTEGRATION: Under-budget flight bypasses Manager Approval directly to Execution", async () => {
    // Override inventory to return a flight within the $500 policy cap
    const mockApprovalSpy = vi.fn();

    const app = buildMattsGraph({
      inventory: async (state: TravelState) => ({
        flightOptions: [
          {
            id: "FL-420-UA",
            cost: 420,
            airline: "United Airlines",
          },
        ],
      }),
      manager_approval: async (state: TravelState) => {
        mockApprovalSpy();
        return { approvalStatus: "APPROVED" };
      },
    });

    const finalState = await app.invoke({
      userInput: "Book cheap flight YVR to SFO",
    }) as TravelState;

    // Assert Manager Approval was NEVER called
    expect(mockApprovalSpy).not.toHaveBeenCalled();

    // Assert approvalStatus remained PENDING because no escalation was needed
    expect(finalState.approvalStatus).toBe("PENDING");
    expect(finalState.flightOptions[0].cost).toBe(420);
    expect(finalState.finalBookingId).toBeDefined();
    expect(finalState.finalBookingId).toMatch(/^BK-[A-F0-9]{8}-FL-420-UA$/);
  });

  it("INTEGRATION: Multiple flight options picks cheapest and bypasses approval if cheapest is compliant", async () => {
    const mockApprovalSpy = vi.fn();

    const app = buildMattsGraph({
      inventory: async () => ({
        flightOptions: [
          { id: "FL-EXPENSIVE", cost: 950, airline: "Air Canada" },
          { id: "FL-COMPLIANT", cost: 480, airline: "WestJet" },
        ],
      }),
      manager_approval: async () => {
        mockApprovalSpy();
        return { approvalStatus: "APPROVED" };
      },
      execution: async (state: TravelState) => {
        // In real execution, selects the cheapest or preferred option
        const cheapest = state.flightOptions.reduce((prev, curr) => (curr.cost < prev.cost ? curr : prev));
        return { finalBookingId: `BK-TEST-${cheapest.id}` };
      },
    });

    const finalState = await app.invoke({
      userInput: "Find and book cheapest flight",
    }) as TravelState;

    expect(mockApprovalSpy).not.toHaveBeenCalled();
    expect(finalState.approvalStatus).toBe("PENDING");
    expect(finalState.finalBookingId).toBe("BK-TEST-FL-COMPLIANT");
  });
});
