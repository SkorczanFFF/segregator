"""The demo's fictional documents: what each says, how it was photographed and the fields the app should read.

Every name, address and number here is made up.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import partial

import numpy as np

from layouts import RECEIPT_MM, SHEET_MM, bill, contract, invoice, policy, receipt, ticket, warranty


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


# The person the A4 documents are made out to.
BUYER = ["Anna Nowak", "ul. Klonowa 7/12", "30-001 Zielonka"]

FUEL = [
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
]

GROCERIES = [
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
]

APPLIANCES = [
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
]

DOCUMENTS = [
    Document(
        "paragon-paliwo",
        {
            "type": "receipt",
            "subtype": "fuel",
            "title": "Tankowanie",
            "issuer": "Zielony Szlak",
            "amount": 24999,
            "docDate": "2026-11-03",
        },
        partial(receipt, FUEL),
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
        partial(receipt, GROCERIES),
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
        partial(receipt, APPLIANCES),
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
        partial(
            invoice,
            number="FV/0153/11/2026",
            dates=[("Data wystawienia:", "14.11.2026"), ("Data sprzedaży:", "14.11.2026"), ("Miejsce:", "Lipowo")],
            seller=["Hurtownia Elektro-Mont sp. z o.o.", "ul. Przemysłowa 18", "41-500 Lipowo", "NIP 634-210-55-81"],
            buyer=BUYER,
            items=[["1", 'Laptop 14" 16 GB RAM, 512 GB SSD', "1 szt.", "3 739,02", "23%", "4 599,00"]],
            rates=[["23%", "3 739,02", "859,98", "4 599,00"], ["Razem", "3 739,02", "859,98", "4 599,00"]],
            total="4 599,00",
            words="cztery tysiące pięćset dziewięćdziesiąt dziewięć złotych 00/100",
            payment=[
                ("Sposób płatności:", "przelew"),
                ("Termin płatności:", "28.11.2026"),
                ("Nr konta:", "00 1020 0000 0000 0000 0000 0000"),
            ],
        ),
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
        partial(
            warranty,
            maker="CafeLine sp. z o.o., ul. Kawowa 2, 60-001 Lipowo",
            rows=[
                ("Produkt:", "Ekspres do kawy CafeLine 2000"),
                ("Nr seryjny:", "CL2000-58213"),
                ("Data sprzedaży:", "05.10.2026"),
                ("Okres gwarancji:", "24 miesiące"),
                ("Gwarancja ważna do:", "05.10.2028"),
            ],
            stamp=("SKLEP AGD SP. Z O.O.", "ul. Przykładowa 1, 00-000 Miasto", "05.10.2026"),
        ),
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
            "issuer": "Bezpieczna Droga",
            "amount": 81200,
            "docDate": "2026-11-02",
            "dueDate": "2027-11-01",
        },
        partial(
            policy,
            brand="BEZPIECZNA DROGA",
            insurer="Towarzystwo Ubezpieczeń S.A.",
            number="OC/2026/774512",
            cover="Ubezpieczenie obowiązkowe OC posiadaczy pojazdów mechanicznych",
            rows=[
                ("Ubezpieczający:", ", ".join(BUYER)),
                ("Pojazd:", "samochód osobowy, nr rej. ZL 4K128"),
                ("Data zawarcia:", "02.11.2026"),
                ("Okres ubezpieczenia:", "od 02.11.2026 do 01.11.2027"),
                ("Suma gwarancyjna:", "zgodnie z ustawą"),
                ("Składka roczna:", "812,00 zł"),
                ("Płatność:", "jednorazowo, przelewem do 16.11.2026"),
            ],
            notes=[
                "Polisa potwierdza zawarcie umowy ubezpieczenia na warunkach określonych w ustawie",
                "o ubezpieczeniach obowiązkowych. Szkodę zgłosisz pod numerem 800 000 000.",
            ],
        ),
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
        partial(
            contract,
            title="UMOWA O ŚWIADCZENIE USŁUG",
            subtitle="TELEKOMUNIKACYJNYCH nr NF/2026/09/3381",
            paragraphs=[
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
            ],
            sides=("Operator", "Abonent"),
        ),
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
        partial(
            bill,
            brand="Energia Dom",
            company="Energia Dom sp. z o.o., ul. Prądowa 9, 41-500 Lipowo",
            title="Rachunek za energię elektryczną",
            number="EN/11/2026/88412",
            issued="05.11.2026",
            receiver=BUYER,
            period="01.10.2026 – 31.10.2026",
            rows=[
                ["Energia czynna", "221 kWh", "133,08 zł"],
                ["Opłata dystrybucyjna zmienna", "221 kWh", "48,60 zł"],
                ["Opłata stała sieciowa", "1 mies.", "18,12 zł"],
                ["Opłata mocowa", "1 mies.", "10,05 zł"],
                ["Opłata handlowa", "1 mies.", "4,95 zł"],
            ],
            total="214,80 zł",
            due="25.11.2026",
            account="00 1140 0000 0000 0000 0000 0000",
        ),
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
