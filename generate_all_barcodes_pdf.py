import json
import os
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

# Load JSON
with open('models_data.json', 'r', encoding='utf-8') as f:
    products = json.load(f)

# PDF setup: 50mm x 25mm
pdf_path = "all_barcodes_stickers.pdf"
c = canvas.Canvas(pdf_path, pagesize=(50*mm, 25*mm))

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

generated = set()
count = 0

temp_barcode_path = "temp_barcode_raw"

for product in products:
    model_num = product.get('modelNumber', '')
    for color in product.get('colors', []):
        barcode_str = str(color.get('barcode', '')).strip()
        
        if not barcode_str or barcode_str in generated:
            continue
            
        generated.add(barcode_str)
        
        # 1. Generate Barcode PNG
        barcode_obj = Code128(barcode_str, writer=writer)
        barcode_obj.save(temp_barcode_path, options=options)
        
        # 2. Resize and paste to canvas
        img = Image.open(temp_barcode_path + ".png")
        img = img.resize((600, 240), Image.Resampling.LANCZOS)
        
        final_img = Image.new('RGB', (600, 300), color='white')
        final_img.paste(img, (0, 0))
        
        # 3. Draw text "155 - 306" -> "model - barcode"
        draw = ImageDraw.Draw(final_img)
        text_to_draw = f"{model_num} - {barcode_str}"
        bbox = draw.textbbox((0, 0), text_to_draw, font=font_large)
        text_width = bbox[2] - bbox[0]
        x = (600 - text_width) / 2
        y = 230
        draw.text((x, y), text_to_draw, font=font_large, fill="black")
        
        final_img_path = "temp_final_sticker.png"
        final_img.save(final_img_path)
        
        # 4. Draw to PDF
        # We draw the image to cover the entire 50x25 mm page
        c.drawImage(final_img_path, 0, 0, width=50*mm, height=25*mm)
        c.showPage()
        
        count += 1
        
c.save()

# cleanup temp files
if os.path.exists(temp_barcode_path + ".png"):
    os.remove(temp_barcode_path + ".png")
if os.path.exists("temp_final_sticker.png"):
    os.remove("temp_final_sticker.png")

print(f"Done! Generated {count} stickers in {pdf_path}")
