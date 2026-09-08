import os
import re
import fitz
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

pdf_dir = r"E:\Files\Stock HappyBoy\Barcode"
out_dir = r"E:\Files\Stock HappyBoy\Barcodes_Structured"

def get_category_path(filename):
    name = filename.replace('.pdf', '')
    
    # Explicit user rules
    if '600' in name:
        return os.path.join('2. بناتي', 'وسط')
    if '5045' in name:
        return os.path.join('4. سمر ميلتون', 'بناتي', 'وسط')

    if 'سمر' in name:
        main = '4. سمر ميلتون'
        sub1 = 'بناتي' if ('بنت' in name or 'بناتي' in name) else 'اولادي'
        if 'وسط' in name: sub2 = 'وسط'
        elif 'محير' in name: sub2 = 'محير'
        else: sub2 = 'غير_محدد'
        return os.path.join(main, sub1, sub2)
    elif 'رياضي' in name:
        main = '3. رياضي'
        if 'وسط' in name: sub = 'وسط'
        elif 'محير' in name: sub = 'محير'
        else: sub = 'غير_محدد'
        return os.path.join(main, sub)
    elif 'بنت' in name or 'بناتي' in name:
        main = '2. بناتي'
        if 'بيبي' in name: sub = 'بيبي'
        elif 'وسط' in name: sub = 'وسط'
        elif 'محير' in name: sub = 'محير'
        else: sub = 'غير_محدد'
        return os.path.join(main, sub)
    else: 
        main = '1. اولادي'
        if 'بيبي' in name: sub = 'بيبي'
        elif 'وسط' in name: sub = 'وسط'
        elif 'محير' in name: sub = 'محير'
        else: sub = 'غير_محدد'
        return os.path.join(main, sub)

categorized_barcodes = {}

for fname in os.listdir(pdf_dir):
    if not fname.lower().endswith('.pdf'):
        continue
    
    cat_path = get_category_path(fname)
    if cat_path not in categorized_barcodes:
        categorized_barcodes[cat_path] = set()
        
    path = os.path.join(pdf_dir, fname)
    doc = fitz.open(path)
    
    for page in doc:
        text = page.get_text("text").strip()
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        if len(lines) < 5:
            continue
            
        model_number = lines[1]
        size_color_line = lines[2]
        barcode = lines[4] if len(lines) > 4 else lines[-1]
        
        if not barcode.isdigit():
            for l in lines[3:]:
                if l.isdigit():
                    barcode = l
                    break
        
        if not barcode.isdigit():
            continue
            
        categorized_barcodes[cat_path].add((model_number, barcode))
    doc.close()

writer = ImageWriter()
options = {
    'module_width': 1.0,    
    'module_height': 35,    
    'write_text': False,
    'quiet_zone': 2,
    'background': 'white',
    'foreground': 'black'
}

try:
    font_large = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 60)
except IOError:
    font_large = ImageFont.load_default()

temp_barcode_path = "temp_barcode_raw2"
total_generated = 0

for cat_path, items in categorized_barcodes.items():
    if not items:
        continue
        
    full_dir = os.path.join(out_dir, cat_path)
    if not os.path.exists(full_dir):
        os.makedirs(full_dir)
        
    # Name the pdf as the last folder name to make it nice, e.g. "وسط.pdf"
    folder_name = os.path.basename(full_dir)
    pdf_path = os.path.join(full_dir, f"{folder_name}.pdf")
    
    c = canvas.Canvas(pdf_path, pagesize=(50*mm, 25*mm))
    
    # Sort items by model then barcode
    sorted_items = sorted(list(items), key=lambda x: (int(x[0]) if x[0].isdigit() else x[0], x[1]))
    
    for model_num, barcode_str in sorted_items:
        # 1. Generate Barcode PNG
        barcode_obj = Code128(barcode_str, writer=writer)
        barcode_obj.save(temp_barcode_path, options=options)
        
        # 2. Resize and paste to canvas
        img = Image.open(temp_barcode_path + ".png")
        img = img.resize((600, 240), Image.Resampling.LANCZOS)
        
        final_img = Image.new('RGB', (600, 300), color='white')
        final_img.paste(img, (0, 0))
        
        # 3. Draw text
        draw = ImageDraw.Draw(final_img)
        text_to_draw = f"{model_num} - {barcode_str}"
        bbox = draw.textbbox((0, 0), text_to_draw, font=font_large)
        text_width = bbox[2] - bbox[0]
        x = (600 - text_width) / 2
        y = 230
        draw.text((x, y), text_to_draw, font=font_large, fill="black")
        
        # 4. Draw to PDF with a 2.5mm margin on all sides (total 5mm smaller)
        img_reader = ImageReader(final_img)
        c.drawImage(img_reader, 2.5*mm, 2.5*mm, width=45*mm, height=20*mm)
        c.showPage()
        
        total_generated += 1
        
        img.close()
        final_img.close()
        
    c.save()

if os.path.exists(temp_barcode_path + ".png"):
    os.remove(temp_barcode_path + ".png")

print(f"Total stickers: {total_generated}")
print("Successfully generated hierarchy!")
