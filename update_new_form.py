import codecs

with codecs.open("src/app/factory/production/new/page.tsx", "r", "utf-8") as f:
    content = f.read()

# 1. Update State variables
content = content.replace(
    "const [fabricColor, setFabricColor] = useState('');",
    "const [tshirtColor, setTshirtColor] = useState('');\n  const [pantsColor, setPantsColor] = useState('');"
)

# 2. Update orderData object
content = content.replace(
    "fabricColor,",
    "tshirtColor,\n        pantsColor,"
)

# 3. Update the Print Output Section (makhzan el komash)
old_print_section = """                <p className="text-base mb-2"><strong>?????:</strong> {fabricColor || '---'}</p>
                <p className="text-base mb-2"><strong>??????:</strong> {fabricSupplier || '---'}</p>
                
                <div className="mt-auto pt-4 pb-2 grid grid-cols-2 gap-4 justify-items-center">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-[2cm] h-[2cm] border-2 border-gray-400 bg-white shadow-inner"></div>
                    </div>
                  ))}
                </div>"""

new_print_section = """                <p className="text-sm mb-1"><strong>????????:</strong> {tshirtColor || '---'}</p>
                <p className="text-sm mb-2"><strong>????????:</strong> {pantsColor || '---'}</p>
                <p className="text-sm mb-2"><strong>??????:</strong> {fabricSupplier || '---'}</p>
                
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

# 4. Update the Input Form fields
old_input_section = """                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">??????? (????? ??????)</label>
                  <input type="text" value={fabricColor} onChange={(e) => setFabricColor(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="????: ????? ????? ????..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">?????? / ??????? ??????</label>"""

new_input_section = """                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">????? ????????</label>
                  <input type="text" value={tshirtColor} onChange={(e) => setTshirtColor(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="????? ????..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">????? ????????</label>
                  <input type="text" value={pantsColor} onChange={(e) => setPantsColor(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="?????? ????..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">?????? / ??????? ??????</label>"""
content = content.replace(old_input_section, new_input_section)

with codecs.open("src/app/factory/production/new/page.tsx", "w", "utf-8-sig") as f:
    f.write(content)

print("Updated new page")
