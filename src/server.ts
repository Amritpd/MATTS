import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMattsGraph } from "./graph.js";
import { TravelState } from "./state.js";
import { FlightOption } from "./types.js";
import { parseTriageRequest } from "./parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Streaming simulation run (SSE)
  if (url.pathname === "/api/simulate" && req.method === "POST") {
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

      const stepDelay = config.stepDelayMs ?? 600;

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

        // Build graph with custom instrumentation overrides to capture live step emissions
        let managerApprovalInvoked = false;

        const app = buildMattsGraph({
          triage: async (state: TravelState) => {
            const start = performance.now();
            sendEvent("node_start", { node: "triage", title: "Triage Node" });
            if (stepDelay > 0) await sleep(stepDelay);

            const parsedRequest = parseTriageRequest(state.userInput, state.parsedRequest);
            const intentId = state.intentId || parsedRequest.intentId || "INTENT-UNKNOWN";
            parsedRequest.intentId = intentId;

            const durationMs = Math.round(performance.now() - start);
            const delta = { intentId, parsedRequest };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "triage",
              title: "Triage Node",
              status: "completed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `LLM extracted commercial intent [${intentId}]: ${parsedRequest.origin} -> ${parsedRequest.destination} on ${parsedRequest.date}`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          },

          policy: async (state: TravelState) => {
            const start = performance.now();
            sendEvent("node_start", { node: "policy", title: "Policy Node" });
            if (stepDelay > 0) await sleep(stepDelay);

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
              log: `Corporate compliance limit resolved from database: $${maxBudget} cap.`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          },

          inventory: async (state: TravelState) => {
            const start = performance.now();
            sendEvent("node_start", { node: "inventory", title: "Inventory Node" });
            if (stepDelay > 0) await sleep(stepDelay);

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

            // Supervisor evaluation event
            sendEvent("supervisor_eval", {
              cheapestCost: cost,
              maxBudget: fullState.maxBudget,
              approvalStatus: fullState.approvalStatus,
              isOverBudget: cost > fullState.maxBudget,
              action: cost > fullState.maxBudget && fullState.approvalStatus !== "APPROVED" ? "manager_approval" : "execution",
            });

            return delta;
          },

          manager_approval: async (state: TravelState) => {
            managerApprovalInvoked = true;
            const start = performance.now();
            sendEvent("node_start", { node: "manager_approval", title: "Manager Approval Node" });
            if (stepDelay > 0) await sleep(stepDelay);

            const durationMs = Math.round(performance.now() - start);
            const delta = { approvalStatus: "APPROVED" };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "manager_approval",
              title: "Manager Approval Node",
              status: "completed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `Human-in-the-Loop Intercept: Spending policy override granted by Manager.`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          },

          execution: async (state: TravelState) => {
            const start = performance.now();
            sendEvent("node_start", { node: "execution", title: "Execution Node" });
            if (stepDelay > 0) await sleep(stepDelay);

            const selectedFlight = state.flightOptions[0] || { id: "FL-MOCK", cost: 0, airline: "N/A" };
            const durationMs = Math.round(performance.now() - start);
            
            // Dynamic finalBookingId
            const finalBookingId = `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${selectedFlight.id}`;
            const delta = { finalBookingId };
            const fullState = { ...state, ...delta };

            sendEvent("node_complete", {
              node: "execution",
              title: "Execution Node",
              status: "completed",
              timestamp: new Date().toISOString(),
              durationMs,
              log: `Card charged $${selectedFlight.cost}. Idempotent reference: ${finalBookingId}.`,
              stateDelta: delta,
              fullState,
            } as StepEvent);

            return delta;
          },
        });

        const initialInput = {
          userInput: config.userInput || "Book a flight from YVR to SFO on 2026-10-15",
          approvalStatus: config.approvalStatus || "PENDING",
        };

        const finalState = await app.invoke(initialInput);

        sendEvent("done", {
          finalState,
          managerApprovalInvoked,
          success: true,
          timestamp: new Date().toISOString(),
        });

        res.end();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendEvent("error", { error: errorMsg });
        res.end();
      }
    });

    return;
  }

  // Static file serving
  let filePath = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback to index.html for SPA if needed
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackErr, indexContent) => {
          if (fallbackErr) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
            res.end(indexContent);
          }
        });
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n=============================================================`);
  console.log(`  🌐 MATTS Observability Dashboard live at: http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});

export default server;
