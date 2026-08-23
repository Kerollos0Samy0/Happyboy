import os

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'getCategoryName' in content and 'return \"أخرى\";' in content:
                new_content = content.replace('  return \"أخرى\";\n};', '  if (num >= 1000 && num <= 2999) return \"رياضي\";\n  return \"أخرى\";\n};')
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f'Updated {path}')
