import codecs

def update_file(filepath):
    with codecs.open(filepath, "r", "utf-8") as f:
        content = f.read()

    # Change print:p-0 to print:p-10 to add physical margins on the paper
    content = content.replace("print:p-0", "print:p-8")

    # Add box-sizing to the absolute container just in case
    css_old = """            .max-w-4xl > div:nth-child(2) {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }"""
    css_new = """            .max-w-4xl > div:nth-child(2) {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              box-sizing: border-box;
            }"""
    content = content.replace(css_old, css_new)

    with codecs.open(filepath, "w", "utf-8-sig") as f:
        f.write(content)

update_file("src/app/factory/production/new/page.tsx")
update_file("src/app/factory/production/print/[id]/page.tsx")
print("Done")
