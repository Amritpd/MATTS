import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { buildMattsGraph } from "../src/graph.js";
import { TravelState } from "../src/state.js";
import { FlightOption } from "../src/types.js";
import { generateIdempotencyKey } from "../src/nodes/execution.js";
import { parseTriageRequest } from "../src/parser.js";

interface SimulationRequest {
  userInput?: string;
  maxBudget?: number;
  flightCost?: number;
  flightAirline?: string;
  flightId?: string;
  approvalStatus?: string;
  stepDelayMs?: number;
}

interface StepEvent {
  node: string;
  title: string;
  status: "active" | "completed" | "bypassed" | "error";
  timestamp: string;
  durationMs: number;
  log: string;
  stateDelta: Record<string, unknown>;
  fullState: TravelState;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    let config: SimulationRequest = {};
    try {
      if (body) {
        config = JSON.parse(body);
      }
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON payload" }));
      return;
    }

    const stepDelay = config.stepDelayMs ?? 400;

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=UTF-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const sendEvent = (eventType: string, data: unknown) => {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent("init", { message: "State machine initialized", timestamp: new Date().toISOString() });

      let managerApprovalInvoked = false;

      const app = buildMattsGraph({
        triage: async (state: TravelState) => {
          const start = performance.now();
          sendEvent("node_start", { node: "triage", title: "Triage Node" });
          if (stepDelay > 0) await sleep(stepDelay);

          const parsedRequest = parseTriageRequest(state.userInput, state.parsedRequest);
          const durationMs = Math.round(performance.now() - start);

          if (!parsedRequest.isValid) {
            const delta = {
              intentId: "INTENT-INVALID",
              parsedRequest,
              error: `TRIAGE_VALIDATION_ERROR: ${parsedRequest.errorMessage}`,
              approvalStatus: "REJECTED_INVALID_INPUT",
              flightOptions: [],
            };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "triage",
              title: "Triage Node",
              status: "error",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `❌ Schema Validation Failure: "${state.userInput}" is unparseable (${parsedRequest.errorMessage}). Commercial intent rejected.`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          }

          const intentId = state.intentId || parsedRequest.intentId || "INTENT-UNKNOWN";
          parsedRequest.intentId = intentId;

          const delta = { intentId, parsedRequest, error: null };
          const fullState = { ...state, ...delta };

          sendEvent("node_complete", {
            node: "triage",
            title: "Triage Node",
            status: "completed",
            timestamp: new Date().toISOString(),
            durationMs,
            log: `Extracted commercial intent [${intentId}]: ${parsedRequest.origin} -> ${parsedRequest.destination} on ${parsedRequest.date}`,
            stateDelta: delta,
            fullState,
          } as StepEvent);

          return delta;
        },

        policy: async (state: TravelState) => {
          const start = performance.now();
          sendEvent("node_start", { node: "policy", title: "Policy Node" });
          if (stepDelay > 0) await sleep(stepDelay);

          if (state.error || state.approvalStatus === "REJECTED_INVALID_INPUT") {
            const durationMs = Math.round(performance.now() - start);
            const delta = { maxBudget: 0 };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "policy",
              title: "Policy Node",
              status: "bypassed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `Policy lookup skipped: Input request is marked invalid (${state.error}).`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          }

          const maxBudget = config.maxBudget ?? 500;
          const durationMs = Math.round(performance.now() - start);
          const delta = { maxBudget };
          const fullState = { ...state, ...delta };

          sendEvent("node_complete", {
            node: "policy",
            title: "Policy Node",
            status: "completed",
            timestamp: new Date().toISOString(),
            durationMs,
            log: `Corporate compliance limit resolved from database: $${maxBudget} cap (Locked/Immutable).`,
            stateDelta: delta,
            fullState,
          } as StepEvent);

          return delta;
        },

        inventory: async (state: TravelState) => {
          const start = performance.now();
          sendEvent("node_start", { node: "inventory", title: "Inventory Node" });
          if (stepDelay > 0) await sleep(stepDelay);

          if (state.error || state.approvalStatus === "REJECTED_INVALID_INPUT") {
            const durationMs = Math.round(performance.now() - start);
            const delta = { flightOptions: [] };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "inventory",
              title: "Inventory Node",
              status: "bypassed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `⚠️ GDS Inventory Query Bypassed: Refusing external API query on unvalidated input.`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            sendEvent("supervisor_eval", {
              route: "execution",
              cheapestCost: 0,
              maxBudget: 0,
              reason: "Input validation error. Routing directly to execution to halt charge.",
            });

            return delta;
          }

          const cost = config.flightCost ?? 650;
          const airline = config.flightAirline ?? (cost > 500 ? "Air Canada" : "WestJet");
          const id = config.flightId ?? `FL-${cost}-${airline.slice(0, 2).toUpperCase()}`;

          const flightOptions: FlightOption[] = [{ id, cost, airline }];
          const durationMs = Math.round(performance.now() - start);
          const delta = { flightOptions };
          const fullState = { ...state, ...delta };

          const origin = fullState.parsedRequest?.origin || "YVR";
          const destination = fullState.parsedRequest?.destination || "SFO";

          sendEvent("node_complete", {
            node: "inventory",
            title: "Inventory Node",
            status: "completed",
            timestamp: new Date().toISOString(),
            durationMs,
            log: `GDS API returned option for ${origin} -> ${destination}: ${id} (${airline}) at $${cost}.`,
            stateDelta: delta,
            fullState,
          } as StepEvent);

          const cheapestCost = cost;
          const currentBudget = fullState.maxBudget;
          const isOverBudget = cheapestCost > currentBudget;

          if (isOverBudget && fullState.approvalStatus !== "APPROVED") {
            sendEvent("supervisor_eval", {
              route: "manager_approval",
              cheapestCost,
              maxBudget: currentBudget,
              reason: `Flight cost ($${cheapestCost}) exceeds corporate cap ($${currentBudget}). Routing to Manager Approval.`,
            });
          } else {
            sendEvent("supervisor_eval", {
              route: "execution",
              cheapestCost,
              maxBudget: currentBudget,
              reason: `Policy checks cleared ($${cheapestCost} <= $${currentBudget}). Bypassing approval directly to Execution.`,
            });
          }

          return delta;
        },

        manager_approval: async (state: TravelState) => {
          if (state.error || state.approvalStatus === "REJECTED_INVALID_INPUT") {
            return {};
          }

          managerApprovalInvoked = true;
          const start = performance.now();
          sendEvent("node_start", { node: "manager_approval", title: "Manager Approval" });
          if (stepDelay > 0) await sleep(stepDelay * 1.2);

          const approvalStatus = "APPROVED";
          const durationMs = Math.round(performance.now() - start);
          const delta = { approvalStatus };
          const fullState = { ...state, ...delta };

          sendEvent("node_complete", {
            node: "manager_approval",
            title: "Manager Approval",
            status: "completed",
            timestamp: new Date().toISOString(),
            durationMs,
            log: `Human-in-the-Loop Intercept: VP Travel approved policy override. status: APPROVED`,
            stateDelta: delta,
            fullState,
          } as StepEvent);

          return delta;
        },

        execution: async (state: TravelState) => {
          const start = performance.now();
          sendEvent("node_start", { node: "execution", title: "Execution Node" });
          if (stepDelay > 0) await sleep(stepDelay);

          if (state.error || state.approvalStatus === "REJECTED_INVALID_INPUT" || !state.flightOptions || state.flightOptions.length === 0) {
            const durationMs = Math.round(performance.now() - start);
            const delta = { finalBookingId: null };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "execution",
              title: "Execution Node",
              status: "bypassed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `🚫 Virtual Card Authorization BLOCKED: Zero charges made to corporate ledger (${state.error || "No valid inventory"}).`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          }

          const selectedFlight = state.flightOptions[0];
          const flightId = selectedFlight?.id ?? "FL-UNKNOWN";
          const intentId = state.intentId || "INTENT-DEFAULT";
          const idempotencyKey = generateIdempotencyKey(intentId, flightId);

          const finalBookingId = `BK-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${flightId}`;
          const durationMs = Math.round(performance.now() - start);
          const delta = { finalBookingId };
          const fullState = { ...state, ...delta };

          sendEvent("node_complete", {
            node: "execution",
            title: "Execution Node",
            status: "completed",
            timestamp: new Date().toISOString(),
            durationMs,
            log: `Authorized corporate card. Key: ${idempotencyKey}. Confirmed PNR: ${finalBookingId}`,
            stateDelta: delta,
            fullState,
          } as StepEvent);

          return delta;
        },
      });

      const initialState: Partial<TravelState> = {
        userInput: config.userInput || "Book a flight from YVR to SFO on 2026-10-15",
      };

      const finalState = await app.invoke(initialState) as TravelState;

      sendEvent("complete", {
        status: "SUCCESS",
        finalBookingId: finalState.finalBookingId,
        managerApprovalBypassed: !managerApprovalInvoked,
        fullState,
      });

      res.end();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      sendEvent("error", { message: errorMsg });
      res.end();
    }
  });
}
