"""Made-up documents drawn in code, so the tests need no photos."""

from math import radians, tan

import cv2
import numpy as np

ITEMS = ["Chleb", "Mleko 2%", "Jablka", "Kawa ziarnista", "Woda", "Ser", "Maslo", "Makaron", "Herbata"]


def page(width=800, height=1100):
    """A white receipt: a centred title, then items in lines that start at one left margin."""
    image = np.full((height, width, 3), 255, np.uint8)
    cv2.putText(image, "SKLEP TESTOWY", (width // 2 - 170, 90), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 3)
    for row, item in enumerate(ITEMS):
        text = f"{item} {'.' * (8 + 3 * (row % 4))} {row + 1},{(row * 37) % 100:02d}"
        cv2.putText(image, text, (60, 190 + row * 90), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (20, 20, 20), 2)
    return image


def on_table(sheet, corners, size=(1600, 1600)):
    """The sheet photographed from an angle, on a wooden table with dark grain, thin and wide, that runs up to it."""
    width, height = size
    table = np.full((height, width, 3), (45, 80, 120), np.uint8)
    grain = np.random.default_rng(3)
    for _ in range(150):
        y, x = int(grain.integers(0, height)), int(grain.integers(-width // 2, width))
        end = (x + int(grain.integers(width // 4, width)), y + int(grain.integers(-40, 40)))
        cv2.line(table, (x, y), end, (15, 30, 50), int(grain.integers(3, 24)), cv2.LINE_AA)

    sheet_height, sheet_width = sheet.shape[:2]
    source = np.array([[0, 0], [sheet_width, 0], [sheet_width, sheet_height], [0, sheet_height]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(source, np.array(corners, dtype=np.float32))
    photo = cv2.warpPerspective(sheet, matrix, size)
    under = cv2.warpPerspective(np.full(sheet.shape[:2], 255, np.uint8), matrix, size) > 0
    table[under] = photo[under]
    return table


def tilted(sheet, rotation, lean):
    """The sheet turned by rotation and sheared by lean, both in degrees, filling the whole photo."""
    height, width = sheet.shape[:2]
    # Sheared about the middle row, so no line slides off the edge.
    shear = np.array([[1, -tan(radians(lean)), tan(radians(lean)) * height / 2], [0, 1, 0]], dtype=np.float64)
    sheared = cv2.warpAffine(sheet, shear, (width, height), borderValue=(255, 255, 255))
    turn = cv2.getRotationMatrix2D((width / 2, height / 2), -rotation, 1)
    return cv2.warpAffine(sheared, turn, (width, height), borderValue=(255, 255, 255))
