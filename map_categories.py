import os
import fitz
import re
import json

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"
models_cat = {}

for fname in os.listdir(pdf_dir):
    if not fname.lower().endswith('.pdf'):
        continue
        
    # Determine categories from fname
    main_cat = ""
    sub_cat = ""
    gender = ""
    
    name = fname.replace('.pdf', '')
    
    if name == 'موديل 600' or name == '600':
        main_cat = "بناتي"
        sub_cat = "وسط"
    elif "رياضي" in name:
        main_cat = "رياضي"
        if "وسط" in name:
            sub_cat = "وسط"
        elif "محير" in name:
            sub_cat = "محير"
    elif "سمر" in name:
        main_cat = "سمر ميلتون"
        if "ولد" in name or "اولادي" in name:
            gender = "ولادي"
        else:
            gender = "بناتي"
            
        if "وسط" in name:
            sub_cat = "وسط"
        elif "محير" in name or "5045" in name:
            sub_cat = "محير"
    elif "بيبي" in name:
        if "ولد" in name or "اولادي" in name:
            main_cat = "ولادي"
        else:
            main_cat = "بناتي"
        sub_cat = "بيبي"
    else:
        if "ولد" in name or "اولادي" in name:
            main_cat = "ولادي"
        else:
            main_cat = "بناتي"
            
        if "وسط" in name:
            sub_cat = "وسط"
        elif "محير" in name:
            sub_cat = "محير"
            
    # Now read the PDF to get all model numbers in this file
    path = os.path.join(pdf_dir, fname)
    doc = fitz.open(path)
    for page in doc:
        text = page.get_text("text").strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if len(lines) < 5: continue
        
        model_number = lines[1]
        if not model_number.isdigit(): continue
        
        models_cat[model_number] = {
            "mainCategory": main_cat,
            "subCategory": sub_cat,
            "gender": gender,
            "sourceFile": fname
        }
    doc.close()

with open("model_categories.json", "w", encoding="utf-8") as f:
    json.dump(models_cat, f, ensure_ascii=False, indent=2)
    
print(f"Generated categories for {len(models_cat)} models.")
