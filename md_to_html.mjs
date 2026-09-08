import { readFileSync, writeFileSync } from "fs";
import { marked } from "marked";

const md = readFileSync("C:\\Users\\kokos\\.gemini\\antigravity\\brain\\c0623a2d-ced8-41ec-a5da-c4e33c3fc085\\orders_status_report2.md", "utf-8");
const htmlContent = marked.parse(md);

const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>تقرير حالة الأوردرات</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #f9f9f9; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 900px; margin: 0 auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
        th { background-color: #f2f2f2; }
        h1, h2, h3 { color: #333; }
        h2 { border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
</body>
</html>
`;

writeFileSync("public/orders_status_report.html", html, "utf-8");
console.log("Written to public/orders_status_report.html");
process.exit(0);
