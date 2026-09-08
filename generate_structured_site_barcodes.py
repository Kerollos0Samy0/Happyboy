import json
import os
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

# Read the dumped JSON
with open('all_db_barcodes.json', 'r', encoding='utf-8') as f:
    items = json.load(f)

out_dir = r"E:\Files\Stock HappyBoy\Barcodes_Structured_From_Site"
if not os.path.exists(out_dir):
    os.makedirs(out_dir)

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

temp_barcode_path = "temp_barcode_raw3"
total_generated = 0

# Group by category
categories = {}
for item in items:
    cat = item['category']
    if cat not in categories:
        categories[cat] = []
    categories[cat].append(item)

for cat_name, cat_items in categories.items():
    # Sanitize folder name
    safe_cat_name = "".join([c for c in cat_name if c.isalpha() or c.isdigit() or c==' ']).strip()
    full_dir = os.path.join(out_dir, safe_cat_name)
    if not os.path.exists(full_dir):
        os.makedirs(full_dir)
        
    pdf_path = os.path.join(full_dir, f"{safe_cat_name}.pdf")
    c = canvas.Canvas(pdf_path, pagesize=(50*mm, 25*mm))
    
    for item in cat_items:
        model_num = item['modelNumber']
        barcode_str = item['barcode']
        
        try:
            barcode_obj = Code128(barcode_str, writer=writer)
            barcode_obj.save(temp_barcode_path, options=options)
        except Exception:
            continue
            
        img = Image.open(temp_barcode_path + ".png")
        img = img.resize((600, 240), Image.Resampling.LANCZOS)
        
        final_img = Image.new('RGB', (600, 300), color='white')
        final_img.paste(img, (0, 0))
        
        draw = ImageDraw.Draw(final_img)
        text_to_draw = f"{model_num} - {barcode_str}"
        bbox = draw.textbbox((0, 0), text_to_draw, font=font_large)
        text_width = bbox[2] - bbox[0]
        x = (600 - text_width) / 2
        y = 230
        draw.text((x, y), text_to_draw, font=font_large, fill="black")
        
        img_reader = ImageReader(final_img)
        c.drawImage(img_reader, 2.5*mm, 2.5*mm, width=45*mm, height=20*mm)
        c.showPage()
        
        total_generated += 1
        img.close()
        final_img.close()
        
    c.save()

if os.path.exists(temp_barcode_path + ".png"):
    os.remove(temp_barcode_path + ".png")

print(f"Total stickers generated: {total_generated}")
print(f"Saved to {out_dir}")
