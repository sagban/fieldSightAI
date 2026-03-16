"""
Deterministic integrity engineering functions.
These are called by Agent 2 via function calling -- the agent decides the order.
No LLM math: every numerical result comes from these functions.
"""

from .assets import ASSET_REGISTRY, HISTORICAL_READINGS
from .standards import MITIGATION_TABLE, is_sour_service


def get_design_basis(asset_id: str) -> dict:
    """Return design specs for an asset (t_min, corrosion allowance, etc.)."""
    asset = ASSET_REGISTRY.get(asset_id)
    if not asset:
        return {"error": f"Asset '{asset_id}' not found in registry."}
    return {
        "asset_id": asset["asset_id"],
        "name": asset["name"],
        "component_type": asset["component_type"],
        "service_fluid": asset["service_fluid"],
        "t_min_mm": asset["t_min_mm"],
        "corrosion_allowance_mm": asset["corrosion_allowance_mm"],
        "design_pressure_bar": asset["design_pressure_bar"],
        "material": asset["material"],
        "year_installed": asset["year_installed"],
    }


def get_historical_thickness(asset_id: str) -> dict:
    """Return the most recent previous inspection readings for an asset."""
    hist = HISTORICAL_READINGS.get(asset_id)
    if not hist:
        return {"error": f"No historical readings for '{asset_id}'."}
    return dict(hist)


def calculate_corrosion_rate(t_prev: float, t_curr: float, delta_t: float) -> dict:
    """
    Compute short-term corrosion rate.
    t_prev: previous wall thickness (mm)
    t_curr: current wall thickness (mm)
    delta_t: time between measurements (years)
    Returns: corrosion rate in mm/year
    """
    if delta_t <= 0:
        return {"corrosion_rate_mm_per_year": 0.0, "note": "Invalid delta_t (<=0)."}
    rate = (t_prev - t_curr) / delta_t
    return {
        "corrosion_rate_mm_per_year": round(rate, 4),
        "wall_loss_mm": round(t_prev - t_curr, 2),
        "measurement_interval_years": delta_t,
    }


def calculate_remaining_life(t_curr: float, t_min: float, corrosion_rate: float) -> dict:
    """
    Compute remaining service life before wall reaches t_min.
    Returns years remaining (negative means already exceeded).
    """
    if corrosion_rate <= 0:
        return {
            "remaining_life_years": None,
            "status": "stable_or_gaining",
            "note": "Corrosion rate is zero or negative (wall gaining thickness).",
        }
    life = (t_curr - t_min) / corrosion_rate
    status = "exceeded" if life < 0 else ("critical" if life < 2 else "acceptable")
    return {
        "remaining_life_years": round(life, 2),
        "status": status,
        "t_curr_mm": t_curr,
        "t_min_mm": t_min,
        "corrosion_rate_mm_per_year": corrosion_rate,
    }


def determine_mitigation(defect_type: str, category: str, environment: str) -> dict:
    """
    Look up the prescribed mitigation action from standards tables.
    defect_type: one of wall_thinning, pitting, coating_failure, cracking, sour_service
    category: A, B, or C
    environment: service fluid string
    """
    defect_table = MITIGATION_TABLE.get(defect_type, {})
    entry = defect_table.get(category)

    if not entry:
        return {
            "action": "Routine monitoring. No specific mitigation required.",
            "urgency": "routine",
            "standard_reference": "API 510 Section 6 - General Inspection Requirements",
        }

    result = dict(entry)

    if is_sour_service(environment) and category != "A":
        sour_entry = MITIGATION_TABLE.get("sour_service", {}).get("B")
        if sour_entry:
            result["sour_service_modifier"] = sour_entry["action"]
            result["sour_service_reference"] = sour_entry["standard_reference"]

    return result


# ---------------------------------------------------------------------------
# Tool dispatcher: maps function name -> callable
# ---------------------------------------------------------------------------
TOOL_FUNCTIONS: dict[str, callable] = {
    "get_design_basis": get_design_basis,
    "get_historical_thickness": get_historical_thickness,
    "calculate_corrosion_rate": calculate_corrosion_rate,
    "calculate_remaining_life": calculate_remaining_life,
    "determine_mitigation": determine_mitigation,
}
