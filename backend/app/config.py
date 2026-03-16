import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FILE_SEARCH_STORE_NAME = os.getenv("FILE_SEARCH_STORE_NAME", "fieldsight-standards")

# Vertex AI (for Gemini Live API)
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
LIVE_MODEL = os.getenv("LIVE_MODEL", "gemini-live-2.5-flash-native-audio")
LIVE_SESSION_TIMEOUT_SECONDS = int(os.getenv("LIVE_SESSION_TIMEOUT_SECONDS", "180"))
