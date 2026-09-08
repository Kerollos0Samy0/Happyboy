import codecs

with codecs.open("src/app/factory/layout.tsx", "r", "utf-8") as f:
    layout = f.read()

# Remove from desktop nav
layout = layout.replace("""                <Link 
                  href="/factory/scanner" 
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${pathname === '/factory/scanner' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  ?????? ?????? ??????
                </Link>""", "")

# Remove from mobile nav
layout = layout.replace("""              <Link 
                href="/factory/scanner" 
                className={`px-3 py-2 whitespace-nowrap rounded-md text-sm transition-colors ${pathname === '/factory/scanner' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                ?????? ?????? ??????
              </Link>""", "")

with codecs.open("src/app/factory/layout.tsx", "w", "utf-8-sig") as f:
    f.write(layout)

print("Scanner link removed")
