import fitz  # PyMuPDF
import json
import os
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"

all_text_by_file = {}

for fname in os.listdir(pdf_dir):
    if fname.lower().endswith('.pdf'):
        path = os.path.join(pdf_dir, fname)
        doc = fitz.open(path)
        pages_text = []
        for i, page in enumerate(doc):
            text = page.get_text("text")
            pages_text.append({"page": i+1, "text": text})
        doc.close()
        all_text_by_file[fname] = pages_text
        print(f"\n{'='*50}")
        print(f"FILE: {fname}")
        print(f"Pages: {len(pages_text)}")
        for p in pages_text[:2]:  # show first 2 pages
            print(f"\n--- Page {p['page']} ---")
            print(p['text'][:600])

# Save all extracted text for inspection
with open(r"E:\Files\Stock HappyBoy\extracted_pdf_text.json", "w", encoding="utf-8") as f:
    json.dump(all_text_by_file, f, ensure_ascii=False, indent=2)

print("\n\nSaved to extracted_pdf_text.json")
