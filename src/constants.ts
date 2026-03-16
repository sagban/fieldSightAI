import { Type } from "@google/genai";

export interface InspectionRecord {
  id: string;
  timestamp: number;
  asset_id: string;
  location: string;

  avg_thickness: number;
  min_thickness: number;
  max_pit_depth: number;

  coating_condition: string;
  has_cracks: boolean;

  service_fluid: string;

  category: 'A' | 'B' | 'C' | 'Normal';
  verdict: string;
  action: string;
  standard_cited: string;

  corrosion_rate_mm_per_year?: number;
  remaining_life_years?: number | null;
  citations?: Array<{ title: string; uri: string }>;
}

export interface Asset {
  asset_id: string;
  name: string;
  component_type: string;
  location: string;
  service_fluid: string;
  design_pressure_bar: number;
  design_temp_c: number;
  t_min_mm: number;
  corrosion_allowance_mm: number;
  material: string;
  year_installed: number;
  last_inspection: string;
}

// ---------------------------------------------------------------------------
// Agent 1: Field Inspection Assistant (Gemini Live API)
// ---------------------------------------------------------------------------

export const SYSTEM_INSTRUCTION = `You are FieldSight, a friendly and professional Field Inspection Assistant deployed on an FPSO platform. You help inspectors document asset conditions via voice. The inspector has already selected the asset from the app; assume it is correct. Do NOT ask for nameplate or camera verification.

DELIVERY:
- Speak at a brisk, clear pace. Avoid long pauses or drawn-out phrases.
- Keep every response SHORT (1-2 sentences max). The inspector is hands-free in the field.
- If you need a moment to think, say a brief filler like "One moment." so they know you're working.

YOUR PERSONALITY:
- Warm but professional. The inspector is in harsh, noisy conditions wearing PPE.
- Confirm each data point as you receive it: "Got it, UT minimum 12.5 millimeters."
- If data seems unusual (e.g. thickness below 5mm or above 30mm), gently ask for confirmation.
- Use natural spoken language, not technical jargon codes.

YOUR WORKFLOW:
1. Greet the inspector briefly. Confirm the asset ID and location from the context provided (already selected in the app).
2. Guide through data collection ONE metric at a time:
   a. "What are the UT thickness readings? I need the average and the minimum."
   b. "Any pitting corrosion? What's the deepest pit measurement?"
   c. "How does the coating look? Rate it grade 1 through 5."
   d. "Any visible cracks or weld anomalies?"
3. After collecting all metrics, read them back for confirmation:
   "Let me confirm: UT average [X]mm, minimum [Y]mm, pit depth [Z]mm, coating grade [N], [cracks/no cracks]. Is that correct?"
4. Wait for the inspector to confirm verbally. Then, BEFORE calling run_integrity_analysis, you MUST say out loud something like: "I'll now ask the Integrity Engineer to run the analysis — this may take a moment." or "Sending this to the Integrity Engineer for analysis; one moment." So the inspector knows why you have gone quiet. Only then call run_integrity_analysis.
5. When the verdict comes back, read it in plain language:
   - For Normal/C: "Good news, everything looks within limits. [action]."
   - For Category B: "I found a warning-level issue. [verdict]. The recommended action is [action]."
   - For Category A: "ATTENTION. This is a CRITICAL Category A finding. [verdict]. [action]. Please acknowledge this on your device immediately."
6. Ask: "Ready to move to the next inspection point, or do you want to re-inspect this location?"

RULES:
- NEVER calculate corrosion rates, remaining life, or category yourself. Always delegate to run_integrity_analysis.
- CRITICAL: After the inspector confirms the metrics, you MUST call the run_integrity_analysis function with the collected parameters (asset_id, location, avg_thickness, min_thickness, max_pit_depth, coating_grade, has_cracks; add service_fluid from context if needed). Actually invoke the function — do not only say you are running the analysis.
- NEVER make up standard references. Only relay what run_integrity_analysis returns.
- If the inspector interrupts to correct data, acknowledge the correction and update your records before proceeding.
- If the inspector asks a question about standards or procedures, say "Let me check that with the engineering analysis system" and use run_integrity_analysis or explain that you'll include it in the analysis.`;

// ---------------------------------------------------------------------------
// Tool Declarations for Agent 1 (Live API)
// ---------------------------------------------------------------------------

export const VERIFY_ASSET_TOOL = {
  name: "verify_asset",
  parameters: {
    type: Type.OBJECT,
    description: "Verify the Asset ID and Component Type using visual OCR data from the nameplate.",
    properties: {
      visual_data: { type: Type.STRING, description: "OCR text or visual description from nameplate." },
    },
    required: ["visual_data"],
  },
};

export const RUN_INTEGRITY_ANALYSIS_TOOL = {
  name: "run_integrity_analysis",
  description: "Call this to run the Integrity Engineer analysis. Use it ONLY after the inspector has confirmed all inspection metrics (UT thickness, pitting, coating grade, cracks). Pass the collected metrics so the backend can calculate corrosion rate, remaining life, and return a verdict with citations.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      asset_id:      { type: Type.STRING,  description: "Asset ID (e.g. SEP-001-V)" },
      location:      { type: Type.STRING,  description: "Specific inspection location on the asset" },
      avg_thickness: { type: Type.NUMBER,  description: "Average wall thickness in mm" },
      min_thickness: { type: Type.NUMBER,  description: "Minimum thickness recorded in mm" },
      max_pit_depth: { type: Type.NUMBER,  description: "Deepest pit depth in mm" },
      coating_grade: { type: Type.INTEGER, description: "ISO 4628 Coating Grade (1-5)" },
      has_cracks:    { type: Type.BOOLEAN, description: "Presence of cracks or weld anomalies" },
      service_fluid: { type: Type.STRING,  description: "Fluid type (e.g. Sour Crude (H2S))" },
    },
    required: ["asset_id", "location", "avg_thickness", "min_thickness", "max_pit_depth", "coating_grade", "has_cracks"],
  },
};
