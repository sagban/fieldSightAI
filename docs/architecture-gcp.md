# FieldSight AI — GCP Architecture Diagram

This diagram highlights the Google Cloud Platform (GCP) services used by FieldSight AI.

> **Note:** The demo uses in-memory data for simplicity. The architecture below reflects the production design with database and MAXIMO/SAP integration.

![FieldSight AI GCP Architecture](./architecture-gcp.png)

> **Tip:** The Mermaid source below can be rendered in [Mermaid Live Editor](https://mermaid.live), GitHub, or any Markdown viewer that supports Mermaid.

```mermaid
flowchart TB
    subgraph User["👤 Inspector"]
        Browser["Browser<br/>(Mic + Audio Out)"]
    end

    subgraph GCP["☁️ Google Cloud Platform"]
        subgraph CloudRun["🟢 Cloud Run"]
            FastAPI["FastAPI Backend<br/>• /api/assets<br/>• /api/live/ws<br/>• Tool handler"]
            Integrity["Integrity Engine<br/>• get_design_basis<br/>• calculate_corrosion_rate<br/>• determine_mitigation"]
        end

        subgraph VertexAI["🟢 Vertex AI"]
            LiveAPI["Gemini Live API<br/>(Agent 1: Field Assistant)<br/>• Real-time voice I/O<br/>• Zephyr voice<br/>• run_integrity_analysis tool"]
            Agent2["generateContent<br/>(Agent 2: Integrity Engineer)<br/>• Function calling<br/>• Agentic loop"]
            FileSearch["File Search<br/>(RAG)<br/>• API 510, ISO 4628<br/>• DNV-RP-C101, SOP"]
        end

        subgraph Database["🟢 Database Layer"]
            CloudSQL["Cloud SQL<br/>• Inspection records<br/>• Verdicts & findings<br/>• Audit trail"]
        end
    end

    subgraph EAM["Enterprise Asset Management"]
        Maximo["MAXIMO / SAP<br/>• Asset registry<br/>• Design basis<br/>• Historical readings"]
    end

    Browser <-->|"WebSocket<br/>(PCM audio)"| FastAPI
    FastAPI <-->|"Live Connect<br/>(Vertex AI)"| LiveAPI
    FastAPI -->|"Tool call:<br/>run_integrity_analysis"| Agent2
    Agent2 <-->|"Semantic search<br/>+ citations"| FileSearch
    Agent2 -->|"Function calls"| Integrity
    Agent2 -->|"Verdict JSON"| FastAPI
    FastAPI <-->|"Read/Write"| CloudSQL
    FastAPI <-->|"Asset data<br/>Design basis<br/>History"| Maximo
```

## GCP Services Summary

| GCP Service | Purpose |
|-------------|---------|
| **Cloud Run** | Hosts the FastAPI backend + React SPA as a single serverless service |
| **Vertex AI** | Gemini Live API (Agent 1), generateContent (Agent 2), and File Search (RAG); uses Application Default Credentials |
| **Cloud SQL / Firestore** | Persists inspection records, verdicts, and audit trail (architecture; demo uses in-memory) |

## External Integrations

| System | Purpose |
|--------|---------|
| **MAXIMO / SAP** | Enterprise Asset Management (EAM) — asset registry, design basis, historical thickness readings (architecture; demo uses in-memory `ASSET_REGISTRY`) |

## Data Flow

1. **Inspector** → Browser captures mic audio (16 kHz PCM) → WebSocket to backend
2. **FastAPI** (Cloud Run) → Proxies to **Vertex AI** Gemini Live → Agent 1 speaks and listens
3. **Agent 1** calls `run_integrity_analysis` → **FastAPI** invokes **Agent 2** (Vertex AI)
4. **Agent 2** → Calls integrity tools (Python) + File Search (RAG) → Returns verdict
5. **FastAPI** (Cloud Run) → Fetches asset data (design basis, history) from **MAXIMO/SAP**
6. **FastAPI** → Persists verdicts and inspection records to **Database**
7. **Verdict** → Back to Agent 1 → Spoken aloud + displayed in UI
