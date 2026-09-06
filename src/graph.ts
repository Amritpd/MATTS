import { StateGraph, START, END } from "@langchain/langgraph";
import { TravelStateAnnotation, TravelState } from "./state.js";
import {
  triageNode,
  policyNode,
  inventoryNode,
  managerApprovalNode,
  executionNode,
} from "./nodes/index.js";
import { supervisorRouter } from "./router.js";

export interface GraphNodeOverrides {
  triage?: (state: TravelState) => Promise<Partial<TravelState>>;
  policy?: (state: TravelState) => Promise<Partial<TravelState>>;
  inventory?: (state: TravelState) => Promise<Partial<TravelState>>;
  manager_approval?: (state: TravelState) => Promise<Partial<TravelState>>;
  execution?: (state: TravelState) => Promise<Partial<TravelState>>;
}

/**
 * Builds and compiles the MATTS StateGraph.
 * Allows optional node overrides for robust unit and integration testing.
 */
export function buildMattsGraph(overrides: GraphNodeOverrides = {}) {
  const workflow = new StateGraph(TravelStateAnnotation)
    // Register isolated nodes (default or mocked overrides)
    .addNode("triage", overrides.triage ?? triageNode)
    .addNode("policy", overrides.policy ?? policyNode)
    .addNode("inventory", overrides.inventory ?? inventoryNode)
    .addNode("manager_approval", overrides.manager_approval ?? managerApprovalNode)
    .addNode("execution", overrides.execution ?? executionNode)

    // Wire sequential pipeline
    .addEdge(START, "triage")
    .addEdge("triage", "policy")
    .addEdge("policy", "inventory")

    // Wire conditional deterministic routing from Inventory
    .addConditionalEdges("inventory", supervisorRouter, {
      manager_approval: "manager_approval",
      execution: "execution",
    })

    // Wire approval back into execution
    .addEdge("manager_approval", "execution")

    // Terminal edge
    .addEdge("execution", END);

  return workflow.compile();
}
