"""Finds the document on a photo and turns it into a straight, cropped image for reading."""

from math import atan2, cos, degrees, radians, sin
from statistics import median
from typing import NamedTuple

import cv2
import numpy as np

# Outlines and text lines are found on a copy this size: faster, and they need no more detail.
WORK_SIDE = 1000
# Wider than strokes of text and thin light streaks, so a closing and an opening this size wipe them out.
WIPE_SIDE = 15
# A paper outline covers at least this share of the photo, so a label in the background doesn't count.
MIN_PAPER_AREA = 0.2
# Paper is lighter than what it lies on by at least this much, out of 255.
MIN_PAPER_CONTRAST = 10
# A smaller tilt isn't worth resampling, which softens the text a little.
MIN_TILT = 0.5
# Lines or a margin further off than this are a misreading, not a tilt.
MAX_TILT = 30


class Line(NamedTuple):
    angle: float
    start: tuple[float, float]


class Tilt(NamedTuple):
    # How far the lines of text turn from level, in degrees.
    rotation: float
    # How far their left edge leans from square to the lines, in degrees. The shear part of the skew.
    lean: float


def straighten(image: np.ndarray) -> np.ndarray | None:
    """The document squared and cropped, or None when there is nothing to fix or nothing was found."""
    scale = min(1.0, WORK_SIDE / max(image.shape[:2]))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    corners = find_paper(gray)
    if corners is not None:
        return warp_paper(image, corners / scale)
    tilt = measure_tilt(gray)
    if tilt is None or max(abs(tilt.rotation), abs(tilt.lean)) < MIN_TILT:
        return None
    return untilt(image, tilt)


def find_paper(gray: np.ndarray) -> np.ndarray | None:
    """The four corners of the sheet, when its whole outline is on the photo."""
    square = cv2.getStructuringElement(cv2.MORPH_RECT, (WIPE_SIDE, WIPE_SIDE))
    # Paints over the text, so the sheet is one light patch.
    blank = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, square)
    # The sheet is the light part of the photo. The table is the dark part with all its grain, however wide,
    # so the grain never breaks the sheet's outline.
    _, light = cv2.threshold(blank, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Cuts off thin light streaks that touch the sheet, such as a lighter vein of wood or a glare.
    light = cv2.morphologyEx(light, cv2.MORPH_OPEN, square)
    contours, _ = cv2.findContours(light, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        # A patch that runs off the photo is a sheet seen only in part, or a photo that is all sheet.
        x, y, patch_width, patch_height = cv2.boundingRect(contour)
        if x == 0 or y == 0 or x + patch_width == width or y + patch_height == height:
            continue
        outline = cv2.approxPolyDP(contour, 0.02 * cv2.arcLength(contour, True), True)
        if len(outline) != 4 or not cv2.isContourConvex(outline):
            continue
        if cv2.contourArea(outline) < MIN_PAPER_AREA * gray.size:
            continue
        inside = np.zeros_like(gray)
        cv2.fillConvexPoly(inside, outline, 255)
        if cv2.mean(gray, inside)[0] - cv2.mean(gray, 255 - inside)[0] >= MIN_PAPER_CONTRAST:
            return order_corners(outline.reshape(4, 2).astype(np.float32))
    return None


def order_corners(points: np.ndarray) -> np.ndarray:
    """Top-left, top-right, bottom-right, bottom-left."""
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).ravel()
    return np.array(
        [points[np.argmin(sums)], points[np.argmin(diffs)], points[np.argmax(sums)], points[np.argmax(diffs)]],
        dtype=np.float32,
    )


def warp_paper(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    """The sheet seen straight from above, at about the size it has on the photo."""
    top_left, top_right, bottom_right, bottom_left = corners
    width = round(max(np.linalg.norm(top_right - top_left), np.linalg.norm(bottom_right - bottom_left)))
    height = round(max(np.linalg.norm(bottom_left - top_left), np.linalg.norm(bottom_right - top_right)))
    target = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(corners, target)
    return cv2.warpPerspective(image, matrix, (width, height), flags=cv2.INTER_CUBIC)


def text_lines(gray: np.ndarray) -> list[Line]:
    """Each line of text as its baseline: its angle and the point where it begins."""
    ink = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    # A flat kernel joins the letters of a line into one shape, but not the lines with each other.
    width = gray.shape[1]
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, width // 40), 1))
    joined = cv2.morphologyEx(ink, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(joined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)

    lines = []
    for contour in contours:
        _, sides, _ = cv2.minAreaRect(contour)
        if max(sides) < 0.08 * width or max(sides) < 4 * min(sides):
            continue
        points = contour.reshape(-1, 2).astype(np.float32)
        # The lowest point of each column traces the baseline, where letters, digits and dots all sit. Through
        # the whole shape, tall letters and low dots would tip the line. Descenders hang below the baseline,
        # so a robust fit leaves them out.
        by_column = points[np.lexsort((-points[:, 1], points[:, 0]))]
        _, lowest = np.unique(by_column[:, 0], return_index=True)
        dx, dy, x, y = cv2.fitLine(by_column[lowest], cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        if dx < 0:
            dx, dy = -dx, -dy
        angle = degrees(atan2(dy, dx))
        if abs(angle) > MAX_TILT:
            continue
        first = ((points - (x, y)) @ (dx, dy)).min()
        lines.append(Line(angle, (x + first * dx, y + first * dy)))
    return lines


def measure_tilt(gray: np.ndarray) -> Tilt | None:
    """The tilt of the text, or None with too few lines to tell."""
    lines = text_lines(gray)
    if len(lines) < 3:
        return None
    rotation = median(line.angle for line in lines)
    # Along the lines, and square to them pointing down the page.
    along = (cos(radians(rotation)), sin(radians(rotation)))
    down = (-sin(radians(rotation)), cos(radians(rotation)))

    # Points closer than 1.5% of the width share a row, or lie on the margin.
    near = 0.015 * gray.shape[1]

    # The left margin is where the rows begin. Only the first piece of a row counts, since a row breaks
    # at wide gaps. Centred titles stray from the margin, so it counts only when most rows agree on it.
    starts = np.array(row_starts(lines, along, down, near), dtype=np.float32)
    if len(starts) < 3:
        return Tilt(rotation, 0.0)
    dx, dy, x, y = cv2.fitLine(starts, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
    if dy < 0:
        dx, dy = -dx, -dy
    off_margin = np.abs((starts[:, 0] - x) * dy - (starts[:, 1] - y) * dx)
    on_margin = int((off_margin < near).sum())
    lean = degrees(atan2(down[0] * dy - down[1] * dx, down[0] * dx + down[1] * dy))
    if on_margin < max(3, len(starts) // 2) or abs(lean) > MAX_TILT:
        lean = 0.0
    return Tilt(rotation, lean)


def row_starts(lines: list[Line], along, down, near: float) -> list[tuple[float, float]]:
    """Where each row of text begins. Pieces at the same height across the page form a row."""
    rows: list[list[tuple[float, float]]] = []
    for start in sorted((line.start for line in lines), key=lambda start: np.dot(start, down)):
        if rows and np.dot(start, down) - np.dot(rows[-1][-1], down) < near:
            rows[-1].append(start)
        else:
            rows.append([start])
    return [min(row, key=lambda start: np.dot(start, along)) for row in rows]


def untilt(image: np.ndarray, tilt: Tilt) -> np.ndarray:
    """Levels the lines and stands their left edge upright, on a canvas that fits the whole photo."""
    along = (cos(radians(tilt.rotation)), sin(radians(tilt.rotation)))
    down_angle = radians(tilt.rotation + tilt.lean)
    down = (-sin(down_angle), cos(down_angle))
    # Sends the direction of the lines to x and the direction of the margin to y.
    linear = np.linalg.inv(np.column_stack([along, down]))

    height, width = image.shape[:2]
    corners = np.array([[0, 0], [width, 0], [width, height], [0, height]], dtype=np.float64) @ linear.T
    low, high = corners.min(axis=0), corners.max(axis=0)
    matrix = np.hstack([linear, -low.reshape(2, 1)])
    size = (int(np.ceil(high[0] - low[0])), int(np.ceil(high[1] - low[1])))
    # The new corners take the colour along the photo's edges, mostly the paper. Stretching the edge pixels
    # instead would smear any letter that touches the edge across them.
    edges = np.concatenate([image[0], image[-1], image[:, 0], image[:, -1]])
    fill = tuple(int(channel) for channel in np.median(edges, axis=0))
    return cv2.warpAffine(image, matrix, size, flags=cv2.INTER_CUBIC, borderValue=fill)
