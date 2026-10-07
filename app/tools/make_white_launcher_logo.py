"""Create white-background / transparent-foreground launcher logos."""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img" / "logo_riceguardianai.png"
OUT_FG = ROOT / "img" / "logo_launcher_foreground.png"
OUT_FULL = ROOT / "img" / "logo_launcher_white.png"


def is_bg(r: int, g: int, b: int, a: int) -> bool:
    # Near-black opaque pixels treated as canvas background.
    return a > 0 and r < 28 and g < 28 and b < 28


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    px = img.load()

    visited = [[False] * h for _ in range(w)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not visited[x][y]:
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a):
                visited[x][y] = True
                q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            try_push(nx, ny)

    img.save(OUT_FG)
    print(f"foreground -> {OUT_FG}")

    white = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    white.alpha_composite(img)
    white.convert("RGB").save(OUT_FULL)
    print(f"white -> {OUT_FULL}")


if __name__ == "__main__":
    main()
