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

  async function runClientSideSimulation(payload) {
    const delay = payload.stepDelayMs || 600;
    const text = payload.userInput || "";
    
    // 1. Triage Extraction
    handleServerEvent("node_start", { node: "triage", title: "Triage & Intent Parser" });
    await sleep(delay);

    let origin = "YVR";
    let destination = "SFO";
    let departureDate = "2026-10-15";

    const originMatch = text.match(/\b(?:from|leaving)\s+([A-Za-z\s]{3,20}?)(?=\s+to|\s+on|\s*$)/i);
    const destMatch = text.match(/\b(?:to|heading to)\s+([A-Za-z\s]{3,20}?)(?=\s+on|\s+for|\s*$)/i);
    const dateMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);

    if (originMatch) origin = originMatch[1].trim().toUpperCase();
    if (destMatch) destination = destMatch[1].trim().toUpperCase();
    if (dateMatch) departureDate = dateMatch[1];

    const intentId = `INTENT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    let state = {
      userInput: payload.userInput,
      intentId,
      parsedRequest: { origin, destination, departureDate },
      maxBudget: 0,
      flightOptions: [],
      approvalStatus: "NOT_REQUIRED",
      finalBookingId: null,
    };

    handleServerEvent("node_complete", {
      node: "triage",
      title: "Triage & Intent Parser",
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
      log: `Corporate budget ceiling verified and sealed at $${state.maxBudget}`,
      durationMs: 18,
      fullState: state
    });

    // 3. Inventory Query
    await sleep(delay);
    handleServerEvent("node_start", { node: "inventory", title: "GDS Inventory Aggregator" });
    await sleep(delay);
    state.flightOptions = [
      { id: "FL-101", airline: payload.flightAirline, cost: payload.flightCost, departure: "08:30" },
      { id: "FL-204", airline: "Delta Air Lines", cost: payload.flightCost + 85, departure: "14:15" },
    ];
    handleServerEvent("node_complete", {
      node: "inventory",
      title: "GDS Inventory Aggregator",
      log: `Retrieved 2 live quotes. Best available: ${payload.flightAirline} @ $${payload.flightCost}`,
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
      state.approvalStatus = "APPROVED_BY_MANAGER";
      handleServerEvent("node_complete", {
        node: "manager_approval",
        title: "Manager HITL Gate",
        log: `Manager override received: Approved $${payload.flightCost} for business critical travel`,
        durationMs: 310,
        fullState: state
      });
    }

    // 5. Deterministic Execution
    await sleep(delay);
    handleServerEvent("node_start", { node: "execution", title: "Deterministic Money Plane" });
    await sleep(delay);
    const bookingId = `BK-BREX-${Math.floor(100000 + Math.random() * 900000)}`;
    state.finalBookingId = bookingId;
    handleServerEvent("node_complete", {
      node: "execution",
      title: "Deterministic Money Plane",
      log: `Virtual card tokenized and charged $${payload.flightCost}. Ledger booking ref: ${bookingId}`,
      durationMs: 145,
      fullState: state
    });

    // 6. Complete
    await sleep(delay / 2);
    handleServerEvent("done", { finalState: state });
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
        nodeEl.classList.add("completed");
      }

      // Update State Object Viewer
      mutationCount++;
      stateMutationCount.textContent = `${mutationCount} Mutation${mutationCount > 1 ? "s" : ""}`;
      jsonViewer.textContent = JSON.stringify(data.fullState, null, 2);

      addLog(`[${data.title}] ${data.log} (${data.durationMs}ms)`, "node-complete");

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
        nodes.end.classList.add("completed");
      }
    } else if (event === "supervisor_eval") {
      nodes.router.classList.remove("active");
      nodes.router.classList.add("completed");

      if (data.action === "manager_approval") {
        addLog(`[🚦 Supervisor Router] Policy breach detected: $${data.cheapestCost} > $${data.maxBudget}. Routing to Manager Approval.`, "guardrail-alert");
        connectors["router-approval"].classList.add("active");
        nodes.manager_approval.classList.remove("bypassed");
      } else {
        addLog(`[🚦 Supervisor Router] Spending compliant: $${data.cheapestCost} <= $${data.maxBudget}. Direct execution bypass triggered.`, "success-msg");
        connectors["router-exec"].classList.add("visible");
        nodes.manager_approval.classList.add("bypassed");
      }
    } else if (event === "done") {
      nodes.start.classList.add("completed");
      nodes.end.classList.add("completed");
      connectors["execution-end"].classList.add("completed");
      addLog(`State machine finished. Booking transaction sealed with ID: ${data.finalState.finalBookingId}`, "success-msg");
    }
  }

  // Initial calculation
  updateGuardrailPreview();
});
