#!/usr/bin/env python3
"""Prepare public optimized image library for Cloudflare Pages. No R2 or DB changes."""
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
import json, os, sys, hashlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "media-public"
DEST = ROOT / "dist-free-media"
MAX_BYTES = 8 * 1024 * 1024
MAX_WIDTH = 1600
SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
DEST.mkdir(parents=True, exist_ok=True)
manifest = {"dryfit": [], "her": []}
total = 0
for store in ("dryfit", "her"):
    base = SOURCE / store
    for path in sorted(base.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.suffix.lower() not in SUFFIXES:
            sys.exit(f"Arquivo não permitido: {path.relative_to(SOURCE)}")
        if path.stat().st_size > MAX_BYTES:
            sys.exit(f"Arquivo acima de 8 MB: {path.relative_to(SOURCE)}")
        rel = path.relative_to(base)
        # Preserve directories but create a normalized public image path.
        output = (DEST / store / rel).with_suffix(".webp")
        output.parent.mkdir(parents=True, exist_ok=True)
        try:
            with Image.open(path) as im:
                im = ImageOps.exif_transpose(im)
                if getattr(im, "is_animated", False):
                    sys.exit(f"Animação não suportada: {path.relative_to(SOURCE)}")
                im.thumbnail((MAX_WIDTH, MAX_WIDTH))
                if im.mode not in ("RGB", "RGBA"):
                    im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
                im.save(output, "WEBP", quality=78, method=6)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            sys.exit(f"Imagem inválida: {path.relative_to(SOURCE)}: {exc}")
        total += 1
        manifest[store].append({"path": "/" + store + "/" + output.relative_to(DEST / store).as_posix(), "bytes": output.stat().st_size})
        if total > 10000:
            sys.exit("Limite operacional de 10.000 imagens atingido")
(DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
(DEST / "_headers").write_text("/*\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=86400\n")
(DEST / "index.html").write_text("<!doctype html><html lang='pt-br'><meta charset='utf-8'><title>MB Mídias</title><body><h1>Biblioteca pública de mídias MB</h1></body></html>")
print("Imagens preparadas:", total, "tamanho otimizado:", sum(x["bytes"] for val in manifest.values() for x in val), "bytes")
