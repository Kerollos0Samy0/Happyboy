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

out_pdf = "All_Barcodes_From_Site.pdf"
c = canvas.Canvas(out_pdf, pagesize=(50*mm, 25*mm))

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

for item in items:
    model_num = item['modelNumber']
    barcode_str = item['barcode']
    
    # 1. Generate Barcode PNG
    try:
        barcode_obj = Code128(barcode_str, writer=writer)
        barcode_obj.save(temp_barcode_path, options=options)
    except Exception as e:
        print(f"Skipping invalid barcode {barcode_str}: {e}")
        continue
    
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

print(f"Total stickers generated: {total_generated}")
print(f"Saved to {out_pdf}")
