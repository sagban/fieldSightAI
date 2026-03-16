# FieldSight AI — Showcase Documentation

> An AI-orchestrated pipeline that transforms raw field data into actionable engineering prescriptions in real-time.

---

## Inspiration

Living and working in the energy capital of the world, I saw a recurring friction point in how we maintain the world’s most complex offshore assets. Currently, the integrity of these assets is hampered by a **4-5 days latency** between field observations and engineering decisions. Inspectors on an FPSO collect vital data, but the engineering brain that categorizes defects and prescribes repairs is often hundreds of miles away, leading to critical delays. In high-stakes environments like an FPSO, waiting days to categorize a structural defect is a critical safety risk. I was inspired to bridge this "integrity gap" by creating an AI-orchestrated pipeline that transforms raw field data into actionable engineering prescriptions in real-time.

---

## What It Does

FieldSight AI acts as an autonomous **"Engineering Reviewer."** It processes multimodal data (live voice and optional video) from inspectors, performs fitness-for-service calculations, and not only categorizes defects (A/B/C/Normal) but proactively prescribes specific mitigation steps—such as ultrasonic shear-wave testing, composite clamping, pit filling and re-coating, or chemical inhibitor adjustments—based on corporate SOPs and global regulatory standards (API 510, ISO 4628, DNV-RP-C101).

**Key capabilities:**
- **Voice-guided inspection** — A Field Assistant (Agent 1) greets inspectors, walks them through UT thickness, pitting, coating grade, and crack detection via natural conversation
- **Multi-agent handoff** — When all metrics are collected, Agent 1 calls the Integrity Engineer (Agent 2), which runs deterministic calculations and standards lookup
- **Structured verdicts** — Category A/B/C/Normal with verdict, prescribed action, standard citations, corrosion rate, and remaining life
- **Critical alerts** — Category A/B findings trigger full-screen alerts and toasts so inspectors never miss urgent findings
- **Asset-aware flow** — Inspectors select an asset (e.g., 1st Stage Separator, Produced Water Tank) from the Inspection page; the system auto-starts the Live session with full design context

---

## How We Built It

We architected a **Multi-Agent system** powered by the **Gemini Live API** for real-time voice interaction:

1. **Agent 1 (Field Assistant)** — Runs on Vertex AI via WebSocket. Uses the Gemini Live API (`gemini-live-2.5-flash-native-audio`) with the Zephyr voice. Collects inspection metrics step-by-step via voice, then calls `run_integrity_analysis` when all data is ready.

2. **Agent 2 (Integrity Engineer)** — Runs via Gemini `generateContent` with an agentic loop (`gemini-2.5-pro`). Uses **Function Calling** for all math and safety-critical logic:
   - `get_design_basis(asset_id)` — design specs from asset registry
   - `get_historical_thickness(asset_id)` — previous readings
   - `calculate_corrosion_rate(t_prev, t_curr, delta_t)` — mm/year
   - `calculate_remaining_life(t_curr, t_min, corrosion_rate)` — years remaining
   - `determine_mitigation(defect_type, category, environment)` — prescribed action from standards tables

3. **RAG Engine** — We implemented a **Gemini File Search** store indexing historical inspection reports and design standards:
   - API 510 (Pressure Vessel Inspection)
   - ISO 4628 (Coating Assessment)
   - DNV-RP-C101 (Corrosion Protection)
   - Company SOP (FPSO Inspection)

   The Integrity Engineer uses File Search for semantic retrieval and citations, ensuring verdicts are grounded in authoritative text.

4. **Tech Stack** — React 19 + Vite 6 frontend, FastAPI backend, WebSocket for real-time audio streaming. Deployed as a single Cloud Run service.

### Workflow
1. Receives inspection data from Agent 1 tool call
2. Calls `get_design_basis(asset_id)` → design specs
3. Calls `get_historical_thickness(asset_id)` → previous readings
4. Calls `calculate_corrosion_rate(t_prev, t_curr, delta_t)` → mm/year
5. Calls `calculate_remaining_life(t_curr, t_min, corrosion_rate)` → years
6. Calls `determine_mitigation(defect_type, category, environment)` → prescribed action
7. Uses File Search API for standard citations
8. Returns structured JSON verdict

**Category Logic:**
- **A (Critical):** cracks, thickness below t_min, or remaining life < 0
- **B (Warning):** pitting > corrosion allowance, coating grade ≥ 4, or sour service with significant pitting
- **C (Monitor):** coating grade 3 or minor pitting in non-sour service
- **Normal:** all metrics within limits

### Architecture (GCP)

FieldSight AI runs on **Google Cloud Platform**:

- **Cloud Run** — Single serverless service hosting the FastAPI backend + React SPA
- **Vertex AI** — Gemini Live API (Agent 1), generateContent (Agent 2), and File Search (RAG over standards)
- **Database (Cloud SQL)** — Inspection records, verdicts, audit trail
- **MAXIMO / SAP** — Enterprise Asset Management for asset registry, design basis, and historical readings


![FieldSight AI GCP Architecture](./docs/architecture-gcp.png)

See [docs/architecture-gcp.md](./docs/architecture-gcp.md) for the Mermaid source and [Technical Documentation](./TECHNICAL.md#1-gcp-architecture-diagram) for details.

---

## Challenges We Ran Into

The primary challenge was **ensuring engineering precision**. We solved this by separating "Generative AI" from "Determinism." We forced the AI to rely on **Function Calling** for all math and safety-critical thresholds—corrosion rate, remaining life, and mitigation lookup—preventing hallucinations while maintaining the fluidity of a natural, conversational interface. The Field Assistant never computes numbers; it delegates to the Integrity Engineer, which in turn delegates to deterministic Python functions.

---

## Accomplishments We're Proud Of

We successfully compressed a **120-hour manual review cycle** into a **~5-minute digital handshake**. By automating the transition from observation to prescribed mitigation, we have effectively turned a reactive documentation process into a proactive safety intervention system. Inspectors receive spoken verdicts and on-screen alerts in real time, with full citations to API 510, ISO 4628, and DNV standards.

---

## What We Learned

We learned that in industrial settings, **metadata is as important as the measurement**. By providing the AI with **service fluid data** (e.g., Sour Crude with H2S), we significantly improved the "Prescription Agent's" ability to distinguish between a routine repair and an emergency structural failure. The `determine_mitigation` function applies sour-service modifiers (e.g., SSC/HIC assessment per NACE MR0175) when the environment indicates H2S exposure, ensuring the right level of urgency for each defect type.

---

## What's Next for FieldSight AI

We are moving toward **Autonomous Defect Profiling** using computer vision to automatically calculate pit density and crack lengths from images. Furthermore, we are expanding our RAG engine to integrate live offshore operational data (pressure/temp sensors) to create a true **"Digital Twin"** of the FPSO's structural health.

---

## Quick Demo

| Scenario | Inputs | Expected Result |
|----------|--------|-----------------|
| **Normal** | UT 14.2/13.5 mm, pit 1.0 mm, coat grade 2, no cracks | Category Normal — routine monitoring |
| **Category B** | UT 14.0/13.5 mm, pit 3.5 mm, coat grade 3, no cracks | Category B — pit fill + re-coat within 60 days |
| **Category A** | UT 13.0/12.5 mm, pit 2.0 mm, coat grade 4, cracks | Category A — full-screen alert, immediate shutdown |
