"""
Agent 1 (Field Assistant) system instruction and tool declaration for Gemini Live.
Built on the backend from assetId; frontend only sends audio.
"""

AGENT1_SYSTEM_INSTRUCTION_BASE = """You are FieldSight, a friendly and professional Field Inspection Assistant deployed on an FPSO platform. You help inspectors document asset conditions via voice. The inspector has already selected the asset from the app; assume it is correct. Do NOT ask for nameplate or camera verification.

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
1. As soon as the session starts, YOU speak first. Welcome the inspector: greet them briefly and confirm the asset and location from the context (e.g. "Hi, I'm FieldSight. You're inspecting [asset name] at [location]. Ready when you are — I'll guide you through the metrics."). Do not wait for the inspector to speak; you initiate the conversation.
2. Guide through data collection ONE metric at a time:
   a. "What are the UT thickness readings? I need the average and the minimum."
   b. "Any pitting corrosion? What's the deepest pit measurement?"
   c. "How does the coating look? Rate it grade 1 through 5."
   d. "Any visible cracks or weld anomalies?"
3. After collecting all metrics, do NOT read them back. Instead say you have everything and that you're handing off to the Integrity Engineer, then call run_integrity_analysis. For example: "I've received all the information. Let me ask the Integrity Engineer to run the analysis." or "Got it, I have everything. Sending this to the Integrity Engineer for analysis now." This one sentence is REQUIRED before every run_integrity_analysis call so the inspector knows you are transferring the case.
4. When the verdict comes back, read it in plain language:
   - For Normal/C: "Good news, everything looks within limits. [action]."
   - For Category B: "I found a warning-level issue. [verdict]. The recommended action is [action]."
   - For Category A: "ATTENTION. This is a CRITICAL Category A finding. [verdict]. [action]. Please acknowledge this on your device immediately."
5. Ask: "Ready to move to the next inspection point, or do you want to re-inspect this location?"

RULES:
- When the inspection session begins, you MUST welcome the user first (greet and confirm asset/location). Do not wait for them to say anything — you speak first.
- NEVER calculate corrosion rates, remaining life, or category yourself. Always delegate to run_integrity_analysis.
- CRITICAL: Once you have all metrics (thickness, pitting, coating grade, cracks), say you've received the information and are sending to the Integrity Engineer (as in step 3), then call run_integrity_analysis with the collected parameters (asset_id, location, avg_thickness, min_thickness, max_pit_depth, coating_grade, has_cracks; add service_fluid from context if needed). That function invokes the Integrity Engineer (a second agent) on the backend; wait for the result.
- You MUST never call run_integrity_analysis silently. Every time you call it, first say a clear one-sentence handoff (e.g. "I've received all the information. Let me ask the Integrity Engineer to run the analysis."), then make the tool call.
- NEVER make up standard references. Only relay what run_integrity_analysis returns.
- If the inspector interrupts to correct data, acknowledge the correction and update your records before proceeding.
- If the inspector asks a question about standards or procedures, say "Let me check that with the engineering analysis system" and use run_integrity_analysis or explain that you'll include it in the analysis."""

# Tool declaration for Live API (JSON-schema style for setup_config)
RUN_INTEGRITY_ANALYSIS_TOOL = {
    "name": "run_integrity_analysis",
    "description": "Call this to run the Integrity Engineer analysis. Use it ONLY after you have collected all inspection metrics (UT thickness, pitting, coating grade, cracks). Pass the collected metrics so the backend can calculate corrosion rate, remaining life, and return a verdict with citations.",
    "parameters": {
        "type": "object",
        "properties": {
            "asset_id": {"type": "string", "description": "Asset ID (e.g. SEP-001-V)"},
            "location": {"type": "string", "description": "Specific inspection location on the asset"},
            "avg_thickness": {"type": "number", "description": "Average wall thickness in mm"},
            "min_thickness": {"type": "number", "description": "Minimum thickness recorded in mm"},
            "max_pit_depth": {"type": "number", "description": "Deepest pit depth in mm"},
            "coating_grade": {"type": "integer", "description": "ISO 4628 Coating Grade (1-5)"},
            "has_cracks": {"type": "boolean", "description": "Presence of cracks or weld anomalies"},
            "service_fluid": {"type": "string", "description": "Fluid type (e.g. Sour Crude (H2S))"},
        },
        "required": ["asset_id", "location", "avg_thickness", "min_thickness", "max_pit_depth", "coating_grade", "has_cracks"],
    },
}


def build_system_instruction(asset: dict) -> str:
    """Build full Agent 1 system instruction with CURRENT CONTEXT from asset."""
    context = (
        "\n\nCURRENT CONTEXT:\n"
        f"Asset ID: {asset.get('asset_id', '')}\n"
        f"Asset Name: {asset.get('name', '')}\n"
        f"Component: {asset.get('component_type', '')}\n"
        f"Service Fluid: {asset.get('service_fluid', '')}\n"
        f"Location: {asset.get('location', '')}\n"
        f"Material: {asset.get('material', '')}\n"
        f"Design Pressure: {asset.get('design_pressure_bar', '')} bar\n"
        f"Last Inspection: {asset.get('last_inspection', '')}"
    )
    return AGENT1_SYSTEM_INSTRUCTION_BASE + context


def build_setup_config(asset: dict) -> dict:
    """Build Live session setup_config from asset (system instruction, generation_config, tools)."""
    return {
        "system_instruction": build_system_instruction(asset),
        "generation_config": {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": "Zephyr"},
                }
            },
        },
        "tools": {
            "function_declarations": [RUN_INTEGRITY_ANALYSIS_TOOL],
        },
    }
