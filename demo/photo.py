"""A flat printout turned into a phone photo of it: on a surface, turned, in perspective, creased and unevenly lit."""

import cv2
import numpy as np

from paper import smooth_noise

# 3:4, below PHOTO_MAX_SIDE in web/src/features/upload/prepare.ts. The phone turns sideways for paper wider than tall.
PHOTO = (1800, 2400)
# How far the phone leans away from the paper and to its side, in degrees, and how far it is held, in the
# paper's longer side.
PITCH = (12, 24)
YAW = 10
DISTANCE = 1.3
# The most pixels the ground is drawn with.
MAX_GROUND = 16_000_000


# Base colours of the surfaces, RGB.
WOODS = [(176, 128, 80), (132, 90, 58), (98, 64, 42), (150, 112, 74)]
CLOTHS = [(70, 84, 104), (92, 96, 88), (104, 70, 66), (64, 92, 80), (120, 112, 98)]
STONES = [(66, 70, 74), (88, 84, 80), (40, 42, 46)]
LAMINATES = [(36, 36, 38), (58, 62, 66), (40, 52, 46), (34, 42, 60), (120, 118, 114)]
# Strong colours of a printed cloth, darker than paper.
BLOTS = [(200, 40, 60), (240, 150, 20), (30, 120, 200), (40, 160, 80), (150, 60, 170), (230, 90, 140), (20, 150, 150)]
CHECKS = [(150, 44, 48), (40, 70, 140), (46, 110, 70), (60, 60, 64)]


def turning(degrees: float) -> np.ndarray:
    """The matrix that turns a point by this many degrees."""
    angle = np.radians(degrees)
    return np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])


def printed_cloth(rng: np.random.Generator, width: int, height: int, mm: float) -> np.ndarray:
    """A busy printed cloth: blots, leaves and dots of strong colours, large and small, over a ground of its own."""
    cloth = np.empty((height, width, 3), np.uint8)
    cloth[:] = np.array(BLOTS[rng.integers(len(BLOTS))]) * rng.uniform(0.5, 0.8)
    for _ in range(round(width * height / (mm * 30) ** 2 * rng.uniform(8, 12))):
        colour = (np.array(BLOTS[rng.integers(len(BLOTS))]) * rng.uniform(0.7, 1.0)).tolist()
        centre = (int(rng.uniform(0, width)), int(rng.uniform(0, height)))
        size = rng.uniform(3, 28) * mm
        if rng.random() < 0.3:
            cv2.circle(cloth, centre, round(size / 4), colour, -1, cv2.LINE_AA)
        else:
            axes = (round(size / 2), round(size * rng.uniform(0.2, 0.5)))
            cv2.ellipse(cloth, centre, axes, rng.uniform(0, 180), 0, 360, colour, -1, cv2.LINE_AA)
    grain = cv2.GaussianBlur(rng.normal(0, 1, (height, width)).astype(np.float32), (0, 0), 0.15 * mm)
    return cloth.astype(np.float32) * (0.95 + 0.04 * grain)[..., None]


def ground(kind: str, rng: np.random.Generator, width: int, height: int, mm: float) -> np.ndarray:
    """What the paper lies on, seen from straight above at mm pixels to a millimetre. RGB."""
    if kind == "print":
        return printed_cloth(rng, width, height, mm)
    y, x = np.mgrid[0:height, 0:width].astype(np.float32) / mm
    grain = rng.normal(0, 1, (height, width)).astype(np.float32)

    def pick(colours: list) -> np.ndarray:
        return np.array(colours[rng.integers(len(colours))], np.float32) * rng.uniform(0.85, 1.12)

    if kind == "wood":
        # Planks along x, each a little lighter or darker, with fibres and the figure of the grain along them.
        index = (y // rng.uniform(90, 180)).astype(int)
        shades = rng.normal(0, 1, index.max() + 1)[index]
        fibres = cv2.GaussianBlur(grain, (0, 0), sigmaX=12 * mm, sigmaY=0.2 * mm)
        fibres /= np.abs(fibres).max() + 1e-6
        warp = smooth_noise(rng, height, width, 3) * rng.uniform(20, 60)
        figure = np.sin((y + warp) / rng.uniform(3, 8)) * 0.5 + 0.5
        tone = 0.64 + 0.06 * shades + 0.1 * figure + 0.16 * fibres
        base = pick(WOODS)
    elif kind == "linen":
        period = rng.uniform(0.4, 1.0)
        weave = 0.5 + 0.25 * np.sin(x / period * np.pi) * np.sin(y / period * np.pi)
        tone = 0.75 + 0.15 * weave + 0.08 * cv2.GaussianBlur(grain, (0, 0), 0.15 * mm)
        base = pick(CLOTHS)
    elif kind == "checks":
        # A gingham tablecloth: where stripes of both directions cross, the colour is strongest.
        size = rng.uniform(8, 25)
        mix = ((((x // size) % 2) + ((y // size) % 2)) / 2)[..., None]
        light = np.array((196, 190, 180), np.float32)
        weave = 0.96 + 0.04 * cv2.GaussianBlur(grain, (0, 0), 0.15 * mm)
        return ((light * (1 - mix) + pick(CHECKS) * mix) * weave[..., None]).clip(0, 255)
    elif kind == "granite":
        # A stone counter: slow clouds with grains of light and dark mineral in them.
        grains = cv2.GaussianBlur(grain, (0, 0), rng.uniform(0.3, 0.8) * mm)
        grains /= grains.std() + 1e-6
        specks = 0.18 * (grains > 1.6) - 0.16 * (grains < -1.6)
        tone = 0.72 + 0.2 * smooth_noise(rng, height, width, int(rng.integers(3, 8))) + specks
        base = pick(STONES)
    elif kind == "slate":
        tone = 0.7 + 0.3 * smooth_noise(rng, height, width, int(rng.integers(4, 9)))
        tone += 0.05 * cv2.GaussianBlur(grain, (0, 0), 0.2 * mm)
        base = pick(STONES)
    elif kind == "desk":
        # Laminate: one colour, a soft sheen and a fine grain.
        tone = 0.9 + 0.1 * smooth_noise(rng, height, width, 2) + 0.02 * cv2.GaussianBlur(grain, (0, 0), 0.1 * mm)
        base = pick(LAMINATES)
    else:  # dashboard: dark plastic with a fine grain
        tone = 0.85 + 0.15 * smooth_noise(rng, height, width, 3) + 0.06 * cv2.GaussianBlur(grain, (0, 0), 0.1 * mm)
        base = np.array((44, 44, 46), np.float32)
    return (base * tone[..., None]).clip(0, 255)


def crease(paper: np.ndarray, rng: np.random.Generator, amount: float) -> np.ndarray:
    """Paper that was folded and smoothed out again: straight folds, each a ridge or a valley that catches the light
    on one side, over a slow unevenness. The print bends with it a little."""
    height, width = paper.shape[:2]
    if amount <= 0:
        return paper.astype(np.float32)
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    surface = 0.5 * (smooth_noise(rng, height, width, 3) - 0.5) * min(height, width) / 40
    for _ in range(round(2 + amount * 10)):
        angle = rng.uniform(0, np.pi)
        across = (x - rng.uniform(0, width)) * np.cos(angle) + (y - rng.uniform(0, height)) * np.sin(angle)
        reach = rng.uniform(50, 220)
        surface += rng.choice((-1, 1)) * rng.uniform(2, 6) * np.exp(-np.abs(across) / reach)
    slope_y, slope_x = np.gradient(surface)
    # Light from the top left: slopes facing it are brighter.
    light = 1 + amount * 2.2 * (-0.6 * slope_x - 0.8 * slope_y)
    moved = cv2.remap(paper, x + slope_x * 8, y + slope_y * 8, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return moved.astype(np.float32) * light.clip(0.86, 1.08)[..., None]


def photograph(
    paper: np.ndarray, mm: float, kind: str, rng: np.random.Generator, turn: float, creased: float
) -> np.ndarray:
    """The paper, drawn at mm pixels to a millimetre, lying on the ground and taken with a phone held not quite
    square to it. Returns an RGB image."""
    sheet = crease(paper, rng, creased)
    paper_height, paper_width = sheet.shape[:2]
    width, height = PHOTO if paper_height >= paper_width else PHOTO[::-1]
    corners = np.array([[-1, -1], [1, -1], [1, 1], [-1, 1]]) * np.array([paper_width, paper_height]) / 2
    x, y = (corners @ turning(turn).T).T
    # A phone held by hand leans away from the paper and a little to one side, so the far edge comes out narrower
    # and shorter than the near one, and one side narrower than the other.
    pitch = np.radians(rng.uniform(*PITCH))
    yaw = np.radians(rng.uniform(-YAW, YAW))
    distance = DISTANCE * max(paper_width, paper_height)
    depth = -y * np.sin(pitch) + x * np.sin(yaw)
    seen = np.c_[x * np.cos(yaw), y * np.cos(pitch)] * (distance / (distance + depth))[:, None]
    # The paper fills most of the frame, as when someone photographs a document, and stays whole in it.
    low, high = seen.min(0), seen.max(0)
    scale = min(0.80 * width / (high - low)[0], 0.86 * height / (high - low)[1])
    centre = np.array([width / 2, height / 2]) + rng.uniform(-0.04, 0.04, 2) * (width, height)
    target = ((seen - (low + high) / 2) * scale + centre + rng.normal(0, 6, (4, 2))).astype(np.float32)
    source = np.array([[0, 0], [paper_width, 0], [paper_width, paper_height], [0, paper_height]], np.float32)
    transform = cv2.getPerspectiveTransform(source, target)
    photo = seen_ground(kind, rng, transform, mm, scale, turn, (width, height))
    placed = cv2.warpPerspective(sheet, transform, (width, height), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.ones((paper_height, paper_width), np.float32), transform, (width, height))
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    # A soft shadow where the paper lifts off the ground.
    shadow = cv2.GaussianBlur(np.roll(mask, (14, 10), axis=(0, 1)), (0, 0), 14)
    photo *= (1 - 0.45 * shadow)[..., None]
    photo = photo * (1 - mask[..., None]) + placed * mask[..., None]
    # Light from one side and darker corners, as a lens gives.
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    direction = rng.uniform(0, 2 * np.pi)
    gradient = (x / width - 0.5) * np.cos(direction) + (y / height - 0.5) * np.sin(direction)
    vignette = (x / width - 0.5) ** 2 + (y / height - 0.5) ** 2
    photo *= (1 + 0.22 * gradient - 0.35 * vignette)[..., None]
    photo += rng.normal(0, 2.5, photo.shape)
    photo = cv2.GaussianBlur(photo.clip(0, 255), (0, 0), 0.7)
    return photo.astype(np.uint8)


def seen_ground(
    kind: str, rng: np.random.Generator, transform: np.ndarray, mm: float, scale: float, turn: float, size: tuple
) -> np.ndarray:
    """The ground in the paper's plane, through the paper's transform, so it recedes with the paper. It lies at an
    angle of its own."""
    rotation = turning(rng.uniform(0, 180) - turn)
    width, height = size
    frame = np.float32([[[0, 0], [width, 0], [width, height], [0, height]]])
    on_paper = cv2.perspectiveTransform(frame, np.linalg.inv(transform))[0]
    # Drawn at about the photo's own resolution, and coarser when the far side reaches out too far.
    for _ in range(4):
        corners = on_paper @ rotation * scale
        low, high = corners.min(0), corners.max(0)
        if np.prod(high - low) <= MAX_GROUND:
            break
        scale *= 0.7
    drawn = ground(kind, rng, int(high[0] - low[0]) + 2, int(high[1] - low[1]) + 2, mm * scale)
    # From the drawn ground's pixels to the paper's pixels, then into the photo.
    to_paper = np.eye(3)
    to_paper[:2, :2] = rotation / scale
    to_paper[:2, 2] = rotation @ low / scale
    return cv2.warpPerspective(drawn, transform @ to_paper, size, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
