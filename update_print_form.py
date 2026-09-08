import codecs

with codecs.open("src/app/factory/production/print/[id]/page.tsx", "r", "utf-8") as f:
    content = f.read()

old_print_section = """              <p className="text-base mb-2"><strong>?????:</strong> {order.fabricColor || '---'}</p>
              <p className="text-base mb-2"><strong>??????:</strong> {order.fabricSupplier || '---'}</p>
              
              <div className="mt-auto pt-4 pb-2 grid grid-cols-2 gap-4 justify-items-center">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                  </div>
                ))}
              </div>"""

new_print_section = """              <p className="text-sm mb-1"><strong>????????:</strong> {order.tshirtColor || order.fabricColor || '---'}</p>
              <p className="text-sm mb-2"><strong>????????:</strong> {order.pantsColor || '---'}</p>
              <p className="text-sm mb-2"><strong>??????:</strong> {order.fabricSupplier || '---'}</p>
              
              <div className="mt-auto pt-2 pb-2 grid grid-cols-2 gap-x-2 gap-y-3 justify-items-center">
                {[...Array(3)].map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-[1.8cm] h-[1.8cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                      <span className="text-[10px] font-bold text-gray-600">??????</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-[1.8cm] h-[1.8cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                      <span className="text-[10px] font-bold text-gray-600">??????</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>"""
content = content.replace(old_print_section, new_print_section)

# We need to add React.Fragment support
if "import React, { useEffect" not in content and "import React" not in content:
    content = content.replace("import { useEffect", "import React, { useEffect")

with codecs.open("src/app/factory/production/print/[id]/page.tsx", "w", "utf-8-sig") as f:
    f.write(content)

print("Updated print page")
