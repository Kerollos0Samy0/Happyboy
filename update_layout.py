import codecs

with codecs.open("src/app/factory/layout.tsx", "r", "utf-8") as f:
    content = f.read()

# Change the condition to hide header for both login and scanner
content = content.replace(
    'const isLoginPage = pathname === "/factory/login";',
    'const isLoginPage = pathname === "/factory/login";\n  const isScannerPage = pathname === "/factory/scanner";'
)

content = content.replace(
    '{!isLoginPage && (',
    '{!(isLoginPage || isScannerPage) && ('
)

with codecs.open("src/app/factory/layout.tsx", "w", "utf-8-sig") as f:
    f.write(content)

print("Updated factory layout")
