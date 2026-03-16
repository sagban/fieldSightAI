"""
Thin wrapper around the google-genai File Search Store API.
Handles idempotent store creation, document upload, and listing.
"""

import time
from pathlib import Path
from google import genai


def create_or_get_store(client: genai.Client, display_name: str):
    """Return the existing store with this display_name, or create a new one."""
    for store in client.file_search_stores.list():
        if store.display_name == display_name:
            return store
    return client.file_search_stores.create(config={"display_name": display_name})


def upload_and_wait(
    client: genai.Client,
    store_name: str,
    file_path: str,
    poll_interval: float = 3.0,
):
    """Upload a file to a File Search store and block until indexing completes."""
    operation = client.file_search_stores.upload_to_file_search_store(
        file=file_path,
        file_search_store_name=store_name,
        config={"display_name": Path(file_path).name},
    )

    while not operation.done:
        time.sleep(poll_interval)
        operation = client.operations.get(operation)

    return operation


def list_documents(client: genai.Client, store_name: str) -> list[dict]:
    """List all documents in a File Search store."""
    docs = []
    for doc in client.file_search_stores.documents.list(parent=store_name):
        docs.append({"name": doc.name, "display_name": getattr(doc, "display_name", "")})
    return docs
