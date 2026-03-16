import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env.local'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
FILE_SEARCH_STORE_NAME = os.getenv("FILE_SEARCH_STORE_NAME", "fieldsight-standards")
