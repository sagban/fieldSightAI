# FieldSight AI — Multi-Agent Asset Integrity Orchestrator

FieldSight AI automates FPSO asset inspection by orchestrating two specialized AI agents working together over voice.

**Documentation:** [Showcase](./SHOWCASE.md) | [Technical](./TECHNICAL.md)

- **Agent 1 (Field Assistant, Live)** — Gemini Live API (Vertex AI) with real-time voice. Runs on the backend and talks to the inspector through the browser. It:
  - Greets the inspector as soon as the session starts
  - Guides data collection (UT readings, pitting, coating, cracks)
  - Calls the Integrity Engineer when it has all the metrics
- **Agent 2 (Integrity Engineer)** — Gemini `generateContent` with File Search + deterministic Python tools. It:
  - Pulls design basis and historical data
  - Computes corrosion rate and remaining life using deterministic math
  - Looks up standards via File Search (API 510, ISO 4628, DNV-RP-C101, SOPs)
  - Returns a structured, cited engineering verdict

## Architecture

```
Inspector (browser: mic + audio out)
        │
        │ 1) Select asset in React UI
        │ 2) Click “Start inspection” → navigates to Agent view
        │
        ▼
React Frontend
  - Connects WebSocket to FastAPI: /api/live/ws?assetId=SEP-001-V
  - Streams PCM audio → backend
  - Plays streamed audio replies from Live
  - Shows a unified activity log:
      • Agent 1 turns (greetings, questions)
      • Tool calls (run_integrity_analysis args)
      • Agent 2 verdicts

        │  WebSocket (audio + JSON events)
        ▼
FastAPI Backend
  - GET /api/assets → asset registry for the dropdown
  - GET /api/live/ws → Gemini Live session (Vertex AI)
      • Builds system instruction + tools from selected asset
      • Registers run_integrity_analysis as a server-side tool

        │  Live tool call: run_integrity_analysis(...)
        ▼
Agent 2: Integrity Engineer
  - google.genai Client (Gemini API key)
  - generateContent agentic loop:
      • Tools: get_design_basis, get_historical_thickness,
               calculate_corrosion_rate, calculate_remaining_life,
               determine_mitigation
      • File Search: standards + company docs
  - Returns structured verdict JSON (+ citations)

        ▲
        │  JSON verdict (tool_result)
        │
Agent 1 reads verdict aloud and the UI shows the structured record
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
- A [Gemini API key](https://aistudio.google.com/apikey) for **Agent 2 + File Search**
- A Google Cloud project with Vertex AI enabled for **Gemini Live**
  - Use Application Default Credentials (`gcloud auth application-default login`)

### 1. Install dependencies

```bash
# One-shot install for frontend + backend
chmod +x scripts/install.sh
./scripts/install.sh
```

This installs:
- Frontend deps via `npm install`
- Backend virtualenv in `backend/.venv` with `pip install -r backend/requirements.txt`

### 2. Configure environment

```bash
cp .env.example .env.local
```

Then edit `.env.local` and set:

- `GEMINI_API_KEY` — API key for Agent 2 + File Search
- `GOOGLE_CLOUD_PROJECT` — your GCP project ID (for Vertex AI Live)
- `GOOGLE_CLOUD_LOCATION` — e.g. `us-central1`
- `FILE_SEARCH_STORE_NAME` — name or display name of your File Search store (from `seed_stores.py`)

### 3. Seed the File Search store (one-time, optional but recommended)

This uploads API 510, ISO 4628, DNV-RP-C101, and company SOP documents into a Gemini File Search store:

```bash
source backend/.venv/bin/activate
python -m backend.scripts.seed_stores
```

The store persists indefinitely — you only need to run this once (or when changing documents).

### 4. Run the app (local dev)

You can either use the helper script:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

or run backend + frontend manually:

```bash
# Terminal 1: Backend
source backend/.venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000

# Terminal 2: Frontend
npm run dev
```

Then open http://localhost:3000:

1. Go to **Inspection**.
2. Select an asset from the grid (e.g. `SEP-001-V`).
3. Click **Start Inspection** — this navigates to the Agent view and **auto-starts** the Live session for that asset.
4. Agent 1 will greet you and start the voice-guided flow.

### 5. One-click deploy to Cloud Run (optional)

To build the UI, bundle it into the backend image, and deploy a single Cloud Run service:

```bash
chmod +x scripts/deploy.gcp.sh
PROJECT_ID=your-gcp-project-id REGION=us-central1 SERVICE_NAME=fieldsight-ai ./scripts/deploy.gcp.sh
```

This will:
- Run `npm run build` and copy `dist/` into `backend/dist`
- Deploy `backend/` as a Cloud Run service named `fieldsight-ai`
- Serve the React SPA and APIs from the same Cloud Run URL

## Demo Scenarios

| Scenario | Inputs | Expected Result |
|---|---|---|
| **Normal** | UT 14.2/13.5mm, pit 1.0mm, coat grade 2, no cracks | Category Normal — routine monitoring |
| **Category B** | UT 14.0/13.5mm, pit 3.5mm, coat grade 3, no cracks | Category B — pit fill + re-coat |
| **Category A** | UT 13.0/12.5mm, pit 2.0mm, coat grade 4, cracks | Category A — full-screen alert, immediate shutdown |

## How It Works (End‑to‑End)

1. **Inspector selects an asset** from the Inspection page.
   - Assets come from a backend `ASSET_REGISTRY` (design pressure, `t_min_mm`, material, last inspection, etc.).
2. **Agent view auto-starts the Live session** for that asset.
   - Frontend opens `/api/live/ws?assetId=...`.
   - Backend builds the Live `setup_config` (system instruction, Zephyr voice, `run_integrity_analysis` tool).
3. **Agent 1 (Live) greets the inspector and collects metrics** via voice:
   - UT average and minimum thickness
   - Maximum pit depth
   - Coating grade (1–5)
   - Presence of cracks
4. **When all metrics are collected**, Agent 1 says a one-sentence handoff and calls `run_integrity_analysis` (server-side tool).
   - The UI shows:
     - `Tool call: run_integrity_analysis` with the arguments
     - `Running analysis (standards + calculations)` from Agent 2
5. **Backend invokes Agent 2 (Integrity Engineer)**:
   - `get_design_basis(asset_id)` → design `t_min_mm`, corrosion allowance, material
   - `get_historical_thickness(asset_id)` → previous readings + time delta
   - `calculate_corrosion_rate(t_prev, t_curr, delta_t)`
   - `calculate_remaining_life(t_curr, t_min, corrosion_rate)`
   - File Search over standards/SOPs for citations
   - `determine_mitigation(defect_type, category, environment)`
   - Returns a structured JSON verdict with:
     - `category` (A/B/C/Normal)
     - `verdict`, `action`, `standard_cited`
     - `corrosion_rate_mm_per_year`, `remaining_life_years`
     - `citations` from File Search
6. **Frontend displays the verdict + log entries**:
   - Fixed-height log panel at the top shows agent steps, tool call, and verdict timeline.
   - Verdict cards appear with category badges and actions (Category A styled as critical).
7. **Agent 1 reads the verdict aloud** to the inspector and returns to “Listening…” for the next location.
