import os

path = r'src\app\admin\inventory\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('num >= 100 && num <= 150', 'num >= 100 && num <= 199')
content = content.replace('(100 - 150)', '(100 - 199)')
content = content.replace('num >= 300 && num <= 350', 'num >= 300 && num <= 399')
content = content.replace('(300 - 350)', '(300 - 399)')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated inventory/page.tsx')
