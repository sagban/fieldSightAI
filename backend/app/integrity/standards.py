"""
Mitigation lookup tables derived from API 510, ISO 4628, and DNV-RP-C101.
Used by determine_mitigation() in engine.py.
"""

MITIGATION_TABLE: dict[str, dict[str, dict]] = {
    "wall_thinning": {
        "A": {
            "action": "IMMEDIATE: Replace shell section or de-rate vessel per API 510 Section 7.4",
            "urgency": "immediate",
            "standard_reference": "API 510 Section 7.4 - Repairs and Alterations",
        },
        "B": {
            "action": "Schedule weld overlay repair within 30 days per API 510 Section 7.3",
            "urgency": "30_days",
            "standard_reference": "API 510 Section 7.3 - Conditions for Continued Operation",
        },
    },
    "pitting": {
        "A": {
            "action": "IMMEDIATE: Grind and weld-repair pitted area. Full NDT re-inspection required.",
            "urgency": "immediate",
            "standard_reference": "API 510 Section 5.6.2.3 - Localized Corrosion",
        },
        "B": {
            "action": "Pit filling and spot re-coat within 60 days. Monitor pit growth rate.",
            "urgency": "60_days",
            "standard_reference": "API 510 Section 5.6.2.3 - Localized Corrosion",
        },
        "C": {
            "action": "Enhanced monitoring: 6-month UT scan interval on pitted areas.",
            "urgency": "6_months",
            "standard_reference": "API 510 Section 6.4 - Inspection Intervals",
        },
    },
    "coating_failure": {
        "B": {
            "action": "Full surface preparation and re-coat per ISO 4628 and DNV-RP-C101.",
            "urgency": "60_days",
            "standard_reference": "ISO 4628 / DNV-RP-C101 Section 6 - Coating Maintenance",
        },
        "C": {
            "action": "Spot re-coat degraded areas. Schedule full re-coat at next turnaround.",
            "urgency": "next_turnaround",
            "standard_reference": "ISO 4628 Section 4 - Assessment of Coating Degradation",
        },
    },
    "cracking": {
        "A": {
            "action": "IMMEDIATE SHUTDOWN. Full NDT mapping of crack extent. Repair per API 510 Section 7.4.",
            "urgency": "immediate",
            "standard_reference": "API 510 Section 7.4 - Repairs / ASME PCC-2 Article 4.1",
        },
    },
    "sour_service": {
        "B": {
            "action": "Enhanced monitoring for H2S-induced cracking. SSC/HIC assessment required.",
            "urgency": "30_days",
            "standard_reference": "NACE MR0175 / API 510 Section 5.5 - Service-Specific Concerns",
        },
    },
}

SOUR_SERVICE_KEYWORDS = ["h2s", "sour", "hydrogen sulfide"]


def is_sour_service(fluid: str) -> bool:
    return any(kw in fluid.lower() for kw in SOUR_SERVICE_KEYWORDS)
