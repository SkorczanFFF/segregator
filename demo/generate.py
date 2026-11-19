"""Draws documents as phone photos, straightens them as the app does and writes their fields to a manifest.

uv run python generate.py       the demo's, into out/
uv run python generate.py eval  those the reading is measured on, into out/eval/

The same seed gives the same files, so the demo can be drawn again on any machine with the web app's packages
installed, which hold the typefaces.
"""

import json
import sys
from pathlib import Path

import cv2
import numpy as np

from documents import DOCUMENTS
from evaluation import EVALUATION
from photo import photograph

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
# The app's own straightening, so a demo document changes exactly as an uploaded one would.
sys.path.insert(0, str(HERE.parent / "preprocess"))
from document import straighten

SEED = 2026
QUALITY = 90
SETS = {"demo": (DOCUMENTS, OUT), "eval": (EVALUATION, OUT / "eval")}


def jpeg(image_rgb: np.ndarray) -> bytes:
    ok, data = cv2.imencode(".jpg", cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, QUALITY])
    if not ok:
        raise RuntimeError("JPEG encoding failed")
    return data.tobytes()


def main(name: str):
    documents, out = SETS[name]
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for index, document in enumerate(documents):
        rng = np.random.default_rng(SEED + index)
        photo = photograph(document.draw(rng), document.mm, document.ground, rng, document.turn, document.crease)
        raw = jpeg(photo)
        (out / f"{document.slug}.jpg").write_bytes(raw)
        straightened = straighten(cv2.cvtColor(photo, cv2.COLOR_RGB2BGR))
        entry = {
            "slug": document.slug,
            "fields": document.fields,
            "raw": {"file": f"{document.slug}.jpg"},
        }
        if straightened:
            processed = jpeg(cv2.cvtColor(straightened.image, cv2.COLOR_BGR2RGB))
            (out / f"{document.slug}.processed.jpg").write_bytes(processed)
            entry["processed"] = {"file": f"{document.slug}.processed.jpg", "change": straightened.change}
        manifest.append(entry)
        print(document.slug, straightened.change if straightened else "unchanged")
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "demo")
