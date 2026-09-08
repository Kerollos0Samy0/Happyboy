from barcode import Code128
from barcode.writer import ImageWriter

writer = ImageWriter()
writer.set_options({
    'module_width': 0.8,    # Width of the barcode lines
    'module_height': 30,    # Height of the barcode lines
    'font_size': 45,        # Size of the barcode number
    'text_distance': 7,     # Distance between barcode and text
    'quiet_zone': 2,        # White space on sides
    'background': 'white',
    'foreground': 'black'
})

barcode_obj = Code128("30657801", writer=writer)
# Save directly to the scratch path
out_path = "C:\\Users\\kokos\\.gemini\\antigravity\\brain\\967bb77b-290d-45ae-9f4b-386ef429bb0c\\scratch\\barcode_only"
barcode_obj.save(out_path)

from PIL import Image
# Open and resize to exactly 600x300
img = Image.open(out_path + ".png")
# We can just resize it to fit the 5x2.5 cm ratio perfectly, or let it be
# If it's already generated nicely, we can just stretch it slightly or center it.
# Let's resize it to 600x300 to match the exact sticker dimensions.
img = img.resize((600, 300), Image.Resampling.LANCZOS)
img.save(out_path + ".png")

print("Sticker generated successfully!")
