from PIL import Image
import numpy as np
from pathlib import Path

src = Path("public/badges")
ids = [
    "night-owl",
    "early-bird",
    "fullstack-explorer",
    "language-master",
    "oss-contributor",
    "power-coder",
    "streak-king",
    "hundred-day",
    "thousand-commits",
    "tenk-lines",
]


def process(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    gray = (
        (np.abs(r - g) < 14)
        & (np.abs(g - b) < 14)
        & (np.abs(r - b) < 14)
        & (r > 35)
        & (r < 140)
    )
    flat_dark = (r < 35) & (g < 35) & (b < 35)
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    content = ~(gray | flat_dark) | (sat > 28)

    out = arr.copy()
    out[~content, 3] = 0
    near = (
        (np.abs(r - g) < 18)
        & (np.abs(g - b) < 18)
        & (r > 30)
        & (r < 150)
        & content
    )
    out[near, 3] = (out[near, 3].astype(np.float32) * 0.35).astype(np.uint8)

    alpha = out[:, :, 3]
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        return Image.fromarray(out)

    pad = 4
    x0, x1 = max(0, int(xs.min()) - pad), min(out.shape[1], int(xs.max()) + 1 + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(out.shape[0], int(ys.max()) + 1 + pad)
    cropped = out[y0:y1, x0:x1]

    ch, cw = cropped.shape[0], cropped.shape[1]
    side = max(ch, cw, 1)
    target = 192
    scale = target / side
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    badge = Image.fromarray(cropped).resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    canvas.paste(badge, ((target - nw) // 2, (target - nh) // 2), badge)
    return canvas


for bid in ids:
    p = src / f"{bid}.webp"
    if not p.exists():
        print("missing", bid)
        continue
    before = p.stat().st_size
    im = Image.open(p)
    out = process(im)
    out.save(p, "WEBP", quality=78, method=6)
    print(f"{bid}: {im.size} {before}B -> {out.size} {p.stat().st_size}B")

print("done")
