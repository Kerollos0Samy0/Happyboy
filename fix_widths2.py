import os
import re

def fix_widths(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Define new widths
    # 8% Model, 30% Item, 12% Color, 33% Type, 7% Qty, 10% Price
    
    # Table Header widths
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الموديل</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "8%" }}>الموديل</th>'
    )
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "28%" }}>الصنف</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "30%" }}>الصنف</th>'
    )
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "15%" }}>اللون</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "12%" }}>اللون</th>'
    )
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "22%" }}>النوع (ثري/قطعة)</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "33%" }}>النوع (ثري/قطعة)</th>'
    )
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الكمية</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "7%" }}>الكمية</th>'
    )
    content = content.replace(
        '<th style={{ padding: "8px", textAlign: "center", width: "15%" }}>السعر (ج)</th>',
        '<th style={{ padding: "8px", textAlign: "center", width: "10%" }}>السعر (ج)</th>'
    )

    # Table Body widths
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "10%", fontWeight: "bold" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "8%", fontWeight: "bold", whiteSpace: "nowrap" }}>'
    )
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "28%", whiteSpace: "nowrap" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "30%", whiteSpace: "nowrap" }}>'
    )
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "15%", whiteSpace: "nowrap" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "12%", whiteSpace: "nowrap" }}>'
    )
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "22%" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "33%", whiteSpace: "nowrap" }}>'
    )
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "10%" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "7%", whiteSpace: "nowrap" }}>'
    )
    content = content.replace(
        '<td style={{ padding: "8px", textAlign: "center", width: "15%" }}>',
        '<td style={{ padding: "8px", textAlign: "center", width: "10%", whiteSpace: "nowrap" }}>'
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

fix_widths(r"E:\Files\Stock HappyBoy\src\app\cart\page.tsx")
fix_widths(r"E:\Files\Stock HappyBoy\src\app\admin\orders\page.tsx")
print("Done")
