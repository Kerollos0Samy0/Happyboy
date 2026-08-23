const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Read logo and convert to base64
const logoPath = path.join(__dirname, 'public', 'ColoredLogo.png');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

const itemsHtml = Array.from({ length: 20 }).map((_, i) => `
  <tr style="border-bottom: 1px solid #e2e8f0; font-size: 14px;">
    <td style="padding: 8px; width: 35%;">منتج تجريبي رقم ${i + 1} (موديل ${100 + i})</td>
    <td style="padding: 8px; width: 10%;">أحمر</td>
    <td style="padding: 8px; text-align: center; width: 30%;">ثري (4 مقاس) (6-8-10-12)</td>
    <td style="padding: 8px; text-align: center; width: 10%;">1</td>
    <td style="padding: 8px; text-align: center; width: 15%;">250</td>
  </tr>
`).join('');

const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }
    .invoice-container {
      width: 794px; /* A4 width in pixels approx */
      margin: 0 auto;
      padding: 20px;
    }
    table {
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
      <img src="${logoDataUri}" alt="Happy Boy Logo" style="height: 120px; object-fit: contain; margin: 0 auto;" />
    </div>
    
    <div style="margin-bottom: 30px; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; gap: 20px;">
      <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
        <p style="font-size: 15px; margin: 0;"><strong>رقم الطلب:</strong> <span style="color: #A62E2E; font-weight: bold;">ORD-87321</span></p>
        <p style="font-size: 15px; margin: 0;"><strong>اسم العميل:</strong> أحمد محمود</p>
        <p style="font-size: 15px; margin: 0;"><strong>رقم الهاتف:</strong> 01012345678</p>
        <p style="font-size: 15px; margin: 0;"><strong>البراند:</strong> محل ستايل كيدز</p>
        <p style="font-size: 15px; margin: 0; color: #A62E2E;"><strong>بواسطة الموظف:</strong> علي</p>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
        <p style="font-size: 15px; margin: 0;"><strong>المحافظة:</strong> القاهرة</p>
        <p style="font-size: 15px; margin: 0;"><strong>العنوان:</strong> 10 شارع التحرير, الدقي</p>
        <p style="font-size: 15px; margin: 0;"><strong>الشحن:</strong> بوسطة</p>
        <p style="font-size: 15px; margin: 0; color: #2563eb;"><strong>التسليم:</strong> 2026-08-25</p>
      </div>
    </div>

    <table>
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 14px;">
          <th style="padding: 8px; text-align: right; width: 35%;">الصنف</th>
          <th style="padding: 8px; text-align: right; width: 10%;">اللون</th>
          <th style="padding: 8px; text-align: center; width: 30%;">النوع (ثري/قطعة)</th>
          <th style="padding: 8px; text-align: center; width: 10%;">الكمية</th>
          <th style="padding: 8px; text-align: center; width: 15%;">السعر (ج)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="display: flex; justify-content: flex-end;">
      <div style="width: 350px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px;">
          <span>إجمالي القطع:</span><strong>80 قطعة</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px;">
          <span>إجمالي الثريهات:</span><strong>20 ثري</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px;">
          <span>الإجمالي الكلي:</span><strong>5000 ج.م</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 15px; color: #16a34a; align-items: center;">
          <span>العربون المدفوع:</span><strong>500</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 15px; color: #A62E2E;">
          <span>الإجمالي المستحق:</span><span>4500 ج.م</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  
  await page.pdf({
    path: path.join(__dirname, 'sample_invoice_3.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
  });
  
  await browser.close();
  console.log("PDF 3 created successfully!");
})();
