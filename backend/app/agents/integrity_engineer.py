"""
Agent 2: Integrity Engineer

A stateless agent invoked via generateContent with an agentic loop.
Has access to:
  - Deterministic Python math tools (function calling)
  - Gemini File Search (standards + historical reports)

The backend runs the loop: call generateContent, execute any tool calls,
feed results back, repeat until a final verdict is returned.
"""

import json
import logging

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY, FILE_SEARCH_STORE_NAME
from ..integrity.engine import TOOL_FUNCTIONS

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"

SYSTEM_INSTRUCTION = """\
You are a Senior Integrity Engineer (API 510 / ISO 4628 / DNV-RP-C101 Certified).
You are performing an engineering review of a pressure vessel / tank / heat exchanger on an FPSO.

CRITICAL RULES:
- You MUST use the provided calculation tools for ALL math. NEVER compute numbers yourself.
- You MUST cite specific standard sections. Use File Search to find the relevant section text.
- Category A findings MUST include the word "IMMEDIATE" in the action field.
- Be precise with units (mm, mm/year, years, bar).

WORKFLOW (follow this order):
1. Call get_design_basis(asset_id) to retrieve the asset's design specifications.
2. Call get_historical_thickness(asset_id) to retrieve previous inspection readings.
3. Call calculate_corrosion_rate(t_prev, t_curr, delta_t) using the historical and current thickness.
4. Call calculate_remaining_life(t_curr, t_min, corrosion_rate) to assess time to failure.
5. Based on the defect type found (wall_thinning / pitting / coating_failure / cracking / sour_service),
   call determine_mitigation(defect_type, category, environment) to get the prescribed action.
6. Produce your final JSON verdict.

CATEGORY LOGIC:
- Category A (Critical): cracks detected, OR wall thickness below t_min, OR remaining life < 0 years
- Category B (Warning): pitting exceeds corrosion allowance, OR coating grade >= 4, OR sour service with significant pitting
- Category C (Monitor): coating grade 3, OR minor pitting in non-sour service
- Normal: all metrics within acceptable limits

OUTPUT: Return a JSON object with these fields:
{
  "category": "A" | "B" | "C" | "Normal",
  "verdict": "Plain-language engineering verdict",
  "action": "Prescribed maintenance action",
  "standard_cited": "Specific standard section reference",
  "corrosion_rate_mm_per_year": number,
  "remaining_life_years": number or null,
  "calculations": { ... summary of all calculations performed ... },
  "citations": ["List of standard sections cited"]
}
"""

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_design_basis",
        description="Retrieve design specifications (t_min, corrosion allowance, material, etc.) for an asset from the registry.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "asset_id": types.Schema(type=types.Type.STRING, description="Asset ID, e.g. SEP-001-V"),
            },
            required=["asset_id"],
        ),
    ),
    types.FunctionDeclaration(
        name="get_historical_thickness",
        description="Retrieve previous inspection thickness readings and dates for an asset.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "asset_id": types.Schema(type=types.Type.STRING, description="Asset ID"),
            },
            required=["asset_id"],
        ),
    ),
    types.FunctionDeclaration(
        name="calculate_corrosion_rate",
        description="Calculate corrosion rate in mm/year from previous and current thickness readings over a time interval.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "t_prev": types.Schema(type=types.Type.NUMBER, description="Previous wall thickness in mm"),
                "t_curr": types.Schema(type=types.Type.NUMBER, description="Current wall thickness in mm"),
                "delta_t": types.Schema(type=types.Type.NUMBER, description="Time between measurements in years"),
            },
            required=["t_prev", "t_curr", "delta_t"],
        ),
    ),
    types.FunctionDeclaration(
        name="calculate_remaining_life",
        description="Calculate remaining service life in years before wall thickness reaches t_min at the current corrosion rate.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "t_curr": types.Schema(type=types.Type.NUMBER, description="Current wall thickness in mm"),
                "t_min": types.Schema(type=types.Type.NUMBER, description="Minimum allowable thickness in mm"),
                "corrosion_rate": types.Schema(type=types.Type.NUMBER, description="Corrosion rate in mm/year"),
            },
            required=["t_curr", "t_min", "corrosion_rate"],
        ),
    ),
    types.FunctionDeclaration(
        name="determine_mitigation",
        description="Look up the prescribed mitigation action from API 510 / ISO 4628 / DNV standards tables.",
        parameters=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "defect_type": types.Schema(
                    type=types.Type.STRING,
                    description="One of: wall_thinning, pitting, coating_failure, cracking, sour_service",
                ),
                "category": types.Schema(type=types.Type.STRING, description="A, B, or C"),
                "environment": types.Schema(type=types.Type.STRING, description="Service fluid, e.g. 'Sour Crude (H2S)'"),
            },
            required=["defect_type", "category", "environment"],
        ),
    ),
]


def _resolve_file_search_store_name(client: genai.Client, name: str | None) -> str | None:
    """
    Resolve FILE_SEARCH_STORE_NAME to the API's store resource name.
    If name looks like a resource name (contains 'fileSearchStores/' or 'projects/'), return as-is.
    Otherwise treat as display_name and look up store.name from the list of stores.
    """
    if not name or not name.strip():
        return None
    name = name.strip()
    if "fileSearchStores/" in name or name.startswith("projects/"):
        return name
    try:
        for store in client.file_search_stores.list():
            if getattr(store, "display_name", None) == name:
                return store.name
        logger.warning("File Search store with display_name %r not found; File Search disabled", name)
        return None
    except Exception as e:
        logger.warning("Could not resolve File Search store %r: %s; File Search disabled", name, e)
        return None


def _build_tools(file_search_store_name: str | None) -> list[types.Tool]:
    """
    Build the tools array. The API returns 400 if we pass multiple Tool objects
    (one with function_declarations, one with file_search). Use a single Tool
    with both when File Search is enabled.
    """
    tool_kwargs: dict = {"function_declarations": TOOL_DECLARATIONS}
    if file_search_store_name:
        tool_kwargs["file_search"] = types.FileSearch(
            file_search_store_names=[file_search_store_name],
        )
    return [types.Tool(**tool_kwargs)]


def _execute_function_call(fc: types.FunctionCall) -> dict:
    """Dispatch a function call to the matching Python function."""
    fn = TOOL_FUNCTIONS.get(fc.name)
    if not fn:
        return {"error": f"Unknown function: {fc.name}"}
    try:
        return fn(**fc.args)
    except Exception as exc:
        logger.exception("Tool execution error for %s", fc.name)
        return {"error": str(exc)}


def _extract_function_calls(response) -> list[types.FunctionCall]:
    """Pull all FunctionCall parts out of a generateContent response."""
    calls = []
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if part.function_call:
                calls.append(part.function_call)
    return calls


async def run_integrity_analysis(inspection_data: dict) -> dict:
    """
    Run Agent 2 as an agentic loop:
    1. Format inspection data as a prompt
    2. Call generateContent with tools + File Search
    3. If function calls are returned, execute them and feed results back
    4. Repeat until a final text response is produced
    5. Parse and return the structured verdict
    """
    client = genai.Client(api_key=GEMINI_API_KEY)

    store_name = _resolve_file_search_store_name(client, FILE_SEARCH_STORE_NAME)
    tools = _build_tools(store_name)

    prompt = (
        f"Perform an integrity engineering analysis for the following inspection data:\n\n"
        f"Asset ID: {inspection_data.get('asset_id', 'UNKNOWN')}\n"
        f"Location: {inspection_data.get('location', 'UNKNOWN')}\n"
        f"Average Thickness: {inspection_data.get('avg_thickness', 'N/A')} mm\n"
        f"Minimum Thickness: {inspection_data.get('min_thickness', 'N/A')} mm\n"
        f"Maximum Pit Depth: {inspection_data.get('max_pit_depth', 'N/A')} mm\n"
        f"Coating Grade (ISO 4628): {inspection_data.get('coating_grade', 'N/A')}\n"
        f"Cracks Detected: {inspection_data.get('has_cracks', False)}\n"
        f"Service Fluid: {inspection_data.get('service_fluid', 'N/A')}\n\n"
        f"Follow your workflow: retrieve design basis, get historical data, "
        f"calculate corrosion rate and remaining life, search standards, "
        f"determine mitigation, and produce your final verdict."
    )

    contents: list = [types.Content(role="user", parts=[types.Part.from_text(text=prompt)])]
    max_iterations = 10

    for iteration in range(max_iterations):
        logger.info("Agent 2 iteration %d", iteration + 1)

        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                tools=tools,
            ),
        )

        function_calls = _extract_function_calls(response)

        if not function_calls:
            return _parse_final_response(response, inspection_data)

        contents.append(response.candidates[0].content)

        function_response_parts = []
        for fc in function_calls:
            logger.info("Agent 2 calling tool: %s(%s)", fc.name, fc.args)
            result = _execute_function_call(fc)
            logger.info("Agent 2 tool result: %s", result)
            function_response_parts.append(
                types.Part.from_function_response(
                    name=fc.name,
                    response=result,
                )
            )

        contents.append(types.Content(role="user", parts=function_response_parts))

    return {
        "category": "Normal",
        "verdict": "Analysis timed out after maximum iterations.",
        "action": "Manual review required.",
        "standard_cited": "N/A",
        "error": "max_iterations_reached",
    }


def _parse_final_response(response, inspection_data: dict) -> dict:
    """Extract the structured verdict from Agent 2's final text response."""
    text = ""
    for candidate in response.candidates:
        for part in candidate.content.parts:
            if part.text:
                text += part.text

    citations = []
    if response.candidates and response.candidates[0].grounding_metadata:
        gm = response.candidates[0].grounding_metadata
        if hasattr(gm, "grounding_chunks") and gm.grounding_chunks:
            for chunk in gm.grounding_chunks:
                if hasattr(chunk, "retrieved_context"):
                    ctx = chunk.retrieved_context
                    citations.append({
                        "title": getattr(ctx, "title", ""),
                        "uri": getattr(ctx, "uri", ""),
                    })

    try:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        verdict_data = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError):
        verdict_data = {
            "category": "Normal",
            "verdict": text.strip()[:500],
            "action": "Review agent output manually.",
            "standard_cited": "N/A",
        }

    verdict_data.setdefault("category", "Normal")
    verdict_data.setdefault("verdict", "No verdict produced.")
    verdict_data.setdefault("action", "No action prescribed.")
    verdict_data.setdefault("standard_cited", "N/A")

    if citations:
        verdict_data["citations"] = citations

    verdict_data["id"] = f"finding-{id(response) % 100000:05d}"
    verdict_data["timestamp"] = __import__("time").time() * 1000
    verdict_data["asset_id"] = inspection_data.get("asset_id", "UNKNOWN")
    verdict_data["location"] = inspection_data.get("location", "UNKNOWN")
    verdict_data["avg_thickness"] = inspection_data.get("avg_thickness", 0)
    verdict_data["min_thickness"] = inspection_data.get("min_thickness", 0)
    verdict_data["max_pit_depth"] = inspection_data.get("max_pit_depth", 0)
    verdict_data["coating_condition"] = f"Grade {inspection_data.get('coating_grade', 'N/A')}"
    verdict_data["has_cracks"] = inspection_data.get("has_cracks", False)
    verdict_data["service_fluid"] = inspection_data.get("service_fluid", "N/A")

    return verdict_data
