import codecs

# Fix factory layout
with codecs.open("src/app/factory/layout.tsx", "r", "utf-8") as f:
    layout = f.read()

# Make header full width always
layout = layout.replace(
    "className={`${pathname?.includes('/factory/dashboard') ? 'w-full px-4' : 'max-w-7xl mx-auto'} flex justify-between items-center`}",
    "className=\"w-full px-4 lg:px-8 mx-auto flex justify-between items-center\""
)

# Make main full width always
layout = layout.replace(
    "className={`flex-1 w-full mx-auto ${pathname?.includes('/factory/dashboard') ? 'max-w-none px-2' : 'max-w-7xl p-4 sm:p-6 lg:p-8'}`}",
    "className=\"flex-1 w-full mx-auto px-2 sm:px-4 lg:px-8 pt-4 pb-8\""
)

with codecs.open("src/app/factory/layout.tsx", "w", "utf-8-sig") as f:
    f.write(layout)

# Fix inventory layout
with codecs.open("src/app/factory/inventory/layout.tsx", "r", "utf-8") as f:
    inv_layout = f.read()

inv_layout = inv_layout.replace("max-w-7xl", "w-full")

with codecs.open("src/app/factory/inventory/layout.tsx", "w", "utf-8-sig") as f:
    f.write(inv_layout)

print("Width fixed")
