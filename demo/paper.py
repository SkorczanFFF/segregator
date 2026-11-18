"""Print on paper: text in the web app's own typefaces, lines and stamps, drawn as ink masks."""

from functools import cache
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "web" / "node_modules" / "@fontsource-variable"
# Fontsource splits each typeface by script. Polish needs both: ó is Latin, ą and ł Latin Extended-A.
SUBSETS = ("latin", "latin-ext")
CACHE = Path(__file__).resolve().parent / ".cache"

MONO = "jetbrains-mono"
SANS = "hanken-grotesk"
SERIF = "fraunces"


@cache
def font_file(family: str, subset: str) -> Path:
    """Fontsource's WOFF2 as a TrueType file, which Pillow can open."""
    ttf = CACHE / f"{family}-{subset}.ttf"
    if not ttf.exists():
        CACHE.mkdir(exist_ok=True)
        font = TTFont(FONTS / family / "files" / f"{family}-{subset}-wght-normal.woff2")
        font.flavor = None
        font.save(ttf)
    return ttf


@cache
def characters(family: str, subset: str) -> frozenset[int]:
    return frozenset(TTFont(font_file(family, subset)).getBestCmap())


@cache
def face(family: str, size: int, weight: int = 400) -> Face:
    return Face(family, size, weight)


class Face:
    """A typeface at a size and weight. Each character comes from the subset that has it."""

    def __init__(self, family: str, size: int, weight: int):
        self.fonts = []
        for subset in SUBSETS:
            font = ImageFont.truetype(str(font_file(family, subset)), size)
            font.set_variation_by_axes([weight])
            self.fonts.append((font, characters(family, subset)))

    def font(self, character: str) -> ImageFont.FreeTypeFont:
        return next((font for font, codes in self.fonts if ord(character) in codes), self.fonts[0][0])

    def length(self, text: str) -> float:
        return sum(self.font(character).getlength(character) for character in text)


class Sheet:
    """A sheet of paper with print on it: black ink and, optionally, the blue of a stamp."""

    def __init__(self, width: int, height: int):
        self.width, self.height = width, height
        self.layers = {"ink": Image.new("L", (width, height), 0), "stamp": Image.new("L", (width, height), 0)}

    def text(self, x: float, baseline: float, text: str, typeface: Face, align: str = "left", layer: str = "ink"):
        """Text on a baseline, with its left edge, centre or right edge at x."""
        left = x - {"left": 0, "center": typeface.length(text) / 2, "right": typeface.length(text)}[align]
        draw = ImageDraw.Draw(self.layers[layer])
        for character in text:
            font = typeface.font(character)
            draw.text((left, baseline), character, font=font, fill=255, anchor="ls")
            left += font.getlength(character)

    def line(self, x0: float, y0: float, x1: float, y1: float, width: int = 2, layer: str = "ink"):
        ImageDraw.Draw(self.layers[layer]).line((x0, y0, x1, y1), fill=255, width=width)

    def rect(self, box: tuple[float, float, float, float], width: int = 2, layer: str = "ink"):
        ImageDraw.Draw(self.layers[layer]).rectangle(box, outline=255, width=width)

    def dashes(self, x0: float, x1: float, y: float, dash: int = 10, gap: int = 6, width: int = 2):
        x = x0
        while x < x1:
            self.line(x, y, min(x + dash, x1), y, width)
            x += dash + gap

    @staticmethod
    def bars(digits: str) -> list[int]:
        """The widths of a stand-in for a printed code, in modules, two bars from each digit and twice over."""
        return [bar for digit in digits * 2 for bar in (1 + int(digit) % 3, 1 + int(digit) // 4)]

    @staticmethod
    def barcode_width(digits: str, module: int = 3) -> int:
        return sum((bar + 1) * module for bar in Sheet.bars(digits))

    def barcode(self, x: float, y: float, digits: str, height: int, module: int = 3):
        left = x
        for bar in self.bars(digits):
            ImageDraw.Draw(self.layers["ink"]).rectangle((left, y, left + bar * module - 1, y + height), fill=255)
            left += (bar + 1) * module

    def printed(
        self, paper: tuple[int, int, int], ink: tuple[int, int, int], rng: np.random.Generator, fade: float = 0.0
    ) -> np.ndarray:
        """The sheet as an RGB image. Thermal print fades unevenly, by up to fade."""
        ink_alpha = np.asarray(self.layers["ink"], dtype=np.float32) / 255
        if fade:
            ink_alpha *= 1 - fade * smooth_noise(rng, self.height, self.width, 7)
        stamp_alpha = np.asarray(self.layers["stamp"], dtype=np.float32) / 255 * 0.75
        image = np.empty((self.height, self.width, 3), np.float32)
        image[:] = paper
        image = image * (1 - ink_alpha[..., None]) + np.array(ink, np.float32) * ink_alpha[..., None]
        image = image * (1 - stamp_alpha[..., None]) + np.array((40, 70, 165), np.float32) * stamp_alpha[..., None]
        return image.clip(0, 255).astype(np.uint8)


def smooth_noise(rng: np.random.Generator, height: int, width: int, cells: int) -> np.ndarray:
    """Noise between 0 and 1 that changes slowly, about cells blobs across the shorter side."""
    small = rng.random(
        (max(2, round(cells * height / min(height, width))), max(2, round(cells * width / min(height, width)))),
        dtype=np.float32,
    )
    return np.asarray(Image.fromarray(small).resize((width, height), Image.BICUBIC)).clip(0, 1)
