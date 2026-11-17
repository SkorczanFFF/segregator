"""Made-up documents drawn in code, so the tests need no photos."""

from math import cos, radians, sin, tan

import cv2
import numpy as np

ITEMS = ["Chleb", "Mleko 2%", "Jablka", "Kawa ziarnista", "Woda", "Ser", "Maslo", "Makaron", "Herbata"]


# Where the corners of the sheet land on the photo, seen from an angle.
SLANTED = [(330, 160), (1250, 210), (1290, 1450), (300, 1430)]


def page():
    """A white receipt: a centred title, then items in lines that start at one left margin."""
    width, height = 800, 1100
    image = np.full((height, width, 3), 255, np.uint8)
    cv2.putText(image, "SKLEP TESTOWY", (width // 2 - 170, 90), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 3)
    for row, item in enumerate(ITEMS):
        text = f"{item} {'.' * (8 + 3 * (row % 4))} {row + 1},{(row * 37) % 100:02d}"
        cv2.putText(image, text, (60, 190 + row * 90), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (20, 20, 20), 2)
    return image


def wood(width, height):
    """A wooden table with dark grain, thin and wide."""
    table = np.full((height, width, 3), (45, 80, 120), np.uint8)
    grain = np.random.default_rng(3)
    for _ in range(150):
        y, x = int(grain.integers(0, height)), int(grain.integers(-width // 2, width))
        end = (x + int(grain.integers(width // 4, width)), y + int(grain.integers(-40, 40)))
        cv2.line(table, (x, y), end, (15, 30, 50), int(grain.integers(3, 24)), cv2.LINE_AA)
    return table


def cloth(width, height):
    """A dark cloth with a bright print. A cream moon with a pale band reaches the right side of a sheet that
    lies in the middle, as light as the sheet but coloured."""
    table = np.full((height, width, 3), (90, 40, 70), np.uint8)
    pattern = np.random.default_rng(5)
    for _ in range(14):
        centre = (int(pattern.integers(0, width)), int(pattern.integers(0, height)))
        axes = (int(pattern.integers(40, 160)), int(pattern.integers(30, 90)))
        cv2.ellipse(table, centre, axes, float(pattern.integers(0, 180)), 0, 360, (120, 220, 240), -1)
    cv2.ellipse(table, (width * 7 // 8, height * 7 // 16), (220, 160), 20, 0, 360, (110, 210, 245), -1)
    cv2.rectangle(table, (width * 25 // 32, height * 7 // 20), (width, height * 31 // 80), (200, 235, 245), -1)
    return table


def lit(width, height):
    """A table lit from one side, from dark to almost as light as paper."""
    ramp = np.linspace(50, 200, width).astype(np.uint8)
    return np.repeat(np.tile(ramp, (height, 1))[:, :, None], 3, axis=2)


SURFACES = {"wood": wood, "cloth": cloth, "lit": lit}


def turned(sheet, angle, centre=(800, 800)):
    """The corners of the sheet turned by angle, in degrees, about the centre of the photo."""
    height, width = sheet.shape[:2]
    turn = np.array([[cos(radians(angle)), -sin(radians(angle))], [sin(radians(angle)), cos(radians(angle))]])
    corners = np.array([[-width, -height], [width, -height], [width, height], [-width, height]]) / 2 * 0.95
    return corners @ turn.T + centre


def on_table(sheet, corners, size=(1600, 1600), surface="wood"):
    """The sheet photographed from an angle, lying on one of the SURFACES."""
    table = SURFACES[surface](*size)
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
