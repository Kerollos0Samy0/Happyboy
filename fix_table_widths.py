import os

old_th_code = """<th style={{ padding: "8px", textAlign: "center", width: "12%" }}>الموديل</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "20%" }}>الصنف</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "13%" }}>اللون</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "30%" }}>النوع (ثري/قطعة)</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الكمية</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "15%" }}>السعر (ج)</th>"""

new_th_code = """<th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الموديل</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "28%" }}>الصنف</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "15%" }}>اللون</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "22%" }}>النوع (ثري/قطعة)</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الكمية</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "15%" }}>السعر (ج)</th>"""

old_td_code = """<td style={{ padding: "8px", textAlign: "center", width: "12%", fontWeight: "bold" }}>{item.modelNumber}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "20%" }}>{item.name}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "13%", whiteSpace: "nowrap" }}>{item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : '(---)'}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "30%" }}>"""

new_td_code = """<td style={{ padding: "8px", textAlign: "center", width: "10%", fontWeight: "bold" }}>{item.modelNumber}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "28%", whiteSpace: "nowrap" }}>{item.name}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "15%", whiteSpace: "nowrap" }}>{item.selectedColor} {item.colorBarcode ? `(${item.colorBarcode})` : '(---)'}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "22%" }}>"""

files_to_fix = [
    r"E:\Files\Stock HappyBoy\src\app\cart\page.tsx",
    r"E:\Files\Stock HappyBoy\src\app\admin\orders\page.tsx"
]

for path in files_to_fix:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old_th_code in content or old_td_code in content:
        content = content.replace(old_th_code, new_th_code)
        content = content.replace(old_td_code, new_td_code)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")
    else:
        print(f"Could not find exact text in {path}")
