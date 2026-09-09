from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
S92_ROOT = ROOT / "docs" / "technical-library" / "s92"
GENERAL_ROOT = ROOT / "docs" / "technical-library" / "general-public-sources"
OUTPUT = ROOT / "src" / "data" / "technical-library-index.json"
MAX_CHARS = 1_600
OVERLAP = 180


def clean_text(value: str) -> str:
    value = value.replace("\u00ad", "").replace("\x00", " ")
    value = re.sub(r"(?<=\w)-\s+(?=\w)", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def chunks(value: str) -> list[str]:
    result: list[str] = []
    cursor = 0
    while cursor < len(value):
        end = min(len(value), cursor + MAX_CHARS)
        if end < len(value):
            split = max(value.rfind(". ", cursor + 800, end), value.rfind("; ", cursor + 800, end))
            if split > cursor:
                end = split + 1
        part = value[cursor:end].strip()
        if len(part) >= 80:
            result.append(part)
        if end >= len(value):
            break
        cursor = max(cursor + 1, end - OVERLAP)
    return result


def load_documents() -> list[dict]:
    s92 = json.loads((S92_ROOT / "catalog.json").read_text(encoding="utf-8"))["documents"]
    general = json.loads((GENERAL_ROOT / "catalog.json").read_text(encoding="utf-8"))["documents"]
    documents: list[dict] = []
    for item in s92:
        documents.append(
            {
                "id": item["id"],
                "file": str(S92_ROOT / item["file"]),
                "library": "S-92A",
                "title": item["title"],
                "documentNumber": item["documentNumber"],
                "issuer": item["issuer"],
                "section": None,
                "model": "Sikorsky S-92A",
                "ata": item.get("ata", []),
                "sourceUrl": item["sourceUrl"],
                "statusNote": item.get("statusNote", ""),
            }
        )
    for index, item in enumerate(general, start=1):
        document = item["document"]
        number_match = re.search(r"FAA-H-\d+-\d+[A-Z]?", document)
        documents.append(
            {
                "id": f"faa-general-{index:02d}",
                "file": str(GENERAL_ROOT / item["file"]),
                "library": "FAA geral",
                "title": document,
                "documentNumber": number_match.group(0) if number_match else "FAA handbook",
                "issuer": "FAA",
                "section": item["section"],
                "model": None,
                "ata": [],
                "sourceUrl": item["sourceUrl"],
                "statusNote": "Referência conceitual geral; não substitui publicação específica da aeronave.",
            }
        )
    return documents


def main() -> None:
    documents = load_documents()
    indexed_documents: list[dict] = []
    indexed_chunks: list[dict] = []
    for document in documents:
        reader = PdfReader(document["file"])
        metadata = {key: value for key, value in document.items() if key != "file"}
        metadata["pages"] = len(reader.pages)
        indexed_documents.append(metadata)
        for page_number, page in enumerate(reader.pages, start=1):
            page_text = clean_text(page.extract_text() or "")
            for sequence, text in enumerate(chunks(page_text), start=1):
                indexed_chunks.append(
                    {
                        "id": f"{document['id']}-p{page_number}-c{sequence}",
                        "documentId": document["id"],
                        "page": page_number,
                        "text": text,
                    }
                )
        print(f"Indexed {document['id']}: {len(reader.pages)} pages", flush=True)
    payload = {
        "version": 1,
        "generatedAt": "2026-09-09",
        "documents": indexed_documents,
        "chunks": indexed_chunks,
        "stats": {
            "documents": len(indexed_documents),
            "pages": sum(document["pages"] for document in indexed_documents),
            "chunks": len(indexed_chunks),
        },
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size} bytes)", flush=True)


if __name__ == "__main__":
    main()
