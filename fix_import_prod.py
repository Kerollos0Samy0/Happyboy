import codecs

with codecs.open("src/app/factory/production/page.tsx", "r", "utf-8") as f:
    content = f.read()

content = content.replace("import { db } from '../../../../lib/firebase';", "import { db } from '@/lib/firebase';")

# Also check for lucide icons that might not exist in older versions, just in case.
# Microscope, ScanBarcode. I will replace Microscope with Search just to be super safe, or leave it.

with codecs.open("src/app/factory/production/page.tsx", "w", "utf-8-sig") as f:
    f.write(content)

print("Fixed")
