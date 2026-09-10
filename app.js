// ============================================================================
// MATTS Observability & Simulation Frontend Controller
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Tab Switcher Elements
  const tabBtnSim = document.getElementById("tab-btn-sim");
  const tabBtnDoc = document.getElementById("tab-btn-doc");
  const viewSimulation = document.getElementById("view-simulation");
  const viewWhitepaper = document.getElementById("view-whitepaper");

  if (tabBtnSim && tabBtnDoc) {
    tabBtnSim.addEventListener("click", () => {
      tabBtnSim.classList.add("active");
      tabBtnDoc.classList.remove("active");
      viewSimulation.style.display = "block";
      viewWhitepaper.style.display = "none";
    });

    tabBtnDoc.addEventListener("click", () => {
      tabBtnDoc.classList.add("active");
      tabBtnSim.classList.remove("active");
      viewSimulation.style.display = "none";
      viewWhitepaper.style.display = "flex";
    });
  }

  // DOM Elements
  const form = document.getElementById("simulation-form");
  const btnRun = document.getElementById("btn-run");
  const inputPrompt = document.getElementById("input-prompt");
  const inputBudget = document.getElementById("input-budget");
  const inputCost = document.getElementById("input-cost");
  const displayBudget = document.getElementById("display-budget");
  const displayCost = document.getElementById("display-cost");
  const inputAirline = document.getElementById("input-airline");
  const inputDelay = document.getElementById("input-delay");
  
  const presetIntercept = document.getElementById("preset-intercept");
  const presetCompliant = document.getElementById("preset-compliant");

  const guardrailPrediction = document.getElementById("guardrail-prediction");
  const guardrailExplanation = document.getElementById("guardrail-explanation");

  const jsonViewer = document.getElementById("json-viewer");
  const stateMutationCount = document.getElementById("state-mutation-count");
  const logsConsole = document.getElementById("logs-console");
  const btnClearLogs = document.getElementById("btn-clear-logs");
  const engineStatus = document.getElementById("engine-status");


  // State Machine Node Elements in DAG
  const nodes = {
    start: document.getElementById("node-start"),
    triage: document.getElementById("node-triage"),
    policy: document.getElementById("node-policy"),
    inventory: document.getElementById("node-inventory"),
    router: document.getElementById("node-router"),
    manager_approval: document.getElementById("node-manager_approval"),
    execution: document.getElementById("node-execution"),
    end: document.getElementById("node-end"),
  };

  const connectors = {
    "start-triage": document.getElementById("conn-start-triage"),
    "triage-policy": document.getElementById("conn-triage-policy"),
    "policy-inventory": document.getElementById("conn-policy-inventory"),
    "inventory-router": document.getElementById("conn-inventory-router"),
    "router-approval": document.getElementById("conn-router-approval"),
    "approval-exec": document.getElementById("conn-approval-exec"),
    "router-exec": document.getElementById("conn-router-exec"),
    "execution-end": document.getElementById("conn-execution-end"),
  };

  let mutationCount = 0;

  // --- Dynamic Slider Updates ---
  function updateGuardrailPreview() {
    const budget = parseInt(inputBudget.value, 10);
    const cost = parseInt(inputCost.value, 10);

    displayBudget.textContent = `$${budget}`;
    displayCost.textContent = `$${cost}`;

    if (cost > budget) {
      guardrailPrediction.className = "status-chip chip-warning";
      guardrailPrediction.textContent = "Manager Approval Required";
      guardrailExplanation.innerHTML = `Cheapest flight (<strong>$${cost}</strong>) exceeds corporate budget (<strong>$${budget}</strong>). Non-deterministic agents cannot bypass this pure code gate.`;
    } else {
      guardrailPrediction.className = "status-chip chip-success";
      guardrailPrediction.textContent = "Direct Auto-Execution";
      guardrailExplanation.innerHTML = `Cheapest flight (<strong>$${cost}</strong>) is within budget (<strong>$${budget}</strong>). Routes directly to payment execution.`;
    }
  }

  inputBudget.addEventListener("input", updateGuardrailPreview);
  inputCost.addEventListener("input", updateGuardrailPreview);

  // --- Presets ---
  presetIntercept.addEventListener("click", () => {
    presetIntercept.classList.add("active");
    presetCompliant.classList.remove("active");
    inputBudget.value = 500;
    inputCost.value = 650;
    inputAirline.value = "Air Canada";
    inputPrompt.value = "Book a flight from YVR to SFO on 2026-10-15";
    updateGuardrailPreview();
  });

  presetCompliant.addEventListener("click", () => {
    presetCompliant.classList.add("active");
    presetIntercept.classList.remove("active");
    inputBudget.value = 500;
    inputCost.value = 420;
    inputAirline.value = "United Airlines";
    inputPrompt.value = "Book cheapest flight from YVR to SFO for compliance";
    updateGuardrailPreview();
  });

  // --- UI Reset Helpers ---
  function resetGraphUI() {
    mutationCount = 0;
    stateMutationCount.textContent = "0 Mutations";

    Object.values(nodes).forEach((n) => {
      n.className = n.className.replace(/\b(active|completed|bypassed)\b/g, "").trim();
    });

    Object.values(connectors).forEach((c) => {
      c.className = c.className.replace(/\b(active|completed|visible)\b/g, "").trim();
    });
  }

  function addLog(text, type = "normal") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;

    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `<span class="log-time">[${now}]</span> <span class="log-text">${escapeHtml(text)}</span>`;
    
    logsConsole.appendChild(entry);
    logsConsole.scrollTop = logsConsole.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  btnClearLogs.addEventListener("click", () => {
    logsConsole.innerHTML = "";
    addLog("Logs cleared.", "system-msg");
  });

  // --- Simulation Execution Engine ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    resetGraphUI();
    btnRun.disabled = true;
    btnRun.innerHTML = `<span class="btn-icon">⏳</span> Executing Flow...`;
    engineStatus.textContent = "State Machine Running...";

    const payload = {
      userInput: inputPrompt.value,
      maxBudget: parseInt(inputBudget.value, 10),
      flightCost: parseInt(inputCost.value, 10),
      flightAirline: inputAirline.value,
      stepDelayMs: parseInt(inputDelay.value, 10),
    };

    addLog(`Initiating state machine run with budget cap: $${payload.maxBudget}, flight cost: $${payload.flightCost}`, "system-msg");

    // Activate START node
    nodes.start.classList.add("active");
    connectors["start-triage"].classList.add("active");

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // Keep partial chunk

        for (const line of lines) {
          if (!line.trim()) continue;
          
          let eventType = "message";
          let dataStr = "";

          line.split("\n").forEach((l) => {
            if (l.startsWith("event: ")) eventType = l.replace("event: ", "").trim();
            if (l.startsWith("data: ")) dataStr = l.replace("data: ", "").trim();
          });

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              handleServerEvent(eventType, data);
            } catch (err) {
              console.error("Failed to parse SSE payload", err, dataStr);
            }
          }
        }
      }
    } catch (err) {
      // Automatic client-side fallback for static deployments (e.g. Vercel)
      addLog(`Running browser-side LangGraph state machine...`, "system-msg");
      await runClientSideSimulation(payload);
    } finally {
      btnRun.disabled = false;
      btnRun.innerHTML = `<span class="btn-icon">▶</span> Run State Machine`;
      engineStatus.textContent = "LangGraph Engine Ready";
    }
  });

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Canonical mapping of major cities and metros to primary IATA airport codes
  const CITY_TO_IATA = {
    "san francisco": "SFO", "sf": "SFO", "bay area": "SFO", "sfo": "SFO",
    "vancouver": "YVR", "yvr": "YVR",
    "new york": "JFK", "new york city": "JFK", "nyc": "JFK", "jfk": "JFK", "laguardia": "LGA", "lga": "LGA", "newark": "EWR", "ewr": "EWR",
    "seattle": "SEA", "sea": "SEA",
    "los angeles": "LAX", "la": "LAX", "lax": "LAX",
    "chicago": "ORD", "ord": "ORD", "midway": "MDW",
    "toronto": "YYZ", "yyz": "YYZ",
    "london": "LHR", "heathrow": "LHR", "lhr": "LHR", "gatwick": "LGW",
    "tokyo": "HND", "haneda": "HND", "hnd": "HND", "narita": "NRT", "nrt": "NRT",
    "paris": "CDG", "cdg": "CDG", "orly": "ORY",
    "miami": "MIA", "mia": "MIA",
    "dallas": "DFW", "dfw": "DFW",
    "atlanta": "ATL", "atl": "ATL",
    "boston": "BOS", "bos": "BOS",
    "denver": "DEN", "den": "DEN",
    "austin": "AUS", "aus": "AUS",
    "las vegas": "LAS", "vegas": "LAS", "las": "LAS",
    "honolulu": "HNL", "hawaii": "HNL", "hnl": "HNL",
    "montreal": "YUL", "yul": "YUL",
    "calgary": "YYC", "yyc": "YYC",
    "frankfurt": "FRA", "fra": "FRA",
    "amsterdam": "AMS", "ams": "AMS",
    "dubai": "DXB", "dxb": "DXB",
    "singapore": "SIN", "sin": "SIN",
    "sydney": "SYD", "syd": "SYD",
    "washington": "IAD", "dc": "IAD", "iad": "IAD",
    "houston": "IAH", "iah": "IAH",
    "phoenix": "PHX", "phx": "PHX",
    "san diego": "SAN", "san": "SAN",
    "orlando": "MCO", "mco": "MCO",
    "portland": "PDX", "pdx": "PDX",
    "berlin": "BER", "ber": "BER",
    "rome": "FCO", "fco": "FCO",
    "madrid": "MAD", "mad": "MAD",
    "hong kong": "HKG", "hkg": "HKG",
    "seoul": "ICN", "icn": "ICN",
    "cancun": "CUN", "cun": "CUN"
  };

  const MONTH_MAP = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
    aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10",
    nov: "11", november: "11", dec: "12", december: "12"
  };

  function normalizeClientLocation(locStr) {
    if (!locStr) return "";
    let cleaned = locStr.trim().toLowerCase().replace(/[(),]/g, " ");
    cleaned = cleaned.replace(/\b(tomorrow|today|tonight|next\s+\w+|on|for|cheap|cheapest|flights?|tickets?|please|date|dep|arr|book|booking|fly|find|leaving|heading|arriving)\b/gi, " ").trim();
    cleaned = cleaned.replace(/\s+/g, " ");

    if (CITY_TO_IATA[cleaned]) return CITY_TO_IATA[cleaned];

    for (const [cityName, code] of Object.entries(CITY_TO_IATA)) {
      const regex = new RegExp(`\\b${cityName}\\b`, "i");
      if (regex.test(cleaned)) return code;
    }

    const stopWords = new Set(["the", "and", "for", "out", "via", "way", "one", "get", "any", "all", "new", "day", "you", "not", "how", "who", "why", "now", "are"]);

    const exactMatch = cleaned.match(/^([a-z]{3})$/i);
    if (exactMatch && !stopWords.has(exactMatch[1].toLowerCase())) {
      return exactMatch[1].toUpperCase();
    }

    const codeMatch = cleaned.match(/\b([a-z]{3})\b/i);
    if (codeMatch && !stopWords.has(codeMatch[1].toLowerCase())) {
      return codeMatch[1].toUpperCase();
    }

    return "";
  }

  function parseClientDate(text, defaultDate = "2026-10-15") {
    if (!text) return defaultDate;
    const isoMatch = text.match(/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (usDateMatch) return `${usDateMatch[3]}-${usDateMatch[1].padStart(2, "0")}-${usDateMatch[2].padStart(2, "0")}`;
    const namedMonthMatch = text.match(/\b(?:on\s+)?(\d{1,2})?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})?(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/i);
    if (namedMonthMatch) {
      const dayStr = namedMonthMatch[1] || namedMonthMatch[3] || "15";
      const monthName = namedMonthMatch[2].toLowerCase();
      const yearStr = namedMonthMatch[4] || "2026";
      const monthNum = MONTH_MAP[monthName] || "10";
      const dayNum = parseInt(dayStr, 10).toString().padStart(2, "0");
      return `${yearStr}-${monthNum}-${dayNum}`;
    }
    const now = new Date(2026, 9, 15);
    if (/\btomorrow\b/i.test(text)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split("T")[0];
    }
    if (/\bnext\s+week\b/i.test(text)) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString().split("T")[0];
    }
    return defaultDate;
  }

  function parseClientNaturalLanguage(input) {
    const text = (input || "").trim();
    if (!text) {
      return { origin: "", destination: "", date: "2026-10-15", isValid: false, errorMessage: "Empty prompt" };
    }

    let rawOrigin = "";
    let rawDestination = "";

    const fromToMatch = text.match(/\bfrom\s+([A-Za-z\s()]{2,25}?)\s+to\s+([A-Za-z\s()]{2,25}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);
    const toFromMatch = text.match(/\b(?:to|heading to|flying to)\s+([A-Za-z\s()]{2,25}?)\s+from\s+([A-Za-z\s()]{2,25}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);
    const arrowMatch = text.match(/\b([A-Za-z\s()]{2,20}?)\s*(?:->|-->|=>|to|-)\s*([A-Za-z\s()]{2,20}?)(?=\s+on|\s+for|\s+date|\s+dep|\s+tomorrow|\s+today|\s+next|\s*$|[.,;])/i);

    if (fromToMatch) {
      rawOrigin = fromToMatch[1];
      rawDestination = fromToMatch[2];
    } else if (toFromMatch) {
      rawDestination = toFromMatch[1];
      rawOrigin = toFromMatch[2];
    } else if (arrowMatch) {
      rawOrigin = arrowMatch[1];
      rawDestination = arrowMatch[2];
    } else {
      const fromMatch = text.match(/\bfrom\s+([A-Za-z]{3,20})\b/i);
      const toMatch = text.match(/\bto\s+([A-Za-z]{3,20})\b/i);
      if (fromMatch) rawOrigin = fromMatch[1];
      if (toMatch) rawDestination = toMatch[1];
    }

    const origin = rawOrigin ? normalizeClientLocation(rawOrigin) : "";
    const destination = rawDestination ? normalizeClientLocation(rawDestination) : "";
    const date = parseClientDate(text, "2026-10-15");

    if (!origin || !destination || origin.length < 3 || destination.length < 3) {
      return {
        origin,
        destination,
        date,
        isValid: false,
        errorMessage: `Could not identify valid origin and destination in "${text}"`,
      };
    }

    if (origin === destination) {
      return {
        origin,
        destination,
        date,
        isValid: false,
        errorMessage: `Origin (${origin}) and destination (${destination}) cannot be identical`,
      };
    }

    return { origin, destination, date, isValid: true, errorMessage: null };
  }

  async function runClientSideSimulation(payload) {
    const delay = payload.stepDelayMs || 600;
    
    // 1. Triage Extraction
    handleServerEvent("node_start", { node: "triage", title: "Triage & Intent Parser" });
    await sleep(delay);

    const parsed = parseClientNaturalLanguage(payload.userInput);

    if (!parsed.isValid) {
      let state = {
        userInput: payload.userInput,
        intentId: "INTENT-INVALID",
        parsedRequest: { origin: parsed.origin, destination: parsed.destination, date: parsed.date, isValid: false, errorMessage: parsed.errorMessage },
        maxBudget: 0,
        flightOptions: [],
        approvalStatus: "REJECTED_INVALID_INPUT",
        finalBookingId: null,
        error: `TRIAGE_VALIDATION_ERROR: ${parsed.errorMessage}`,
      };

      handleServerEvent("node_complete", {
        node: "triage",
        title: "Triage & Intent Parser",
        status: "error",
        log: `❌ Schema Validation Failure: "${payload.userInput}" is unparseable (${parsed.errorMessage}). Commercial intent rejected.`,
        durationMs: 38,
        fullState: state
      });

      await sleep(delay);
      handleServerEvent("node_start", { node: "policy", title: "Policy Guardrail" });
      await sleep(delay / 2);
      handleServerEvent("node_complete", {
        node: "policy",
        title: "Policy Guardrail",
        status: "bypassed",
        log: `Policy lookup skipped: Input request is marked invalid (${state.error}).`,
        durationMs: 5,
        fullState: state
      });

      await sleep(delay / 2);
      handleServerEvent("node_start", { node: "inventory", title: "GDS Inventory Aggregator" });
      await sleep(delay / 2);
      handleServerEvent("node_complete", {
        node: "inventory",
        title: "GDS Inventory Aggregator",
        status: "bypassed",
        log: `⚠️ GDS Inventory Query Bypassed: Refusing external API query on unvalidated input.`,
        durationMs: 8,
        fullState: state
      });

      handleServerEvent("supervisor_eval", {
        action: "execution",
        cheapestCost: 0,
        maxBudget: 0
      });

      await sleep(delay / 2);
      handleServerEvent("node_start", { node: "execution", title: "Deterministic Execution Node" });
      await sleep(delay / 2);
      handleServerEvent("node_complete", {
        node: "execution",
        title: "Deterministic Execution Node",
        status: "bypassed",
        log: `🚫 Virtual Card Authorization BLOCKED: Zero charges made to corporate ledger (${state.error}).`,
        durationMs: 12,
        fullState: state
      });

      await sleep(delay / 2);
      handleServerEvent("done", { finalState: state, success: false });
      return;
    }

    const { origin, destination, date: departureDate } = parsed;
    const intentHash = Math.abs((origin + destination + departureDate).split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)).toString(16).toUpperCase().padStart(8, '0');
    const intentId = `INTENT-${intentHash}`;

    let state = {
      userInput: payload.userInput,
      intentId,
      parsedRequest: { origin, destination, date: departureDate, isValid: true, errorMessage: null },
      maxBudget: 0,
      flightOptions: [],
      approvalStatus: "PENDING",
      finalBookingId: null,
      error: null,
    };

    handleServerEvent("node_complete", {
      node: "triage",
      title: "Triage & Intent Parser",
      status: "completed",
      log: `Structured intent bound: ${origin} → ${destination} (${departureDate}) [${intentId}]`,
      durationMs: 42,
      fullState: state
    });

    // 2. Policy Enforcement
    await sleep(delay);
    handleServerEvent("node_start", { node: "policy", title: "Policy Guardrail" });
    await sleep(delay);
    state.maxBudget = payload.maxBudget;
    handleServerEvent("node_complete", {
      node: "policy",
      title: "Policy Guardrail",
      status: "completed",
      log: `Corporate budget ceiling verified and sealed at $${state.maxBudget}`,
      durationMs: 18,
      fullState: state
    });

    // 3. Inventory Query
    await sleep(delay);
    handleServerEvent("node_start", { node: "inventory", title: "GDS Inventory Aggregator" });
    await sleep(delay);
    const flightId = `FL-${payload.flightCost}-${(payload.flightAirline || 'AIR').slice(0, 2).toUpperCase()}`;
    state.flightOptions = [
      { id: flightId, airline: payload.flightAirline, cost: payload.flightCost },
    ];
    handleServerEvent("node_complete", {
      node: "inventory",
      title: "GDS Inventory Aggregator",
      status: "completed",
      log: `GDS returned route ${origin} -> ${destination}: ${flightId} (${payload.flightAirline}) @ $${payload.flightCost}`,
      durationMs: 94,
      fullState: state
    });

    // 4. Supervisor Routing Evaluation
    await sleep(delay);
    const requiresApproval = payload.flightCost > state.maxBudget;
    handleServerEvent("supervisor_eval", {
      action: requiresApproval ? "manager_approval" : "execution",
      cheapestCost: payload.flightCost,
      maxBudget: state.maxBudget
    });

    if (requiresApproval) {
      await sleep(delay);
      handleServerEvent("node_start", { node: "manager_approval", title: "Manager HITL Gate" });
      await sleep(delay);
      state.approvalStatus = "APPROVED";
      handleServerEvent("node_complete", {
        node: "manager_approval",
        title: "Manager HITL Gate",
        status: "completed",
        log: `Manager override received: Approved $${payload.flightCost} policy override`,
        durationMs: 310,
        fullState: state
      });
    }

    // 5. Deterministic Execution
    await sleep(delay);
    handleServerEvent("node_start", { node: "execution", title: "Deterministic Execution Node" });
    await sleep(delay);
    const bookingId = `BK-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${flightId}`;
    state.finalBookingId = bookingId;
    handleServerEvent("node_complete", {
      node: "execution",
      title: "Deterministic Execution Node",
      status: "completed",
      log: `Authorized corporate card for $${payload.flightCost}. Confirmed PNR: ${bookingId}`,
      durationMs: 145,
      fullState: state
    });

    // 6. Complete
    await sleep(delay / 2);
    handleServerEvent("done", { finalState: state, success: true });
  }

  function handleServerEvent(event, data) {
    if (event === "node_start") {
      const nodeEl = nodes[data.node];
      if (nodeEl) {
        nodeEl.classList.remove("completed", "bypassed");
        nodeEl.classList.add("active");
      }
    } else if (event === "node_complete") {
      const nodeEl = nodes[data.node];
      if (nodeEl) {
        nodeEl.classList.remove("active");
        if (data.status === "bypassed" || data.status === "error") {
          nodeEl.classList.add("bypassed");
        } else {
          nodeEl.classList.add("completed");
        }
      }

      // Update State Object Viewer
      mutationCount++;
      stateMutationCount.textContent = `${mutationCount} Mutation${mutationCount > 1 ? "s" : ""}`;
      jsonViewer.textContent = JSON.stringify(data.fullState, null, 2);

      const logType = data.status === "error" ? "guardrail-alert" : data.status === "bypassed" ? "system-msg" : "node-complete";
      addLog(`[${data.title}] ${data.log} (${data.durationMs}ms)`, logType);

      // Mark connectors
      if (data.node === "triage") {
        connectors["start-triage"].classList.add("completed");
        connectors["triage-policy"].classList.add("active");
      } else if (data.node === "policy") {
        connectors["triage-policy"].classList.add("completed");
        connectors["policy-inventory"].classList.add("active");
      } else if (data.node === "inventory") {
        connectors["policy-inventory"].classList.add("completed");
        connectors["inventory-router"].classList.add("active");
        nodes.router.classList.add("active");
      } else if (data.node === "manager_approval") {
        connectors["router-approval"].classList.add("completed");
        connectors["approval-exec"].classList.add("active");
      } else if (data.node === "execution") {
        connectors["approval-exec"].classList.add("completed");
        connectors["execution-end"].classList.add("active");
        nodes.end.classList.add(data.fullState?.error ? "bypassed" : "completed");
      }
    } else if (event === "supervisor_eval") {
      nodes.router.classList.remove("active");
      nodes.router.classList.add("completed");

      if (data.action === "manager_approval") {
        addLog(`[🚦 Supervisor Router] Policy breach detected: $${data.cheapestCost} > $${data.maxBudget}. Routing to Manager Approval.`, "guardrail-alert");
        connectors["router-approval"].classList.add("active");
        nodes.manager_approval.classList.remove("bypassed");
      } else {
        if (data.reason && data.reason.includes("validation")) {
          addLog(`[🚦 Supervisor Router] 🚨 Abort Routing: Input validation failed. Skipping approval and routing to safety abort.`, "guardrail-alert");
        } else {
          addLog(`[🚦 Supervisor Router] Spending compliant: $${data.cheapestCost} <= $${data.maxBudget}. Direct execution bypass triggered.`, "success-msg");
        }
        connectors["router-exec"].classList.add("visible");
        nodes.manager_approval.classList.add("bypassed");
      }
    } else if (event === "done") {
      nodes.start.classList.add("completed");
      nodes.end.classList.add(data.finalState?.error ? "bypassed" : "completed");
      connectors["execution-end"].classList.add("completed");
      if (data.finalState?.error || data.success === false) {
        addLog(`🚨 Flow Terminated with Errors: ${data.finalState?.error}. Zero financial exposure. Virtual card charge aborted.`, "guardrail-alert");
      } else {
        addLog(`State machine finished. Booking transaction sealed with ID: ${data.finalState.finalBookingId}`, "success-msg");
      }
    }
  }

  // Initial calculation
  updateGuardrailPreview();
});
