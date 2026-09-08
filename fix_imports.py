import codecs
import glob
import re

files = [
    "src/app/factory/inventory/accessories/page.tsx",
    "src/app/factory/inventory/fabric/page.tsx",
    "src/app/factory/inventory/threads/page.tsx",
    "src/app/factory/productivity/page.tsx"
]

for filepath in files:
    with codecs.open(filepath, "r", "utf-8") as f:
        content = f.read()

    # Regex replace any variation of ../../lib/firebase
    content = re.sub(r'import\s+\{\s*db\s*\}\s+from\s+[\'"](?:\.\./)+lib/firebase[\'"];', 
                     "import { db } from '@/lib/firebase';", 
                     content)

    with codecs.open(filepath, "w", "utf-8-sig") as f:
        f.write(content)

print("Fixed imports")
