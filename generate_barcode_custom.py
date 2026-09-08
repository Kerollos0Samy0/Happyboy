from barcode import Code128
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont

# Generate barcode without text
writer = ImageWriter()
writer.set_options({
    'module_width': 1.0,    
    'module_height': 35,    
    'write_text': False,    # Don't draw the default text
    'quiet_zone': 2,
    'background': 'white',
    'foreground': 'black'
})

barcode_str = "306" # The actual barcode data to be scanned
barcode_obj = Code128(barcode_str, writer=writer)

out_path = "C:\\Users\\kokos\\.gemini\\antigravity\\brain\\967bb77b-290d-45ae-9f4b-386ef429bb0c\\scratch\\barcode_custom_text"
barcode_obj.save(out_path)

# Open the generated image to add custom text
img = Image.open(out_path + ".png")
# Resize first to give some space for text
img = img.resize((600, 240), Image.Resampling.LANCZOS)

# Create a new blank canvas 600x300
final_img = Image.new('RGB', (600, 300), color='white')
# Paste the barcode at the top
final_img.paste(img, (0, 10))

draw = ImageDraw.Draw(final_img)
try:
    font_large = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 55)
except IOError:
    font_large = ImageFont.load_default()

# Draw the custom text underneath
text_to_draw = "155 - 306"

# Calculate text width to center it
# getbbox returns (left, top, right, bottom)
bbox = draw.textbbox((0, 0), text_to_draw, font=font_large)
text_width = bbox[2] - bbox[0]

x = (600 - text_width) / 2
y = 230  # Position below the barcode

draw.text((x, y), text_to_draw, font=font_large, fill="black")

final_img.save(out_path + ".png")
print("Sticker generated successfully!")
