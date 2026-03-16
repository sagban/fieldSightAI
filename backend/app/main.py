"""
FastAPI backend for FieldSight AI.
Routes:
  GET  /api/assets    -- list available assets for the inspector dropdown
  GET  /api/health    -- health check
  GET  /api/live/ws   -- WebSocket for Gemini Live (Vertex AI); query param: assetId
"""

import asyncio
import base64
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .agents.integrity_engineer import run_integrity_analysis
from .config import (
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    LIVE_MODEL,
    LIVE_SESSION_TIMEOUT_SECONDS,
)
from .integrity.assets import ASSET_REGISTRY
from .live import GeminiLive
from .live.prompts import build_setup_config
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "fieldsight-backend"}


@app.get("/api/assets")
async def list_assets():
    """Return the asset registry as a list for the frontend dropdown."""
    return list(ASSET_REGISTRY.values())


async def _run_integrity_analysis_tool(**kwargs):
    """
    Tool handler for Agent 1 (Live): when the Field Assistant calls run_integrity_analysis,
    we invoke Agent 2 (Integrity Engineer) — a separate Gemini model with generateContent,
    tools (get_design_basis, calculate_corrosion_rate, etc.), and File Search. This is not
    a simple function: it runs the full Integrity Engineer agentic loop and returns the verdict.
    """
    logger.info("Agent 1 requested run_integrity_analysis; invoking Agent 2 (Integrity Engineer)")
    try:
        result = await run_integrity_analysis(kwargs)
        logger.info("Agent 2 (Integrity Engineer) returned verdict: category=%s", result.get("category"))
        return result
    except Exception as e:
        logger.exception("Agent 2 (Integrity Engineer) failed")
        return {"error": str(e), "category": "Normal", "verdict": "Analysis failed.", "action": "Please try again or record manually."}


_run_integrity_analysis_tool.__name__ = "run_integrity_analysis"


@app.websocket("/api/live/ws")
async def websocket_live(websocket: WebSocket, assetId: str = ""):
    """
    WebSocket endpoint for Gemini Live (Vertex AI).
    Query param: assetId (required) — the asset chosen by the user to start inspection.
    Client sends only binary PCM audio; server sends binary audio and JSON events.
    Setup (system instruction, voice, tools) is built on the backend from assetId.
    """
    await websocket.accept()

    if not GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT.strip() == "":
        logger.warning("GOOGLE_CLOUD_PROJECT not set; rejecting Live WebSocket")
        await websocket.close(code=4500, reason="GOOGLE_CLOUD_PROJECT not configured. Set it in .env and restart.")
        return

    if not assetId or assetId not in ASSET_REGISTRY:
        logger.warning("Invalid or missing assetId: %s", assetId)
        await websocket.close(code=4000, reason="Missing or invalid assetId query parameter")
        return

    asset = ASSET_REGISTRY[assetId]
    setup_config = build_setup_config(asset)
    logger.info("Live session for assetId=%s", assetId)

    audio_input_queue: asyncio.Queue = asyncio.Queue()
    video_input_queue: asyncio.Queue = asyncio.Queue()
    text_input_queue: asyncio.Queue = asyncio.Queue()

    async def audio_output_callback(data: bytes):
        await websocket.send_bytes(data)

    async def audio_interrupt_callback():
        pass

    gemini_client = GeminiLive(
        project_id=GOOGLE_CLOUD_PROJECT,
        location=GOOGLE_CLOUD_LOCATION,
        model=LIVE_MODEL,
        input_sample_rate=16000,
    )
    gemini_client.register_tool(_run_integrity_analysis_tool)

    async def receive_from_client():
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    await audio_input_queue.put(message["bytes"])
                elif "text" in message and message["text"]:
                    try:
                        payload = json.loads(message["text"])
                        if isinstance(payload, dict) and payload.get("type") == "image":
                            image_data = base64.b64decode(payload["data"])
                            await video_input_queue.put(image_data)
                            continue
                    except json.JSONDecodeError:
                        pass
                    await text_input_queue.put(message["text"])
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected (client closed)")
        except Exception as e:
            logger.error("Error receiving from client: %s", e)

    receive_task = asyncio.create_task(receive_from_client())

    async def run_session():
        logger.info("Connecting to Vertex AI Live (model=%s)...", LIVE_MODEL)
        async for event in gemini_client.start_session(
            audio_input_queue=audio_input_queue,
            video_input_queue=video_input_queue,
            text_input_queue=text_input_queue,
            audio_output_callback=audio_output_callback,
            audio_interrupt_callback=audio_interrupt_callback,
            setup_config=setup_config,
        ):
            if event:
                await websocket.send_json(event)

    try:
        await asyncio.wait_for(run_session(), timeout=LIVE_SESSION_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.info("Live session time limit reached")
        await websocket.close(code=1000, reason="Session time limit reached")
    except Exception as e:
        err_msg = str(e)
        logger.exception("Live session error: %s", err_msg)
        try:
            await websocket.close(code=1011, reason=err_msg[:123] if len(err_msg) > 123 else err_msg)
        except Exception:
            pass
    finally:
        receive_task.cancel()
        try:
            await receive_task
        except asyncio.CancelledError:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
