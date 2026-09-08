import codecs

with codecs.open("src/app/factory/productivity/page.tsx", "r", "utf-8") as f:
    content = f.read()

# Change the grid from 4 cols to 3 or 6 (since there are 6 items)
content = content.replace(
    'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"',
    'className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"'
)

# Remove the slice(0, 4)
content = content.replace(
    'MACHINE_TYPES.slice(0, 4).map(machine => {',
    'MACHINE_TYPES.map(machine => {'
)

with codecs.open("src/app/factory/productivity/page.tsx", "w", "utf-8-sig") as f:
    f.write(content)

print("Productivity grid fixed")
