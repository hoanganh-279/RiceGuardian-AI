"""Build splash assets: Android 12 icon + combined logo+title image."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img" / "logo_launcher_foreground.png"
LOGO_WHITE = ROOT / "img" / "logo_launcher_white.png"
OUT_A12 = ROOT / "img" / "splash_android12.png"
OUT_COMBINED = ROOT / "img" / "splash_with_title.png"

# Android 12 splash without icon background: 1152 canvas, 768px diameter circle.
CANVAS = 1152
SAFE_DIAMETER = 720  # stay inside 768 with margin

GRADIENT_START = (0x18, 0x86, 0x01)
GRADIENT_END = (0xFF, 0xA1, 0x00)
TITLE = "RICEGUARDIAN AI"


def _load_bold_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in ("arialbd.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/segoeuib.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_gradient_text(
    canvas: Image.Image,
    text: str,
    font: ImageFont.ImageFont,
    center_x: int,
    top_y: int,
) -> int:
    """Draw gradient title; returns bottom y of the text."""
    draw = ImageDraw.Draw(canvas)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = center_x - tw // 2
    ty = top_y - bbox[1]

    mask = Image.new("L", canvas.size, 0)
    ImageDraw.Draw(mask).text((tx, ty), text, font=font, fill=255)

    gradient = Image.new("RGBA", canvas.size)
    gpx = gradient.load()
    w = canvas.width
    for x in range(w):
        t = x / max(w - 1, 1)
        r = int(GRADIENT_START[0] + (GRADIENT_END[0] - GRADIENT_START[0]) * t)
        g = int(GRADIENT_START[1] + (GRADIENT_END[1] - GRADIENT_START[1]) * t)
        b = int(GRADIENT_START[2] + (GRADIENT_END[2] - GRADIENT_START[2]) * t)
        for y in range(top_y, top_y + th + 8):
            if 0 <= y < canvas.height:
                gpx[x, y] = (r, g, b, 255)

    canvas.paste(Image.composite(gradient, canvas, mask), (0, 0))
    return top_y + th


def build_android12() -> None:
    logo = Image.open(SRC).convert("RGBA")
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 255))

    max_side = int(SAFE_DIAMETER * 0.82)
    logo.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    x = (CANVAS - logo.width) // 2
    y = (CANVAS - logo.height) // 2
    canvas.alpha_composite(logo, (x, y))
    canvas.convert("RGB").save(OUT_A12, quality=95)
    print(f"android12 splash -> {OUT_A12}")


def build_combined() -> None:
    """Logo + title directly underneath for native splash (no bottom branding)."""
    logo = Image.open(LOGO_WHITE).convert("RGBA")
    logo_size = 720
    logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)

    gap = 48
    font = _load_bold_font(56)
    # Measure text height
    probe = Image.new("RGBA", (10, 10))
    bbox = ImageDraw.Draw(probe).textbbox((0, 0), TITLE, font=font)
    text_h = bbox[3] - bbox[1]

    pad_x, pad_top, pad_bottom = 80, 80, 80
    width = max(logo.width, 900) + pad_x * 2
    height = pad_top + logo.height + gap + text_h + pad_bottom

    canvas = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    lx = (width - logo.width) // 2
    canvas.alpha_composite(logo, (lx, pad_top))
    _draw_gradient_text(canvas, TITLE, font, width // 2, pad_top + logo.height + gap)
    canvas.convert("RGB").save(OUT_COMBINED, quality=95)
    print(f"combined splash -> {OUT_COMBINED}")


def main() -> None:
    build_android12()
    build_combined()


if __name__ == "__main__":
    main()
