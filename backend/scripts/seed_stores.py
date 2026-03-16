"""
One-time script to create the File Search store and upload standard documents.

Usage:
    python -m backend.scripts.seed_stores

Run from the project root (fieldsightai/).
The store persists indefinitely -- only run this once per API key.
"""

import os
import sys
import time
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

load_dotenv(project_root / ".env.local")
load_dotenv(project_root / ".env")

from google import genai
from backend.app.rag.store_manager import create_or_get_store, upload_and_wait, list_documents

STORE_DISPLAY_NAME = os.getenv("FILE_SEARCH_STORE_NAME", "fieldsight-standards")
STANDARDS_DIR = Path(__file__).resolve().parent.parent / "data" / "standards"


def main():
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set. Add it to .env.local or .env")
        sys.exit(1)

    client = genai.Client(api_key=api_key)

    print(f"Creating/finding store: {STORE_DISPLAY_NAME}")
    store = create_or_get_store(client, STORE_DISPLAY_NAME)
    print(f"  Store: {store.name}")

    existing = {d["display_name"] for d in list_documents(client, store.name)}
    print(f"  Already indexed: {existing or '(none)'}")

    files = sorted(STANDARDS_DIR.glob("*.txt"))
    if not files:
        print(f"No .txt files found in {STANDARDS_DIR}")
        sys.exit(1)

    max_retries = 3
    for filepath in files:
        if filepath.name in existing:
            print(f"Skipping (already indexed): {filepath.name}")
            continue

        print(f"Uploading: {filepath.name}")
        for attempt in range(1, max_retries + 1):
            try:
                upload_and_wait(client, store.name, str(filepath))
                print(f"  Indexed successfully.")
                break
            except Exception as exc:
                print(f"  Attempt {attempt}/{max_retries} failed: {exc}")
                if attempt < max_retries:
                    wait = 15 * attempt
                    print(f"  Retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"  FAILED after {max_retries} attempts.")

    print("\nDone. File Search store is ready.")


if __name__ == "__main__":
    main()
