"""
Gemini Live API over Vertex AI.

Proxies audio/text between a WebSocket and Vertex AI Live session.
Registers run_integrity_analysis as a server-side tool (Agent 2).
"""

import asyncio
import inspect
import json
import logging
from typing import Callable, Dict, Optional

from google import genai
from google.genai import types

from ..config import GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, LIVE_MODEL

logger = logging.getLogger(__name__)


def _convert_js_schema_to_python(params: Optional[Dict]) -> Optional[Dict]:
    """Convert frontend Type.OBJECT/Type.STRING etc. to JSON schema type strings."""
    if not params or not isinstance(params, dict):
        return params
    type_map = {"OBJECT": "object", "STRING": "string", "NUMBER": "number", "INTEGER": "integer", "BOOLEAN": "boolean"}
    out = dict(params)
    if "type" in out and isinstance(out["type"], str) and out["type"] in type_map:
        out["type"] = type_map[out["type"]].lower()
    if "properties" in out and isinstance(out["properties"], dict):
        out["properties"] = {
            k: _convert_js_schema_to_python(v) if isinstance(v, dict) else v
            for k, v in out["properties"].items()
        }
    return out


class GeminiLive:
    def __init__(
        self,
        project_id: str,
        location: str,
        model: str,
        input_sample_rate: int = 16000,
    ):
        self.project_id = project_id
        self.location = location
        self.model = model
        self.input_sample_rate = input_sample_rate
        self.client = genai.Client(vertexai=True, project=project_id, location=location)
        self.tool_mapping: Dict[str, Callable] = {}

        logger.info(
            "GeminiLive initialized: project=%s location=%s model=%s",
            project_id,
            location,
            model,
        )

    def register_tool(self, func: Callable):
        self.tool_mapping[func.__name__] = func
        return func

    async def start_session(
        self,
        audio_input_queue: asyncio.Queue,
        video_input_queue: asyncio.Queue,
        text_input_queue: asyncio.Queue,
        audio_output_callback: Callable,
        audio_interrupt_callback: Optional[Callable] = None,
        setup_config: Optional[Dict] = None,
    ):
        """
        Connect to Vertex AI Live and proxy queues/callbacks.
        Yields events (serverContent, tool_result, etc.) for the WebSocket to send to the client.
        """
        config_args: Dict = {
            "response_modalities": [types.Modality.AUDIO],
        }

        if setup_config:
            if "generation_config" in setup_config:
                gen_config = setup_config["generation_config"]
                if "response_modalities" in gen_config:
                    config_args["response_modalities"] = [
                        types.Modality(m) for m in gen_config["response_modalities"]
                    ]
                if "speech_config" in gen_config:
                    try:
                        voice_cfg = gen_config["speech_config"]["voice_config"]["prebuilt_voice_config"]
                        voice_name = voice_cfg["voice_name"]
                        config_args["speech_config"] = types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                            )
                        )
                    except (KeyError, TypeError):
                        pass

            if "system_instruction" in setup_config:
                try:
                    si = setup_config["system_instruction"]
                    if isinstance(si, str):
                        text = si
                    else:
                        text = si["parts"][0]["text"]
                    config_args["system_instruction"] = types.Content(parts=[types.Part(text=text)])
                except (KeyError, IndexError, TypeError):
                    pass

            if "proactivity" in setup_config:
                try:
                    proactive_audio = setup_config["proactivity"].get("proactive_audio", False)
                    config_args["proactivity"] = types.ProactivityConfig(proactive_audio=proactive_audio)
                except (AttributeError, TypeError):
                    pass

            if "tools" in setup_config:
                try:
                    tool_config = setup_config["tools"]
                    fds_raw = tool_config.get("function_declarations") or tool_config.get("functionDeclarations") or []
                    fds = []
                    for fd in fds_raw:
                        params = fd.get("parameters")
                        params = _convert_js_schema_to_python(params)
                        fds.append(
                            types.FunctionDeclaration(
                                name=fd.get("name"),
                                description=fd.get("description"),
                                parameters=params,
                            )
                        )
                    if fds:
                        config_args["tools"] = [types.Tool(function_declarations=fds)]
                except Exception as e:
                    logger.warning("Error parsing tools config: %s", e)

            if setup_config.get("output_audio_transcription"):
                config_args["output_audio_transcription"] = types.AudioTranscriptionConfig()
            if setup_config.get("input_audio_transcription"):
                config_args["input_audio_transcription"] = types.AudioTranscriptionConfig()

        config = types.LiveConnectConfig(**config_args)

        async with self.client.aio.live.connect(model=self.model, config=config) as session:
            event_queue: asyncio.Queue = asyncio.Queue()

            async def send_audio():
                try:
                    while True:
                        chunk = await audio_input_queue.get()
                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=chunk,
                                mime_type=f"audio/pcm;rate={self.input_sample_rate}",
                            )
                        )
                except asyncio.CancelledError:
                    pass

            async def send_video():
                try:
                    while True:
                        chunk = await video_input_queue.get()
                        await session.send_realtime_input(
                            video=types.Blob(data=chunk, mime_type="image/jpeg")
                        )
                except asyncio.CancelledError:
                    pass

            async def send_text():
                try:
                    while True:
                        text = await text_input_queue.get()
                        await session.send(input=text, end_of_turn=True)
                except asyncio.CancelledError:
                    pass

            async def receive_loop():
                try:
                    while True:
                        async for response in session.receive():
                            server_content = response.server_content
                            tool_call = response.tool_call

                            if server_content:
                                if server_content.model_turn:
                                    for part in server_content.model_turn.parts:
                                        if part.inline_data:
                                            data = part.inline_data.data
                                            if inspect.iscoroutinefunction(audio_output_callback):
                                                await audio_output_callback(data)
                                            else:
                                                audio_output_callback(data)

                                if server_content.input_transcription:
                                    await event_queue.put({
                                        "serverContent": {
                                            "inputTranscription": {
                                                "text": str(server_content.input_transcription.text or ""),
                                                "finished": True,
                                            }
                                        }
                                    })

                                if server_content.output_transcription:
                                    await event_queue.put({
                                        "serverContent": {
                                            "outputTranscription": {
                                                "text": str(server_content.output_transcription.text or ""),
                                                "finished": True,
                                            }
                                        }
                                    })

                                if server_content.turn_complete:
                                    await event_queue.put({"serverContent": {"turnComplete": True}})

                                if server_content.interrupted:
                                    await event_queue.put({"serverContent": {"interrupted": True}})
                                    if audio_interrupt_callback:
                                        if inspect.iscoroutinefunction(audio_interrupt_callback):
                                            await audio_interrupt_callback()
                                        else:
                                            audio_interrupt_callback()
                                    await event_queue.put({"type": "interrupted"})

                            if tool_call:
                                function_responses = []
                                client_tool_calls = []

                                for fc in tool_call.function_calls:
                                    func_name = fc.name
                                    args = fc.args or {}
                                    if not isinstance(args, dict):
                                        args = dict(args)

                                    if func_name in self.tool_mapping:
                                        try:
                                            tool_func = self.tool_mapping[func_name]
                                            if inspect.iscoroutinefunction(tool_func):
                                                result = await tool_func(**args)
                                            else:
                                                loop = asyncio.get_running_loop()
                                                result = await loop.run_in_executor(None, lambda f=tool_func, a=args: f(**a))
                                        except Exception as e:
                                            result = {"error": str(e), "category": "Normal"}

                                        function_responses.append(
                                            types.FunctionResponse(
                                                name=func_name,
                                                id=fc.id,
                                                response={"result": result},
                                            )
                                        )
                                        await event_queue.put({
                                            "type": "tool_result",
                                            "name": func_name,
                                            "args": args,
                                            "result": result,
                                        })
                                    else:
                                        client_tool_calls.append({
                                            "name": fc.name,
                                            "args": args,
                                            "id": fc.id,
                                        })

                                if client_tool_calls:
                                    await event_queue.put({
                                        "toolCall": {"functionCalls": client_tool_calls}
                                    })

                                if function_responses:
                                    await session.send_tool_response(function_responses=function_responses)

                except Exception as e:
                    await event_queue.put({"type": "error", "error": str(e)})
                finally:
                    await event_queue.put(None)

            send_audio_task = asyncio.create_task(send_audio())
            send_video_task = asyncio.create_task(send_video())
            send_text_task = asyncio.create_task(send_text())
            receive_task = asyncio.create_task(receive_loop())

            try:
                while True:
                    event = await event_queue.get()
                    if event is None:
                        break
                    yield event
            finally:
                send_audio_task.cancel()
                send_video_task.cancel()
                send_text_task.cancel()
                receive_task.cancel()
