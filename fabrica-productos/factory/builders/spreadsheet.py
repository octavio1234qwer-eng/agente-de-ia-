"""Construye un libro de Excel a partir de una especificación JSON.

Especificación (spreadsheet.json):
{
  "named": {"FC_OBJETIVO": "Configuración!$B$4"},
  "sheets": [
    {"name": "Insumos", "title": "...", "note": "...", "rows": 60, "freeze": "A4",
     "columns": [
        {"header": "Insumo", "width": 26, "input": true},
        {"header": "Costo", "width": 12, "format": "money",
         "formula": "=IFERROR(C{r}/D{r},\"\")"},
        {"header": "Unidad", "validation": ["kg", "l", "pza"]},
        {"header": "Insumo", "validation_range": "=Insumos!$A$4:$A$200"}
     ],
     "sample": [["Tomate", ...]],
     "cells": [{"ref": "B4", "value": 0.3, "format": "pct", "input": true}],
     "conditional": [{"range": "E4:E200", "op": "greaterThan", "value": "FC_OBJETIVO", "color": "F8D7DA"}]
    }
  ]
}
Las columnas con fórmula se rellenan en todas las filas; "{r}" se sustituye por la fila.
Celdas de captura en amarillo claro; celdas calculadas protegidas visualmente en gris.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

FORMATS = {
    "money": '"$"#,##0.00',
    "pct": "0.0%",
    "int": "#,##0",
    "num": "#,##0.000",
    "date": "dd/mm/yyyy",
    "text": "@",
}
INPUT_FILL = PatternFill("solid", fgColor="FFF8DC")
CALC_FILL = PatternFill("solid", fgColor="F2F2F2")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def build(product: dict, spec_path: Path, out: Path) -> Path:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    brand = product.get("brand", {})
    primary = brand.get("primary", "#1F4E5F").lstrip("#")
    head_fill = PatternFill("solid", fgColor=primary)
    wb = Workbook()
    wb.remove(wb.active)

    for sh in spec["sheets"]:
        ws = wb.create_sheet(sh["name"])
        ws.sheet_view.showGridLines = False
        ws["A1"] = sh.get("title", sh["name"])
        ws["A1"].font = Font(bold=True, size=15, color=primary)
        if sh.get("note"):
            ws["A2"] = sh["note"]
            ws["A2"].font = Font(italic=True, size=9, color="595959")
        if "text" in sh:  # hoja de instrucciones
            ws.column_dimensions["A"].width = sh.get("width", 110)
            for k, line in enumerate(sh["text"], start=4):
                cell = ws.cell(row=k, column=1, value=line)
                cell.alignment = Alignment(wrap_text=True, vertical="top")
                if line.isupper() or line.endswith(":"):
                    cell.font = Font(bold=True, color=primary)
            continue

        cols = sh.get("columns", [])
        header_row = sh.get("header_row", 3)
        first = header_row + 1
        last = first + sh.get("rows", 50) - 1
        for j, col in enumerate(cols, start=1):
            cell = ws.cell(row=header_row, column=j, value=col["header"])
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = head_fill
            cell.alignment = Alignment(wrap_text=True, vertical="center", horizontal="center")
            cell.border = BORDER
            letter = cell.column_letter
            ws.column_dimensions[letter].width = col.get("width", 14)
            if col.get("validation") or col.get("validation_range"):
                formula = (col.get("validation_range") or
                           '"' + ",".join(col["validation"]) + '"')
                dv = DataValidation(type="list", formula1=formula, allow_blank=True)
                dv.error = "Elige un valor de la lista."
                ws.add_data_validation(dv)
                dv.add(f"{letter}{first}:{letter}{last}")
        if cols:
            ws.row_dimensions[header_row].height = 32

        samples = sh.get("sample", [])
        for r in range(first, last + 1):
            sample = samples[r - first] if r - first < len(samples) else None
            for j, col in enumerate(cols, start=1):
                cell = ws.cell(row=r, column=j)
                if "formula" in col:
                    cell.value = col["formula"].replace("{r}", str(r))
                    cell.fill = CALC_FILL
                else:
                    if sample is not None and j - 1 < len(sample) and sample[j - 1] is not None:
                        val = sample[j - 1]
                        if col.get("format") == "date" and isinstance(val, str):
                            val = datetime.strptime(val, "%Y-%m-%d")
                        cell.value = val
                    cell.fill = INPUT_FILL
                if col.get("format"):
                    cell.number_format = FORMATS[col["format"]]
                cell.border = BORDER

        for extra in sh.get("cells", []):
            cell = ws[extra["ref"]]
            cell.value = extra.get("value")
            if extra.get("format"):
                cell.number_format = FORMATS[extra["format"]]
            if extra.get("bold"):
                cell.font = Font(bold=True, color=primary)
            if extra.get("input"):
                cell.fill = INPUT_FILL
                cell.border = BORDER
            elif extra.get("calc"):
                cell.fill = CALC_FILL
                cell.border = BORDER
            if extra.get("validation"):
                dv = DataValidation(type="list", formula1='"' + ",".join(extra["validation"]) + '"')
                ws.add_data_validation(dv)
                dv.add(extra["ref"])
            if extra.get("width"):
                ws.column_dimensions[extra["ref"].rstrip("0123456789")].width = extra["width"]

        for cf in sh.get("conditional", []):
            fill = PatternFill("solid", fgColor=cf["color"])
            if "formula" in cf:
                ws.conditional_formatting.add(cf["range"], FormulaRule(formula=[cf["formula"]], fill=fill))
            else:
                ws.conditional_formatting.add(
                    cf["range"], CellIsRule(operator=cf["op"], formula=[str(cf["value"])], fill=fill))
        if sh.get("freeze"):
            ws.freeze_panes = sh["freeze"]

    for name, ref in spec.get("named", {}).items():
        wb.defined_names[name] = DefinedName(name, attr_text=ref)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    return out
