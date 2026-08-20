import fitz
import sys
import re
import json
import os

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"
pdfs = []
for f in os.listdir(pdf_dir):
    if "2.pdf" in f:
        pdfs.append(os.path.join(pdf_dir, f))

models_map = {}

for path in pdfs:
    doc = fitz.open(path)
    for page in doc:
        text = page.get_text("text").strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if len(lines) < 5:
            continue
        product_name = lines[0]
        model_number = lines[1]
        size_color_line = lines[2]
        barcode = lines[4] if len(lines) > 4 else lines[-1]
        
        # Format: "0 مقاس:لبني اللون:" or "اللون:لبني مقاس:0"
        m = re.search(r'(\d+)\s*مقاس\s*:\s*(.+?)\s*اللون\s*:', size_color_line)
        if not m:
            m = re.search(r'اللون\s*:\s*(.+?)\s*مقاس\s*:\s*(\d+)', size_color_line)
            if m:
                color = m.group(1).strip()
                size = m.group(2).strip()
            else:
                continue
        else:
            size = m.group(1).strip()
            color = m.group(2).strip()
            
        if not barcode.isdigit():
            for l in lines[3:]:
                if l.isdigit():
                    barcode = l
                    break
        if not barcode.isdigit():
            continue
            
        if model_number not in models_map:
            models_map[model_number] = {
                "name": product_name,
                "sizes": set(),
                "colors": {},
                "barcodes": set()
            }
        
        models_map[model_number]["sizes"].add(size)
        models_map[model_number]["colors"][color] = barcode
        models_map[model_number]["barcodes"].add(barcode)

    doc.close()

for m in models_map:
    models_map[m]["sizes"] = list(models_map[m]["sizes"])
    models_map[m]["barcodes"] = list(models_map[m]["barcodes"])

with open("new_parsed.json", "w", encoding="utf-8") as f:
    json.dump(models_map, f, ensure_ascii=False, indent=2)
