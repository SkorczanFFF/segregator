"""Finds the document on a photo and straightens it for reading: cut out of the photo, or its lines levelled."""

from collections.abc import Iterator
from math import atan2, cos, degrees, radians, sin
from statistics import median
from typing import Literal, NamedTuple

import cv2
import numpy as np

# Outlines and text lines are found on a copy this size: faster, and they need no more detail.
WORK_SIDE = 1000
# Wider than strokes of text and thin light streaks, so a closing and an opening this size wipe them out.
WIPE_SIDE = 15
# Wider than a thin light line that touches the sheet's edge, such as a grid printed on a mat.
LINE_SIDE = 5
# Wider than a patch of the background stuck to the sheet, such as part of a print on a cloth, and narrower
# than any sheet worth finding.
CORE_SIDE = 61
# The core's corners are blunt, so its outline is simplified this coarsely, as a share of its length, to keep
# four of them.
OUTLINE_DETAIL = 0.04
# A side's real edge is looked for this far from the core's side, as a share of the photo's longer side.
SIDE_REACH = 0.02
# The sheet and what it lies on are compared on bands this wide, just inside and just outside its outline.
EDGE_BAND = 8
# A paper outline covers at least this share of the photo, so a label in the background doesn't count.
MIN_PAPER_AREA = 0.2
# Paper is lighter than what it lies on, right at its edge, by at least this much, out of 255.
MIN_PAPER_CONTRAST = 10
# A smaller tilt isn't worth resampling, which softens the text a little.
MIN_TILT = 0.5
# Lines or a margin further off than this are a misreading, not a tilt.
MAX_TILT = 30


class Line(NamedTuple):
    angle: float
    start: tuple[float, float]


class Straightened(NamedTuple):
    image: np.ndarray
    # What was done, for the person to see: the sheet cut out of the photo, or its lines levelled. The names
    # are the ones in shared/src/file.ts.
    change: Literal["cut", "levelled"]


class Paper(NamedTuple):
    corners: np.ndarray
    # How much lighter the sheet is than what it lies on, right at its edge.
    contrast: float


class Tilt(NamedTuple):
    # How far the lines of text turn from level, in degrees.
    rotation: float
    # How far their left edge leans from square to the lines, in degrees. The shear part of the skew.
    lean: float


def straighten(image: np.ndarray) -> Straightened | None:
    """The document straightened, or None when there is nothing to fix or nothing was found."""
    scale = min(1.0, WORK_SIDE / max(image.shape[:2]))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else image
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    corners = find_paper(small, gray)
    if corners is not None:
        return Straightened(warp_paper(image, corners / scale), "cut")
    tilt = measure_tilt(gray)
    if tilt is None or max(abs(tilt.rotation), abs(tilt.lean)) < MIN_TILT:
        return None
    return Straightened(untilt(image, tilt), "levelled")


def find_paper(small: np.ndarray, gray: np.ndarray) -> np.ndarray | None:
    """The four corners of the sheet, when its whole outline is on the photo."""
    found = [paper for patch, edge in patches(small, gray) for paper in sheets(gray, patch, edge)]
    best = max(found, key=lambda paper: paper.contrast, default=None)
    return best.corners if best and best.contrast >= MIN_PAPER_CONTRAST else None


def patches(small: np.ndarray, gray: np.ndarray) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """Ways to tell the sheet from what it lies on, each as a mask of where the sheet may be and a mask whose
    outline follows its edge. A background can defeat one way, rarely all, and the clearest edge wins."""
    square = cv2.getStructuringElement(cv2.MORPH_RECT, (WIPE_SIDE, WIPE_SIDE))
    line = cv2.getStructuringElement(cv2.MORPH_RECT, (LINE_SIDE, LINE_SIDE))
    # With the text painted over, the sheet is one patch.
    blank_gray = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, square)
    # The sheet is light, and white too: its weakest colour channel is light, unlike a bright print on a cloth.
    whiteness = small.min(axis=2)
    for measure, blank in ((gray, blank_gray), (whiteness, cv2.morphologyEx(whiteness, cv2.MORPH_CLOSE, square))):
        # The table is the dark part with all its grain, however wide, so the grain never breaks the outline.
        level, light = cv2.threshold(blank, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Without the painting, something light close to the sheet stays apart from its edge.
        _, edge = cv2.threshold(measure, level, 255, cv2.THRESH_BINARY)
        # Openings cut off light streaks that touch the sheet, such as a lighter vein of wood or a glare.
        yield cv2.morphologyEx(light, cv2.MORPH_OPEN, square), cv2.morphologyEx(edge, cv2.MORPH_OPEN, line)
    # On a background as light as the sheet, only its edge sets it apart: the shapes edges close, filled.
    edges = cv2.dilate(cv2.Canny(cv2.GaussianBlur(blank_gray, (5, 5), 0), 50, 150), np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    outlined = np.zeros_like(gray)
    cv2.drawContours(outlined, contours, -1, 255, cv2.FILLED)
    yield outlined, outlined


def sheets(gray: np.ndarray, patch: np.ndarray, edge: np.ndarray) -> Iterator[Paper]:
    """Four-sided patches that may be the sheet, with their sides fitted to the edge mask."""
    height, width = gray.shape
    # The core leaves out patches of the background stuck to the sheet, at the cost of blunt corners, which the
    # edge gives back.
    square = cv2.getStructuringElement(cv2.MORPH_RECT, (CORE_SIDE, CORE_SIDE))
    core_mask = cv2.morphologyEx(patch, cv2.MORPH_OPEN, square)
    cores, _ = cv2.findContours(core_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    outlines, _ = cv2.findContours(edge, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    for core in sorted(cores, key=cv2.contourArea, reverse=True)[:3]:
        # A sheet that runs off the photo is seen only in part, or the photo is all sheet.
        x, y, core_width, core_height = cv2.boundingRect(core)
        if x == 0 or y == 0 or x + core_width == width or y + core_height == height:
            continue
        outline = cv2.approxPolyDP(core, OUTLINE_DETAIL * cv2.arcLength(core, True), True)
        if len(outline) != 4 or not cv2.isContourConvex(outline):
            continue
        corners = order_corners(outline.reshape(4, 2).astype(np.float32))
        middle = tuple(float(value) for value in corners.mean(axis=0))
        around = next((around for around in outlines if cv2.pointPolygonTest(around, middle, False) >= 0), None)
        if around is not None:
            corners = fit_sides(corners, around.reshape(-1, 2).astype(np.float32), SIDE_REACH * max(height, width))
        # A fitted corner past the photo's edge belongs to a sheet that runs off it.
        on_photo = (corners >= 0).all() and (corners <= (width - 1, height - 1)).all()
        if on_photo and cv2.contourArea(corners) >= MIN_PAPER_AREA * gray.size:
            yield Paper(corners, edge_contrast(gray, corners))


def fit_sides(corners: np.ndarray, edge: np.ndarray, reach: float) -> np.ndarray:
    """The corners where lines fitted to the edge meet. Each side takes only the edge points near it and away
    from its ends, so a blunt corner or a patch stuck to the side hardly moves its line."""
    lines = []
    for start, end in zip(corners, np.roll(corners, -1, axis=0), strict=True):
        length = np.linalg.norm(end - start)
        along = (end - start) / length
        across = np.array([-along[1], along[0]])
        offset = edge - start
        position = offset @ along / length
        near = edge[(np.abs(offset @ across) < reach) & (position > 0.1) & (position < 0.9)]
        if len(near) < 20:
            return corners
        dx, dy, x, y = cv2.fitLine(near, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
        lines.append((np.array([x, y]), np.array([dx, dy])))
    fitted = np.array([crossing(lines[i - 1], lines[i]) for i in range(4)], dtype=np.float32)
    # The opening moves a corner by less than its square, so a crossing further off comes from a wrong line.
    return fitted if np.isfinite(fitted).all() and np.abs(fitted - corners).max() < CORE_SIDE else corners


def crossing(first: tuple[np.ndarray, np.ndarray], second: tuple[np.ndarray, np.ndarray]) -> np.ndarray:
    """Where two lines, each a point and a direction, cross, or infinity for parallel ones."""
    (point, direction), (other, other_direction) = first, second
    matrix = np.column_stack([direction, -other_direction])
    if abs(np.linalg.det(matrix)) < 1e-6:
        return np.full(2, np.inf)
    return point + np.linalg.solve(matrix, other - point)[0] * direction


def edge_contrast(gray: np.ndarray, corners: np.ndarray) -> float:
    """How much lighter the band just inside the outline is than the band just outside it."""
    sheet = np.zeros_like(gray)
    cv2.fillConvexPoly(sheet, corners.astype(np.int32), 255)
    band = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * EDGE_BAND + 1, 2 * EDGE_BAND + 1))
    inside = cv2.subtract(sheet, cv2.erode(sheet, band))
    outside = cv2.subtract(cv2.dilate(sheet, band), sheet)
    return cv2.mean(gray, inside)[0] - cv2.mean(gray, outside)[0]


def order_corners(points: np.ndarray) -> np.ndarray:
    """Clockwise along the outline from the top-left corner, so no corner repeats on a sheet turned 45°."""
    x, y = points[:, 0], points[:, 1]
    if (x * np.roll(y, -1) - np.roll(x, -1) * y).sum() < 0:
        points = points[::-1]
    return np.roll(points, -int(np.argmin(points.sum(axis=1))), axis=0)


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
        # The lowest point of each column traces the baseline, where letters, digits and dots all sit. Descenders
        # hang below the baseline, so a robust fit leaves them out.
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
    # The new corners take the colour along the photo's edges, mostly the paper.
    edges = np.concatenate([image[0], image[-1], image[:, 0], image[:, -1]])
    fill = tuple(int(channel) for channel in np.median(edges, axis=0))
    return cv2.warpAffine(image, matrix, size, flags=cv2.INTER_CUBIC, borderValue=fill)
