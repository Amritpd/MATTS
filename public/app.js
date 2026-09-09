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
        throw new Error(`Server returned status: ${response.status}`);
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
      addLog(`Error executing workflow: ${err.message}`, "guardrail-alert");
    } finally {
      btnRun.disabled = false;
      btnRun.innerHTML = `<span class="btn-icon">▶</span> Run State Machine`;
      engineStatus.textContent = "LangGraph Engine Ready";
    }
  });

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
