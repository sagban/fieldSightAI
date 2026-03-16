# FieldSight AI — Multi-Agent Asset Integrity Orchestrator

FieldSight AI automates FPSO asset inspection by orchestrating two specialized AI agents:

- **Agent 1 (Field Assistant)** — Gemini Live API with real-time voice + video. Guides the inspector through data collection, step by step.
- **Agent 2 (Integrity Engineer)** — Gemini generateContent with File Search + deterministic Python tools. Performs grounded engineering analysis with citations from API 510, ISO 4628, and DNV-RP-C101.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Inspector (Voice + Camera)                                      │
│       ↕ Audio/Video                                              │
│  Agent 1: Field Assistant (Gemini Live API, client-side)         │
│       │ function call: run_integrity_analysis(...)                │
│       ↓                                                          │
│  React Frontend ──POST /api/analyze──→ FastAPI Backend           │
│                                           │                      │
│                              Agent 2: Integrity Engineer         │
│                              (generateContent agentic loop)      │
│                                    ↕              ↕              │
│                          Python Math Tools   File Search Stores  │
│                          (corrosion rate,    (API 510, ISO 4628, │
│                           remaining life,    DNV-RP-C101, SOPs)  │
│                           mitigation)                            │
│       ↑                                                          │
│  Structured verdict ← JSON response with citations               │
│  Agent 1 reads verdict aloud to inspector                        │
└─────────────────────────────────────────────────────────────────┘
```

## Google Cloud Technologies

| Technology | Usage |
|---|---|
| Gemini Live API | Real-time multimodal voice + video interaction (Agent 1) |
| Gemini generateContent | Agentic loop with function calling (Agent 2) |
| Gemini File Search API | Managed RAG — auto-chunking, embedding, semantic search, citations |
| Gemini Embeddings (gemini-embedding-001) | Powers File Search indexing |
| Structured Output | JSON schema-compliant engineering verdicts |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- A [Gemini API key](https://aistudio.google.com/apikey)

### 1. Install dependencies

```bash
# Frontend
npm install

# Backend
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY
```

### 3. Seed the File Search store (one-time)

This uploads API 510, ISO 4628, DNV-RP-C101, and company SOP documents into a Gemini File Search store:

```bash
source backend/.venv/bin/activate
python -m backend.scripts.seed_stores
```

The store persists indefinitely — you only need to run this once.

### 4. Run the app

In two terminals:

```bash
# Terminal 1: Backend
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload

# Terminal 2: Frontend
npm run dev
```

Open http://localhost:3000, select an asset, and click **Start Inspection**.

## Demo Scenarios

| Scenario | Inputs | Expected Result |
|---|---|---|
| **Normal** | UT 14.2/13.5mm, pit 1.0mm, coat grade 2, no cracks | Category Normal — routine monitoring |
| **Category B** | UT 14.0/13.5mm, pit 3.5mm, coat grade 3, no cracks | Category B — pit fill + re-coat |
| **Category A** | UT 13.0/12.5mm, pit 2.0mm, coat grade 4, cracks | Category A — full-screen alert, immediate shutdown |

## How It Works

1. **Inspector selects an asset** from the validated dropdown (populated from backend registry).
2. **Agent 1 starts a Live session** — greets the inspector, confirms the asset, and guides data collection via voice.
3. **Inspector provides metrics** one at a time (UT thickness, pitting, coating, cracks). Agent 1 confirms each.
4. **Agent 1 summarizes and confirms** all data, then calls `run_integrity_analysis`.
5. **Backend invokes Agent 2** — a stateless `generateContent` agentic loop that:
   - Calls `get_design_basis()` and `get_historical_thickness()` (Python tools)
   - Calls `calculate_corrosion_rate()` and `calculate_remaining_life()` (deterministic math)
   - Queries File Search for relevant standard sections (auto-citations)
   - Calls `determine_mitigation()` for the prescribed action
   - Returns a structured JSON verdict
6. **Frontend displays the verdict** in the review queue. Category A triggers a full-screen blocking modal.
7. **Agent 1 reads the verdict** aloud to the inspector.
