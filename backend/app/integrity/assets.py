"""
Central asset registry -- single source of truth for both the frontend dropdown
and Agent 2's get_design_basis / get_historical_thickness tools.
"""

ASSET_REGISTRY: dict[str, dict] = {
    "SEP-001-V": {
        "asset_id": "SEP-001-V",
        "name": "1st Stage Separator",
        "component_type": "Pressure Vessel Shell",
        "location": "Topside Module 3, Deck A",
        "service_fluid": "Sour Crude (H2S)",
        "design_pressure_bar": 15.0,
        "design_temp_c": 85.0,
        "t_min_mm": 13.0,
        "corrosion_allowance_mm": 3.0,
        "material": "SA-516 Gr.70",
        "year_installed": 2018,
        "last_inspection": "2025-01-15",
    },
    "TK-02": {
        "asset_id": "TK-02",
        "name": "Produced Water Storage Tank",
        "component_type": "Atmospheric Storage Tank",
        "location": "Hull Compartment 7, Port Side",
        "service_fluid": "Produced Water",
        "design_pressure_bar": 1.0,
        "design_temp_c": 60.0,
        "t_min_mm": 14.0,
        "corrosion_allowance_mm": 2.5,
        "material": "SA-283 Gr.C",
        "year_installed": 2016,
        "last_inspection": "2024-11-20",
    },
    "HX-003": {
        "asset_id": "HX-003",
        "name": "Gas/Gas Heat Exchanger",
        "component_type": "Shell & Tube Heat Exchanger",
        "location": "Topside Module 2, Deck B",
        "service_fluid": "High Pressure Gas",
        "design_pressure_bar": 25.0,
        "design_temp_c": 120.0,
        "t_min_mm": 10.0,
        "corrosion_allowance_mm": 2.0,
        "material": "SA-516 Gr.70",
        "year_installed": 2019,
        "last_inspection": "2025-03-10",
    },
}

HISTORICAL_READINGS: dict[str, dict] = {
    "SEP-001-V": {
        "previous_thickness_mm": 14.0,
        "previous_date": "2025-01-15",
        "previous_pit_depth_mm": 1.5,
        "previous_coating_grade": 2,
        "delta_years": 1.2,
    },
    "TK-02": {
        "previous_thickness_mm": 15.2,
        "previous_date": "2024-11-20",
        "previous_pit_depth_mm": 0.5,
        "previous_coating_grade": 1,
        "delta_years": 1.5,
    },
    "HX-003": {
        "previous_thickness_mm": 11.5,
        "previous_date": "2025-03-10",
        "previous_pit_depth_mm": 1.0,
        "previous_coating_grade": 2,
        "delta_years": 1.0,
    },
}
