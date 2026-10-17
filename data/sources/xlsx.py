"""Read cached OOXML worksheet values without an optional Excel engine.

Returns stored cell values only; formulas are not evaluated. Census files are
published tables, and missing/cached-empty cells remain empty rather than zero.
"""
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def worksheet_rows(path, sheet: str = "sheet1.xml") -> list[dict[str, str]]:
    with ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        rows = []
        for row in ET.fromstring(archive.read("xl/worksheets/" + sheet)).findall(".//s:row", NS):
            values = {}
            for cell in row:
                value = cell.find("s:v", NS)
                text = value.text if value is not None and value.text is not None else ""
                if cell.attrib.get("t") == "s":
                    text = strings[int(text)]
                elif cell.attrib.get("t") == "inlineStr":
                    text = "".join(cell.find("s:is", NS).itertext())
                values[re.sub(r"\d", "", cell.attrib["r"])] = text
            rows.append(values)
        return rows
