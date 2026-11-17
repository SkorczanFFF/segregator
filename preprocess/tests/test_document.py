import cv2
import numpy as np
import pytest

from document import measure_tilt, straighten
from tests.pages import on_table, page, tilted


def gray(image):
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def test_cuts_the_sheet_out_of_a_photo_taken_from_an_angle():
    photo = on_table(page(), [(330, 160), (1250, 210), (1290, 1450), (300, 1430)])
    result = straighten(photo)

    assert result is not None
    # Perspective alone can't give the exact proportions back, only close to them.
    assert result.shape[0] / result.shape[1] == pytest.approx(1100 / 800, rel=0.1)
    # Only the sheet is left, without the table around it.
    assert gray(result).mean() > 200
    tilt = measure_tilt(gray(result))
    assert abs(tilt.rotation) < 1


@pytest.mark.parametrize(("rotation", "lean"), [(6, 0), (-4, 0), (5, 8), (-3, -6), (-20, 5)])
def test_levels_the_lines_and_squares_the_margin_without_paper_edges(rotation, lean):
    photo = tilted(page(), rotation, lean)
    measured = measure_tilt(gray(photo))
    assert measured.rotation == pytest.approx(rotation, abs=0.25)
    assert measured.lean == pytest.approx(lean, abs=0.5)

    result = straighten(photo)
    assert result is not None
    left = measure_tilt(gray(result))
    assert abs(left.rotation) < 0.25
    assert abs(left.lean) < 0.5


def test_leaves_a_straight_page_alone():
    assert straighten(page()) is None


def test_gives_up_on_a_photo_without_text_or_paper():
    noise = np.random.default_rng(7).integers(0, 255, (900, 700, 3), dtype=np.uint8)
    assert straighten(cv2.GaussianBlur(noise, (51, 51), 0)) is None
