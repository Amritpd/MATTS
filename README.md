# 🧳 Multi-Agent Tamed Travel System (MATTS)

**LLMs are probabilistic. Corporate budgets are not.** 

Enterprise AI deployments usually fail because agents are chained together non-deterministically—meaning a hallucinating LLM is just one bad prompt away from draining a corporate card. 

**MATTS** is a proof-of-concept architecture that tames multi-agent networks for high-stakes financial environments. Built on `@langchain/langgraph`, it strictly isolates AI agents and forces all execution through a centralized, validated State Object guarded by pure, deterministic code.

## 🛡️ The Architecture: Shared State, Isolated Agents

Agents do not communicate directly. They read from and mutate a shared state graph. A deterministic routing function evaluates the state at critical junctures to prevent unauthorized API execution. The shared state graph is similar to the concept of an agentic data bus. This agentic bus is something I used in a previous initiative I was helping with in the legal services industry. Below you can see the architecture come business process diagram for an example real world scenario where a network of 'tamed' agents do the heavy lifting with little to no human interaction. 

<img width="1024" height="559" alt="image" src="https://github.com/user-attachments/assets/1ad976e4-6c92-4017-a733-d6d37d731491" />


```mermaid
graph TD
    Start((Start)) --> Triage["📥 Triage Agent: Extracts Parameters"]
    Triage --> Policy["🏛️ Policy Agent: Hardcodes Limits"]
    Policy --> Inventory["🔎 Inventory Agent: Fetches Flights"]
    Inventory --> Supervisor{"🚦 Supervisor Router\n(Deterministic Code)"}
    
    Supervisor -- "Cost > Budget" --> Approval["✋ Manager Approval Loop"]
    Supervisor -- "Cost <= Budget" --> Execution["💳 Execution Agent"]
    
    Approval -- "Approved" --> Execution
    Execution --> Finish((End))

    classDef pureCode fill:#f2f2f2,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5;
    class Supervisor pureCode;

