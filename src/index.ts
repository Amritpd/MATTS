export * from "./types.js";
export * from "./state.js";
export * from "./nodes/index.js";
export * from "./router.js";
export * from "./graph.js";

import { buildMattsGraph } from "./graph.js";

export async function run(userInput: string = "Book a flight from YVR to SFO on 2026-10-15") {
  console.log("=================================================================");
  console.log("  🚀 MATTS (Multi-Agent Tamed Travel System) State Machine Starting");
  console.log("=================================================================");

  const app = buildMattsGraph();
  const initialInput = { userInput };

  console.log("Initial User Input:", initialInput.userInput);

  const finalState = await app.invoke(initialInput);

  console.log("\n=================================================================");
  console.log("  ✅ State Machine Completed - Final State Inspection");
  console.log("=================================================================");
  console.log(JSON.stringify(finalState, null, 2));

  return finalState;
}
