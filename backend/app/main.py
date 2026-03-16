"""
FastAPI backend for FieldSight AI.
Routes:
  POST /api/analyze  -- run Agent 2 integrity analysis
  GET  /api/assets   -- list available assets for the inspector dropdown
  GET  /api/health   -- health check
"""

import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agents.integrity_engineer import run_integrity_analysis
from .integrity.assets import ASSET_REGISTRY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="FieldSight AI Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    asset_id: str
    location: str
    avg_thickness: float
    min_thickness: float
    max_pit_depth: float
    coating_grade: int
    has_cracks: bool
    service_fluid: str = ""


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "fieldsight-backend"}


@app.get("/api/assets")
async def list_assets():
    """Return the asset registry as a list for the frontend dropdown."""
    return list(ASSET_REGISTRY.values())


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Forward inspection data to Agent 2 (Integrity Engineer).
    The agent runs an agentic loop with deterministic tools + File Search,
    then returns a structured verdict.
    """
    if req.asset_id not in ASSET_REGISTRY:
        logger.warning("Unknown asset_id: %s (proceeding anyway)", req.asset_id)

    logger.info("Starting Agent 2 analysis for asset %s at %s", req.asset_id, req.location)

    try:
        verdict = await run_integrity_analysis(req.model_dump())
    except Exception as exc:
        logger.exception("Agent 2 analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc

    logger.info("Agent 2 verdict: category=%s", verdict.get("category"))
    return verdict
