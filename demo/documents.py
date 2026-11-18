"""The demo's fictional documents: what each says, how it is laid out, and the fields the app should read from it.

Every name, address and number here is made up. The receipts follow the layouts of real Polish fiscal printers:
the seller and tax number, PARAGON FISKALNY, items with their tax letter, the tax summary, the total, the payment
and the footer with the till, the time and the printer's number.
"""

from collections.abc import Callable
from dataclasses import dataclass

import cv2
import numpy as np

from paper import MONO, SANS, SERIF, Sheet, face

THERMAL = (243, 244, 240)
OFFICE = (246, 245, 241)
THERMAL_INK = (38, 38, 46)
LASER_INK = (24, 24, 28)


# A drawn sheet has 150 dots to an inch.
SHEET_MM = 150 / 25.4


@dataclass
class Document:
    slug: str
    # As the app stores them: the amount in grosze, dates as YYYY-MM-DD.
    fields: dict
    draw: Callable[[np.random.Generator], np.ndarray]
    # How it was photographed: what it lies on, its turn in degrees and how creased it is, 0 to 1.
    ground: str
    turn: float
    crease: float
    # Pixels of the drawn paper to a millimetre.
    mm: float = SHEET_MM


# A roll 80 mm wide fits 40 characters a line.
COLUMNS = 40
SIZE = 30
CHAR = SIZE * 0.6
MARGIN = 40
# Thermal printers draw narrow letters.
SQUEEZE = 0.82
ROLL_WIDTH = round(COLUMNS * CHAR + 2 * MARGIN)
RECEIPT_MM = ROLL_WIDTH * SQUEEZE / 80


def receipt(rows: list[tuple], rng: np.random.Generator) -> np.ndarray:
    """A till roll. Each row is (kind, ...): ("center" or "left", text, scale?, weight?), ("pair", left, right,
    scale?, weight?), ("rule", "dots"?), ("space", pixels) or ("barcode", digits)."""
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
    image = sheet.printed(THERMAL, THERMAL_INK, rng, fade=0.35)
    return cv2.resize(image, (round(width * SQUEEZE), sheet.height), interpolation=cv2.INTER_AREA)


def fuel_receipt(rng: np.random.Generator) -> np.ndarray:
    return receipt(
        [
            ("center", "ZIELONY SZLAK", 1.7, 800),
            ("space", 10),
            ("center", "PALIWA ZIELONY SZLAK SP. Z O.O."),
            ("center", "UL. LEŚNA 12, 41-500 LIPOWO"),
            ("center", "STACJA PALIW NR 117"),
            ("center", "BDO 000123456"),
            ("pair", "NIP: 951-204-77-13", "W1173"),
            ("center", "PARAGON FISKALNY", 1.25, 800),
            ("pair", "BENZYNA 95 (A) 38,52*6,49", ""),
            ("pair", "", "249,99A"),
            ("pair", "Sprzedaż opodatkowana A:", "249,99"),
            ("pair", "Kwota PTU A 23%", "46,75"),
            ("pair", "SUMA PTU", "46,75"),
            ("pair", "SUMA:", "PLN 249,99", 1.3, 800),
            ("pair", "DO ZAPŁATY:", "249,99", 1.3, 800),
            ("center", "ROZLICZENIE PŁATNOŚCI"),
            ("pair", "Karta:", "249,99"),
            ("rule",),
            ("pair", "F0412 #  3\\K1 Kasjer:07", "03-11-2026 07:42"),
            ("center", "7A1C99E04B2D5F8813C6AE90D47F2B10"),
            ("center", "ZEH 2101234567"),
            ("rule",),
            ("center", "DZIĘKUJEMY I ZAPRASZAMY PONOWNIE"),
            ("barcode", "1170342611"),
        ],
        rng,
    )


def grocery_receipt(rng: np.random.Generator) -> np.ndarray:
    return receipt(
        [
            ("center", "SKLEP SPOŻYWCZY „POD LIPĄ”", 1.15, 800),
            ("center", "Elżbieta Wiśniewska"),
            ("center", "ul. Źródlana 3, 05-850 Lipowo"),
            ("center", "NIP 527-118-40-92"),
            ("space", 6),
            ("pair", "15.11.2026", "wydr. 4471"),
            ("center", "PARAGON FISKALNY", 1.25, 800),
            ("rule", "dots"),
            ("left", "Chleb żytni 500g"),
            ("pair", "", "1 szt. x6,49   6,49 C"),
            ("left", "Masło ekstra 200g"),
            ("pair", "", "1 szt. x8,99   8,99 C"),
            ("left", "Woda mineralna 1,5l"),
            ("pair", "", "2 szt. x1,89   3,78 C"),
            ("left", "Jabłka Ligol luz"),
            ("pair", "", "1,236 kg x4,99   6,17 C"),
            ("left", "Kawa ziarnista 250g"),
            ("pair", "", "1 szt. x18,62  18,62 A"),
            ("rule", "dots"),
            ("pair", "Sprzedaż opodatk. A", "18,62"),
            ("pair", "Kwota A 23,00%", "3,48"),
            ("pair", "Sprzedaż opodatk. C", "25,43"),
            ("pair", "Kwota C 5,00%", "1,21"),
            ("pair", "Łączna kwota PTU", "4,69"),
            ("pair", "SUMA PLN", "44,05", 1.4, 800),
            ("rule", "dots"),
            # The deposit on bottles counts after the sum, so what was paid is more than the sum.
            ("left", "OPAKOWANIA ZWROTNE WYDANIA"),
            ("pair", "  Kaucja za butelkę", "2 x0,50 1,00"),
            ("pair", "OPAKOWANIA ZWROTNE SUMA", "1,00"),
            ("pair", "DO ZAPŁATY", "45,05 PLN", 1.4, 800),
            ("rule", "dots"),
            ("pair", "Gotówka", "50,00"),
            ("pair", "Reszta", "4,95"),
            ("pair", "#3 Kasa 1  Kierownik", "18:21"),
            ("center", "B6E0 71FA 3C52 9D04 8E11 AF27 5C30 D9B2"),
            ("center", "BFD 2001198734"),
        ],
        rng,
    )


def appliance_receipt(rng: np.random.Generator) -> np.ndarray:
    return receipt(
        [
            ("space", 10),
            ("center", "SKLEP AGD SP. Z O.O.", 1.8, 500),
            ("center", "UL. PRZYKŁADOWA 1"),
            ("center", "00-000 MIASTO"),
            ("center", "NIP: 000-000-00-00"),
            ("pair", "", "nr dok.000004213"),
            ("center", "PARAGON FISKALNY", 1.4, 800),
            ("left", "Pralka 8 kg WX-800"),
            ("pair", "", "1 szt * 1899,00 = 1899,00 A"),
            ("pair", "Wniesienie", "1 usł * 0,00 = 0,00 A"),
            ("pair", "Sp.op.A", "1899,00"),
            ("pair", "PTU A=23,00%", "355,10"),
            ("pair", "SUMA PTU", "355,10"),
            ("pair", "SUMA PLN", "1899,00", 1.5, 800),
            ("center", "ROZLICZENIE PŁATNOŚCI"),
            ("pair", "KARTA PŁATNICZA PLN", "1899,00"),
            ("pair", "00042/0131 #01/-", "12.11.2026 14:32"),
            ("center", "C41E0B7752A9F3D0186E4B2A9C70D5E3"),
            ("center", "EBI 2101998877"),
            ("center", "Nr sys. PA 312/11/2026"),
        ],
        rng,
    )


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


def invoice(rng: np.random.Generator) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.text(90, 150, "Faktura VAT", face(SERIF, 54, 600))
        sheet.text(90, 200, "nr FV/0153/11/2026", face(SANS, 28, 650))
        label_value(sheet, 760, 130, "Data wystawienia:", "14.11.2026")
        label_value(sheet, 760, 166, "Data sprzedaży:", "14.11.2026")
        label_value(sheet, 760, 202, "Miejsce:", "Lipowo")
        party(
            sheet,
            90,
            300,
            "SPRZEDAWCA",
            ["Hurtownia Elektro-Mont sp. z o.o.", "ul. Przemysłowa 18", "41-500 Lipowo", "NIP 634-210-55-81"],
        )
        party(sheet, 680, 300, "NABYWCA", ["Anna Nowak", "ul. Klonowa 7/12", "30-001 Zielonka"])
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
            [["1", 'Laptop 14" 16 GB RAM, 512 GB SSD', "1 szt.", "3 739,02", "23%", "4 599,00"]],
        )
        end = table(
            sheet,
            610,
            end + 40,
            [("Stawka", 100, "left"), ("Netto", 150, "right"), ("VAT", 150, "right"), ("Brutto", 140, "right")],
            [["23%", "3 739,02", "859,98", "4 599,00"], ["Razem", "3 739,02", "859,98", "4 599,00"]],
        )
        sheet.text(90, end + 90, "Do zapłaty: 4 599,00 PLN", face(SANS, 34, 700))
        label_value(sheet, 90, end + 140, "Słownie:", "cztery tysiące pięćset dziewięćdziesiąt dziewięć złotych 00/100")
        label_value(sheet, 90, end + 190, "Sposób płatności:", "przelew")
        label_value(sheet, 90, end + 226, "Termin płatności:", "28.11.2026")
        label_value(sheet, 90, end + 262, "Nr konta:", "00 1020 0000 0000 0000 0000 0000")
        for x, title in [(120, "Osoba upoważniona do odbioru"), (700, "Osoba upoważniona do wystawienia")]:
            sheet.dashes(x, x + 420, 1560)
            sheet.text(x + 210, 1592, title, face(SANS, 20, 400), "center")

    return a4(rng, draw)


def warranty(rng: np.random.Generator) -> np.ndarray:
    sheet = Sheet(874, 1240)
    sheet.rect((30, 30, 844, 1210), 3)
    sheet.text(437, 130, "KARTA GWARANCYJNA", face(SERIF, 52, 650), "center")
    sheet.text(437, 180, "CafeLine sp. z o.o., ul. Kawowa 2, 60-001 Lipowo", face(SANS, 22, 400), "center")
    rows = [
        ("Produkt:", "Ekspres do kawy CafeLine 2000"),
        ("Nr seryjny:", "CL2000-58213"),
        ("Data sprzedaży:", "05.10.2026"),
        ("Okres gwarancji:", "24 miesiące"),
        ("Gwarancja ważna do:", "05.10.2028"),
    ]
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
    stamp = Sheet(420, 150)
    stamp.rect((6, 6, 414, 144), 4, "stamp")
    stamp.text(210, 62, "SKLEP AGD SP. Z O.O.", face(SANS, 28, 700), "center", "stamp")
    stamp.text(210, 100, "ul. Przykładowa 1, 00-000 Miasto", face(SANS, 19, 500), "center", "stamp")
    stamp.text(210, 132, "05.10.2026", face(SANS, 22, 650), "center", "stamp")
    turned = stamp.layers["stamp"].rotate(-7, expand=True)
    sheet.layers["stamp"].paste(turned, (380, 1000), turned)
    return sheet.printed(OFFICE, LASER_INK, rng)


def policy(rng: np.random.Generator) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.rect((60, 60, 1180, 250), 3)
        sheet.text(100, 140, "BEZPIECZNA DROGA", face(SERIF, 50, 700))
        sheet.text(100, 190, "Towarzystwo Ubezpieczeń S.A.", face(SANS, 26, 400))
        sheet.text(1140, 140, "POLISA", face(SANS, 44, 800), "right")
        sheet.text(1140, 190, "nr OC/2026/774512", face(SANS, 26, 650), "right")
        sheet.text(90, 330, "Ubezpieczenie obowiązkowe OC posiadaczy pojazdów mechanicznych", face(SANS, 28, 650))
        rows = [
            ("Ubezpieczający:", "Anna Nowak, ul. Klonowa 7/12, 30-001 Zielonka"),
            ("Pojazd:", "samochód osobowy, nr rej. ZL 4K128"),
            ("Data zawarcia:", "02.11.2026"),
            ("Okres ubezpieczenia:", "od 02.11.2026 do 01.11.2027"),
            ("Suma gwarancyjna:", "zgodnie z ustawą"),
            ("Składka roczna:", "812,00 zł"),
            ("Płatność:", "jednorazowo, przelewem do 16.11.2026"),
        ]
        for index, (label, value) in enumerate(rows):
            label_value(sheet, 90, 420 + index * 52, label, value, 25, 300)
        sheet.text(
            90,
            860,
            "Polisa potwierdza zawarcie umowy ubezpieczenia na warunkach określonych w ustawie",
            face(SANS, 21, 400),
        )
        sheet.text(
            90, 892, "o ubezpieczeniach obowiązkowych. Szkodę zgłosisz pod numerem 800 000 000.", face(SANS, 21, 400)
        )
        sheet.dashes(760, 1150, 1500)
        sheet.text(955, 1532, "Za ubezpieczyciela", face(SANS, 20, 400), "center")

    return a4(rng, draw)


def contract(rng: np.random.Generator) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.text(620, 150, "UMOWA O ŚWIADCZENIE USŁUG", face(SERIF, 42, 650), "center")
        sheet.text(620, 200, "TELEKOMUNIKACYJNYCH nr NF/2026/09/3381", face(SERIF, 32, 600), "center")
        paragraphs = [
            "zawarta 01.09.2026 w Lipowie pomiędzy Nowa Fala Światłowód sp. z o.o.,",
            "ul. Światłowodowa 1, 41-500 Lipowo, NIP 498-302-11-47, zwaną Operatorem,",
            "a Anną Nowak, ul. Klonowa 7/12, 30-001 Zielonka, zwaną Abonentem.",
            "",
            "§ 1. Operator zapewnia dostęp do internetu światłowodowego 1 Gb/s",
            "pod adresem Abonenta.",
            "§ 2. Umowa obowiązuje od 01.09.2026 do 31.08.2028, czyli 24 miesiące.",
            "§ 3. Abonament wynosi 59,99 zł brutto miesięcznie, płatny do 15. dnia",
            "każdego miesiąca.",
            "§ 4. Po okresie z § 2 umowa przechodzi na czas nieokreślony,",
            "chyba że Abonent ją wypowie.",
        ]
        for index, text in enumerate(paragraphs):
            sheet.text(110, 320 + index * 44, text, face(SANS, 25, 400))
        for x, title in [(130, "Operator"), (720, "Abonent")]:
            sheet.dashes(x, x + 390, 1450)
            sheet.text(x + 195, 1482, title, face(SANS, 21, 400), "center")

    return a4(rng, draw)


def bill(rng: np.random.Generator) -> np.ndarray:
    def draw(sheet: Sheet):
        sheet.text(90, 140, "Energia Dom", face(SERIF, 56, 700))
        sheet.text(90, 182, "Energia Dom sp. z o.o., ul. Prądowa 9, 41-500 Lipowo", face(SANS, 22, 400))
        sheet.text(1150, 130, "Rachunek za energię elektryczną", face(SANS, 26, 650), "right")
        sheet.text(1150, 170, "nr EN/11/2026/88412", face(SANS, 24, 400), "right")
        label_value(sheet, 760, 220, "Data wystawienia:", "05.11.2026")
        party(sheet, 90, 280, "ODBIORCA", ["Anna Nowak", "ul. Klonowa 7/12", "30-001 Zielonka"])
        label_value(sheet, 90, 470, "Okres rozliczeniowy:", "01.10.2026 – 31.10.2026")
        end = table(
            sheet,
            90,
            520,
            [("Pozycja", 560, "left"), ("Ilość", 160, "right"), ("Wartość brutto", 340, "right")],
            [
                ["Energia czynna", "221 kWh", "133,08 zł"],
                ["Opłata dystrybucyjna zmienna", "221 kWh", "48,60 zł"],
                ["Opłata stała sieciowa", "1 mies.", "18,12 zł"],
                ["Opłata mocowa", "1 mies.", "10,05 zł"],
                ["Opłata handlowa", "1 mies.", "4,95 zł"],
            ],
        )
        sheet.rect((90, end + 60, 1150, end + 220), 3)
        sheet.text(130, end + 125, "Do zapłaty", face(SANS, 30, 650))
        sheet.text(1110, end + 125, "214,80 zł", face(SANS, 44, 800), "right")
        label_value(sheet, 130, end + 185, "Termin płatności:", "25.11.2026", 26)
        label_value(sheet, 90, end + 290, "Nr konta do wpłat:", "00 1140 0000 0000 0000 0000 0000")

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


DOCUMENTS = [
    Document(
        "paragon-paliwo",
        {
            "type": "receipt",
            "subtype": "fuel",
            "title": "Tankowanie",
            "issuer": "Paliwa Zielony Szlak",
            "amount": 24999,
            "docDate": "2026-11-03",
        },
        fuel_receipt,
        "dashboard",
        7,
        0.5,
        mm=RECEIPT_MM,
    ),
    Document(
        "paragon-zakupy",
        {
            "type": "receipt",
            "subtype": "groceries",
            "title": "Zakupy spożywcze",
            "issuer": "Sklep Spożywczy Pod Lipą",
            "amount": 4505,
            "docDate": "2026-11-15",
        },
        grocery_receipt,
        "print",
        -14,
        0.45,
        mm=RECEIPT_MM,
    ),
    Document(
        "paragon-agd",
        {
            "type": "receipt",
            "subtype": "appliances",
            "title": "Pralka 8 kg",
            "issuer": "Sklep AGD",
            "amount": 189900,
            "docDate": "2026-11-12",
        },
        appliance_receipt,
        "granite",
        3,
        0.35,
        mm=RECEIPT_MM,
    ),
    Document(
        "faktura",
        {
            "type": "invoice",
            "subtype": "electronics",
            "title": "Laptop 14",
            "issuer": "Hurtownia Elektro-Mont",
            "amount": 459900,
            "docDate": "2026-11-14",
            "dueDate": "2026-11-28",
        },
        invoice,
        "wood",
        -3,
        0.15,
    ),
    Document(
        "gwarancja",
        {
            "type": "warranty",
            "subtype": "appliances",
            "title": "Ekspres do kawy CafeLine 2000",
            "issuer": "CafeLine",
            "docDate": "2026-10-05",
            "dueDate": "2028-10-05",
        },
        warranty,
        "desk",
        4,
        0.2,
    ),
    Document(
        "polisa",
        {
            "type": "policy",
            "subtype": "car",
            "title": "OC samochodu",
            "issuer": "Bezpieczna Droga TU",
            "amount": 81200,
            "docDate": "2026-11-02",
            "dueDate": "2027-11-01",
        },
        policy,
        "linen",
        -2,
        0.1,
    ),
    Document(
        "umowa",
        {
            "type": "contract",
            "subtype": "phone_internet",
            "title": "Internet światłowodowy",
            "issuer": "Nowa Fala Światłowód",
            "amount": 5999,
            "docDate": "2026-09-01",
            "dueDate": "2028-08-31",
        },
        contract,
        "checks",
        2,
        0.1,
    ),
    Document(
        "rachunek",
        {
            "type": "bill",
            "subtype": "electricity",
            "title": "Prąd",
            "issuer": "Energia Dom",
            "amount": 21480,
            "docDate": "2026-11-05",
            "dueDate": "2026-11-25",
        },
        bill,
        "wood",
        -4,
        0.2,
    ),
    Document(
        "bilet",
        {
            "type": "other",
            "title": "Bilet do muzeum",
            "issuer": "Muzeum Miejskie w Lipowie",
            "amount": 3500,
            "docDate": "2026-11-08",
        },
        ticket,
        "slate",
        -9,
        0.3,
    ),
]
