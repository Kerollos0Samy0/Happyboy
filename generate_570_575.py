import json
import os
from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

# Barcodes to generate:
# 570: 555 (اسود), 554 (لبني), 553 (بني)
# 575: 556 (لبني), 558 (اسود), 557 (روز)

models_data = [
    {"model": "570", "barcode": "553", "color": "بني"},
    {"model": "570", "barcode": "554", "color": "لبني"},
    {"model": "570", "barcode": "555", "color": "اسود"},
    {"model": "575", "barcode": "556", "color": "لبني"},
    {"model": "575", "barcode": "557", "color": "روز"},
    {"model": "575", "barcode": "558", "color": "اسود"}
]

out_pdf = "Barcodes_570_575.pdf"
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

temp_barcode_path = "temp_barcode_raw_570"

for item in models_data:
    model_num = item['model']
    barcode_str = item['barcode']
    
    # Generate 5 copies for each barcode (or just 1? I'll generate 5 so they can print them easily)
    for _ in range(5):
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
        
        img.close()
        final_img.close()

c.save()

if os.path.exists(temp_barcode_path + ".png"):
    os.remove(temp_barcode_path + ".png")

print(f"Generated {out_pdf}")
