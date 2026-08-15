import fitz  # PyMuPDF
import json
import os
import sys
import re
sys.stdout.reconfigure(encoding='utf-8')

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"

# Dict: modelNumber -> { name, sizes: set, colors: { colorName: barcode }, barcodes: set }
models_map = {}

for fname in sorted(os.listdir(pdf_dir)):
    if not fname.lower().endswith('.pdf'):
        continue
    path = os.path.join(pdf_dir, fname)
    doc = fitz.open(path)
    print(f"\nProcessing: {fname} ({len(doc)} pages)")
    
    for page in doc:
        text = page.get_text("text").strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        
        if len(lines) < 5:
            continue
        
        # Format per page (barcode label):
        # Line 0: product name   (e.g. سوت بيبي كابيشو)
        # Line 1: model number   (e.g. 10)
        # Line 2: size+color     (e.g. 2 مقاس:اسود اللون:)  or  (اسود اللون: 2 مقاس:)
        # Line 3: brand          (e.g. Happy Boy)
        # Line 4: barcode        (e.g. 31)
        
        product_name = lines[0]
        model_number = lines[1]
        size_color_line = lines[2]
        barcode = lines[4] if len(lines) > 4 else lines[-1]
        
        # Parse size and color from line like: "2 مقاس:اسود اللون:" or "2 مقاس:موف اللون:"
        # Pattern: {size} مقاس:{color} اللون:
        m = re.search(r'(\d+)\s*مقاس\s*:\s*(.+?)\s*اللون\s*:', size_color_line)
        if not m:
            # Try reversed: اللون:{color} مقاس:{size}
            m = re.search(r'اللون\s*:\s*(.+?)\s*مقاس\s*:\s*(\d+)', size_color_line)
            if m:
                color = m.group(1).strip()
                size = m.group(2).strip()
            else:
                print(f"  SKIP (can't parse): {size_color_line!r}")
                continue
        else:
            size = m.group(1).strip()
            color = m.group(2).strip()
        
        # Validate barcode is numeric
        if not barcode.isdigit():
            # barcode might be on a different line
            for l in lines[3:]:
                if l.isdigit():
                    barcode = l
                    break
        
        if not barcode.isdigit():
            print(f"  SKIP (no barcode): {lines}")
            continue
        
        if model_number not in models_map:
            models_map[model_number] = {
                "name": product_name,
                "sizes": set(),
                "colors": {},   # color -> barcode
                "barcodes": set()
            }
        
        entry = models_map[model_number]
        entry["sizes"].add(size)
        entry["colors"][color] = barcode
        entry["barcodes"].add(barcode)
    
    doc.close()

# Convert to list
products = []
for model_num in sorted(models_map.keys(), key=lambda x: int(x) if x.isdigit() else 9999):
    entry = models_map[model_num]
    products.append({
        "modelNumber": model_num,
        "name": entry["name"],
        "sizes": sorted(list(entry["sizes"]), key=lambda x: int(x) if x.isdigit() else x),
        "colors": [{"name": c, "barcode": b} for c, b in sorted(entry["colors"].items())],
        "barcodes": sorted(list(entry["barcodes"]), key=lambda x: int(x) if x.isdigit() else x),
        "price": 0,
        "quantity": 0
    })

print(f"\n{'='*50}")
print(f"Total unique models found: {len(products)}")
for p in products:
    print(f"  Moديل {p['modelNumber']}: {p['name']} | مقاسات: {p['sizes']} | ألوان: {len(p['colors'])} | باركودات: {p['barcodes']}")

# Save to JSON file
out_path = r"E:\Files\Stock HappyBoy\models_data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(products)} models to {out_path}")
