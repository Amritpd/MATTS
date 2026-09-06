import process from "node:process";
import { run } from "./src/index.js";

// Execute state machine
run("Book a flight from YVR to SFO on 2026-10-15").catch((err) => {
  console.error("MATTS Execution Failed:", err);
  process.exit(1);
});
