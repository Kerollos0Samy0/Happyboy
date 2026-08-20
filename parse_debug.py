import fitz
import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"
for f in os.listdir(pdf_dir):
    if "2.pdf" in f:
        path = os.path.join(pdf_dir, f)
        doc = fitz.open(path)
        print(f"--- {f} ---")
        for i in range(1):
            text = doc[0].get_text("text").strip()
            print(repr(text))
        doc.close()
