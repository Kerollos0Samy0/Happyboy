from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

def write_arabic_text(draw, x, y, text, font, fill="black", anchor="mm"):
    reshaped_text = arabic_reshaper.reshape(text)
    bidi_text = get_display(reshaped_text)
    draw.text((x, y), bidi_text, font=font, fill=fill, anchor=anchor)

# Dimensions: 50mm x 25mm @ 300 DPI = 591 x 295 pixels. We'll use 600x300.
img = Image.new('RGB', (600, 300), color='white')
draw = ImageDraw.Draw(img)

# Fonts
try:
    font_large = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 45)
    font_medium = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 35)
    font_small = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 25)
except IOError:
    font_large = ImageFont.load_default()
    font_medium = ImageFont.load_default()
    font_small = ImageFont.load_default()

# 1. Header
write_arabic_text(draw, 300, 40, "Happy Boy", font_large, anchor="mm")
write_arabic_text(draw, 300, 90, "ترينج وسط كابيشو 306", font_medium, anchor="mm")

# 2. Generate Barcode image
writer = ImageWriter()
writer.set_options({
    'module_width': 0.6,
    'module_height': 15,
    'font_size': 20,
    'text_distance': 5,
    'quiet_zone': 1
})
barcode_obj = Code128("30657801", writer=writer)
# We don't save to file directly, we just render it. 
# Wait, python-barcode ImageWriter renders to PIL Image?
# In newer python-barcode versions, barcode_obj.render() returns a PIL Image.
try:
    barcode_img = barcode_obj.render()
except Exception as e:
    # fallback to save and open
    barcode_obj.save("temp_barcode")
    barcode_img = Image.open("temp_barcode.png")

# Resize barcode if needed to make it bigger and prominent
# Let's crop the quiet zone if it's too big, or just resize
# barcode_img usually has a lot of white space on top and bottom.
w, h = barcode_img.size
barcode_img = barcode_img.resize((int(w*1.5), int(h*1.5)), Image.Resampling.LANCZOS)
new_w, new_h = barcode_img.size

# Paste barcode on the left side
img.paste(barcode_img, (10, 130))

# 3. Text on the right
write_arabic_text(draw, 500, 170, "155", font_large, anchor="mm")

# 4. Bottom details
write_arabic_text(draw, 150, 270, "اللون : شاركول", font_medium, anchor="mm")
write_arabic_text(draw, 450, 270, "مقاس : 0", font_medium, anchor="mm")

# Draw border
draw.rectangle([0, 0, 599, 299], outline="black", width=2)

img.save("C:\\Users\\kokos\\.gemini\\antigravity\\brain\\967bb77b-290d-45ae-9f4b-386ef429bb0c\\scratch\\barcode_optimized.png")
print("Sticker generated successfully!")
