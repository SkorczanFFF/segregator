"""How each kind of fictional document is laid out. What it says comes from documents.py and evaluation.py, except
the ticket, which only the demo has.

The receipts follow the layouts of real Polish fiscal printers: the seller and tax number, PARAGON FISKALNY, items
with their tax letter, the tax summary, the total, the payment and the footer with the till, the time and the
printer's number.
"""

from collections.abc import Callable

import cv2
import numpy as np

from paper import MONO, SANS, SERIF, Sheet, face

THERMAL = (243, 244, 240)
OFFICE = (246, 245, 241)
THERMAL_INK = (38, 38, 46)
LASER_INK = (24, 24, 28)


# A drawn sheet has 150 dots to an inch.
SHEET_MM = 150 / 25.4

# A roll 80 mm wide fits 40 characters a line.
COLUMNS = 40
SIZE = 30
CHAR = SIZE * 0.6
MARGIN = 40
# Thermal printers draw narrow letters.
SQUEEZE = 0.82
ROLL_WIDTH = round(COLUMNS * CHAR + 2 * MARGIN)
RECEIPT_MM = ROLL_WIDTH * SQUEEZE / 80


def receipt(rows: list[tuple], rng: np.random.Generator, fade: float = 0.35) -> np.ndarray:
    """A till roll. Each row is (kind, ...): ("center" or "left", text, scale?, weight?), ("pair", left, right,
    scale?, weight?), ("rule", "dots"?), ("space", pixels) or ("barcode", digits). The print fades by up to fade."""
    width = ROLL_WIDTH
    sheet = Sheet(width, 4000)
    y = MARGIN * 1.6
    for row in rows:
        kind, *args = row
        if kind == "space":
            y += args[0]
            continue
        if kind == "rule":
            # Dashes, or with "dots" the dotted rule some printers draw.
            dash, gap = (3, 8) if args == ["dots"] else (10, 6)
            y += SIZE * 0.5
            sheet.dashes(MARGIN, width - MARGIN, y, dash, gap)
            y += SIZE * 0.6
            continue
        if kind == "barcode":
            y += SIZE * 0.4
            sheet.barcode((width - Sheet.barcode_width(args[0])) / 2, y, args[0], 110)
            y += 110 + SIZE * 1.2
            sheet.text(width / 2, y, args[0], face(MONO, SIZE - 4, 500), "center")
            y += SIZE * 0.6
            continue
        count = 2 if kind == "pair" else 1
        options = args[count:]
        scale = options[0] if len(options) > 0 else 1.0
        weight = options[1] if len(options) > 1 else 500
        typeface = face(MONO, round(SIZE * scale), weight)
        y += SIZE * scale * 1.35
        if kind == "center":
            sheet.text(width / 2, y, args[0], typeface, "center")
        elif kind == "left":
            sheet.text(MARGIN, y, args[0], typeface)
        elif kind == "pair":
            sheet.text(MARGIN, y, args[0], typeface)
            sheet.text(width - MARGIN, y, args[1], typeface, "right")
    sheet.height = round(y + MARGIN * 2)
    for name, layer in sheet.layers.items():
        sheet.layers[name] = layer.crop((0, 0, width, sheet.height))
    image = sheet.printed(THERMAL, THERMAL_INK, rng, fade=fade)
    return cv2.resize(image, (round(width * SQUEEZE), sheet.height), interpolation=cv2.INTER_AREA)


# 210 by 297 mm.
A4 = (round(210 * SHEET_MM), round(297 * SHEET_MM))


def a4(rng: np.random.Generator, draw: Callable[[Sheet], None]) -> np.ndarray:
    sheet = Sheet(*A4)
    draw(sheet)
    return sheet.printed(OFFICE, LASER_INK, rng)


def label_value(sheet: Sheet, x: float, y: float, label: str, value: str, size: int = 24, gap: float = 0):
    sheet.text(x, y, label, face(SANS, size, 400))
    sheet.text(x + (gap or face(SANS, size, 400).length(label) + 10), y, value, face(SANS, size, 650))


def party(sheet: Sheet, x: float, y: float, title: str, lines: list[str]):
    sheet.text(x, y, title, face(SANS, 22, 650))
    for index, line in enumerate(lines):
        sheet.text(x, y + 36 * (index + 1), line, face(SANS, 24, 400))


def table(sheet: Sheet, x: float, y: float, columns: list[tuple[str, float, str]], rows: list[list[str]]) -> float:
    """A ruled table. Each column is (heading, width, align). Returns where it ends."""
    width = sum(column[1] for column in columns)
    head, body = face(SANS, 20, 650), face(SANS, 22, 400)
    sheet.line(x, y, x + width, y)
    for cells, typeface in [([column[0] for column in columns], head), *[(row, body) for row in rows]]:
        left = x
        for (_, column_width, align), cell in zip(columns, cells, strict=True):
            anchor = {"left": left + 10, "right": left + column_width - 10, "center": left + column_width / 2}[align]
            sheet.text(anchor, y + 34, cell, typeface, align)
            left += column_width
        y += 50
        sheet.line(x, y, x + width, y, 1 if typeface is body else 2)
    return y


def invoice(
    rng: np.random.Generator,
    *,
    number: str,
    dates: list[tuple[str, str]],
    seller: list[str],
    buyer: list[str],
    items: list[list[str]],
    rates: list[list[str]],
    total: str,
    words: str,
    payment: list[tuple[str, str]],
) -> np.ndarray:
    """A VAT invoice. Items are (no., name, quantity, net price, rate, gross value), rates are (rate, net, tax,
    gross) with the totals last, and payment holds the lines under the total."""

    def draw(sheet: Sheet):
        sheet.text(90, 150, "Faktura VAT", face(SERIF, 54, 600))
        sheet.text(90, 200, f"nr {number}", face(SANS, 28, 650))
        for index, (label, value) in enumerate(dates):
            label_value(sheet, 760, 130 + index * 36, label, value)
        party(sheet, 90, 300, "SPRZEDAWCA", seller)
        party(sheet, 680, 300, "NABYWCA", buyer)
        end = table(
            sheet,
            90,
            520,
            [
                ("Lp.", 60, "center"),
                ("Nazwa towaru lub usługi", 430, "left"),
                ("Ilość", 90, "right"),
                ("Cena netto", 150, "right"),
                ("VAT", 80, "right"),
                ("Wartość brutto", 250, "right"),
            ],
            items,
        )
        end = table(
            sheet,
            610,
            end + 40,
            [("Stawka", 100, "left"), ("Netto", 150, "right"), ("VAT", 150, "right"), ("Brutto", 140, "right")],
            rates,
        )
        sheet.text(90, end + 90, f"Do zapłaty: {total} PLN", face(SANS, 34, 700))
        label_value(sheet, 90, end + 140, "Słownie:", words)
        for index, (label, value) in enumerate(payment):
            label_value(sheet, 90, end + 190 + index * 36, label, value)
        for x, title in [(120, "Osoba upoważniona do odbioru"), (700, "Osoba upoważniona do wystawienia")]:
            sheet.dashes(x, x + 420, 1560)
            sheet.text(x + 210, 1592, title, face(SANS, 20, 400), "center")

    return a4(rng, draw)


def warranty(
    rng: np.random.Generator, *, maker: str, rows: list[tuple[str, str]], stamp: tuple[str, str, str]
) -> np.ndarray:
    """A warranty card from the maker, with the seller's stamp: its name, address and date."""
    sheet = Sheet(874, 1240)
    sheet.rect((30, 30, 844, 1210), 3)
    sheet.text(437, 130, "KARTA GWARANCYJNA", face(SERIF, 52, 650), "center")
    sheet.text(437, 180, maker, face(SANS, 22, 400), "center")
    for index, (label, value) in enumerate(rows):
        label_value(sheet, 80, 280 + index * 56, label, value, 26, 290)
    sheet.text(80, 620, "Gwarant zapewnia bezpłatną naprawę wad powstałych z przyczyn", face(SANS, 21, 400))
    sheet.text(80, 652, "tkwiących w produkcie, w ciągu 14 dni od dostarczenia go do serwisu.", face(SANS, 21, 400))
    table(
        sheet,
        80,
        720,
        [("Data naprawy", 220, "left"), ("Opis", 320, "left"), ("Podpis", 174, "left")],
        [["", "", ""], ["", "", ""], ["", "", ""]],
    )
    sheet.text(80, 1080, "Pieczątka i podpis sprzedawcy", face(SANS, 20, 400))
    # The seller's stamp, crooked as stamps are.
    name, address, date = stamp
    mark = Sheet(420, 150)
    mark.rect((6, 6, 414, 144), 4, "stamp")
    mark.text(210, 62, name, face(SANS, 28, 700), "center", "stamp")
    mark.text(210, 100, address, face(SANS, 19, 500), "center", "stamp")
    mark.text(210, 132, date, face(SANS, 22, 650), "center", "stamp")
    turned = mark.layers["stamp"].rotate(-7, expand=True)
    sheet.layers["stamp"].paste(turned, (380, 1000), turned)
    return sheet.printed(OFFICE, LASER_INK, rng)


def policy(
    rng: np.random.Generator,
    *,
    brand: str,
    insurer: str,
    number: str,
    cover: str,
    rows: list[tuple[str, str]],
    notes: list[str],
) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.rect((60, 60, 1180, 250), 3)
        sheet.text(100, 140, brand, face(SERIF, 50, 700))
        sheet.text(100, 190, insurer, face(SANS, 26, 400))
        sheet.text(1140, 140, "POLISA", face(SANS, 44, 800), "right")
        sheet.text(1140, 190, f"nr {number}", face(SANS, 26, 650), "right")
        sheet.text(90, 330, cover, face(SANS, 28, 650))
        for index, (label, value) in enumerate(rows):
            label_value(sheet, 90, 420 + index * 52, label, value, 25, 300)
        for index, note in enumerate(notes):
            sheet.text(90, 860 + index * 32, note, face(SANS, 21, 400))
        sheet.dashes(760, 1150, 1500)
        sheet.text(955, 1532, "Za ubezpieczyciela", face(SANS, 20, 400), "center")

    return a4(rng, draw)


def contract(
    rng: np.random.Generator, *, title: str, subtitle: str, paragraphs: list[str], sides: tuple[str, str]
) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.text(620, 150, title, face(SERIF, 42, 650), "center")
        sheet.text(620, 200, subtitle, face(SERIF, 32, 600), "center")
        for index, text in enumerate(paragraphs):
            sheet.text(110, 320 + index * 44, text, face(SANS, 25, 400))
        for x, side in zip([130, 720], sides, strict=True):
            sheet.dashes(x, x + 390, 1450)
            sheet.text(x + 195, 1482, side, face(SANS, 21, 400), "center")

    return a4(rng, draw)


def bill(
    rng: np.random.Generator,
    *,
    brand: str,
    company: str,
    title: str,
    number: str,
    issued: str,
    receiver: list[str],
    period: str,
    rows: list[list[str]],
    total: str,
    due: str,
    account: str,
) -> np.ndarray:
    """A utility bill. Rows are (item, quantity, gross value)."""

    def draw(sheet: Sheet):
        sheet.text(90, 140, brand, face(SERIF, 56, 700))
        sheet.text(90, 182, company, face(SANS, 22, 400))
        sheet.text(1150, 130, title, face(SANS, 26, 650), "right")
        sheet.text(1150, 170, f"nr {number}", face(SANS, 24, 400), "right")
        label_value(sheet, 760, 220, "Data wystawienia:", issued)
        party(sheet, 90, 280, "ODBIORCA", receiver)
        label_value(sheet, 90, 470, "Okres rozliczeniowy:", period)
        end = table(
            sheet,
            90,
            520,
            [("Pozycja", 560, "left"), ("Ilość", 160, "right"), ("Wartość brutto", 340, "right")],
            rows,
        )
        sheet.rect((90, end + 60, 1150, end + 220), 3)
        sheet.text(130, end + 125, "Do zapłaty", face(SANS, 30, 650))
        sheet.text(1110, end + 125, total, face(SANS, 44, 800), "right")
        label_value(sheet, 130, end + 185, "Termin płatności:", due, 26)
        label_value(sheet, 90, end + 290, "Nr konta do wpłat:", account)

    return a4(rng, draw)


def ticket(rng: np.random.Generator) -> np.ndarray:
    sheet = Sheet(820, 400)
    sheet.rect((14, 14, 806, 386), 3)
    sheet.line(600, 14, 600, 386, 2)
    sheet.text(40, 80, "MUZEUM MIEJSKIE W LIPOWIE", face(SANS, 30, 800))
    sheet.text(40, 130, "BILET WSTĘPU · NORMALNY", face(SANS, 26, 650))
    sheet.text(40, 176, "Wystawa stała „Dawne Lipowo”", face(SANS, 22, 400))
    sheet.text(40, 260, "35,00 zł", face(SANS, 52, 800))
    sheet.text(40, 330, "Data: 08.11.2026   Nr 004517", face(MONO, 22, 500))
    sheet.text(700, 90, "KONTROLA", face(SANS, 20, 650), "center")
    sheet.text(700, 140, "004517", face(MONO, 24, 600), "center")
    sheet.barcode(628, 170, "4517", 170, 2)
    return sheet.printed((247, 236, 196), LASER_INK, rng)
