"""Prepare only public runtime files and resized icons for Pages or browser tests."""
from pathlib import Path
import shutil
import sys
from PIL import Image

target = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
target.mkdir(parents=True, exist_ok=True)
for filename in ("index.html", "style.css", "app.js", "timer.js", "history.js", "manifest.webmanifest", ".nojekyll"):
    shutil.copy2(filename, target / filename)
assets = target / "assets"
assets.mkdir(exist_ok=True)
# Preserve the user's originals in Git; derive web icons at build time.
with Image.open("assets/icon512.png") as image:
    image = image.convert("RGBA")
    if image.width != image.height:
        raise ValueError("The application icon must be square")
    for filename, size in (("favicon.png", 32), ("apple-touch-icon.png", 180),
                           ("icon-192.png", 192), ("icon-512.png", 512)):
        image.resize((size, size), Image.Resampling.LANCZOS).save(assets / filename, optimize=True)
print(f"Prepared static site: {target}")
