const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'admin', 'orders', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = '{/* Hidden Invoice for PDF Generation';
const endRegex = /<\/div>\s*<\/div>\s*\);\s*\}\s*$/; // Matches the end of the file

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Could not find start marker");
  process.exit(1);
}

const beforeBlock = content.substring(0, startIndex);
// We want to keep the final `</div>\n    </div>\n  );\n}\n` which starts after the hidden invoice.
// Let's find the closing of the hidden invoice. It's the `</div>` before the last `</div>`.

const newBlock = `{/* Hidden Invoice for PDF Generation (Replaced with Modern Clean Design) */}
      <div
        ref={invoiceRef}
        style={{
          display: "none", width: "794px", padding: "20px",
          background: "white", color: "black",
          position: "absolute", top: "-9999px", left: "-9999px", direction: "rtl",
          fontFamily: "'Cairo', sans-serif",
          boxSizing: "border-box"
        }}
      >
        {selectedOrder && (
          <div style={{ width: "100%" }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
              <img src="/ColoredLogo.png" alt="Happy Boy Logo" style={{ height: '120px', objectFit: 'contain', margin: '0 auto' }} />
            </div>
            
            <div style={{ marginBottom: "30px", padding: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", display: "flex", gap: "20px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>رقم الطلب:</strong> <span style={{ color: "#A62E2E", fontWeight: "bold" }}>{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</span></p>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>اسم العميل:</strong> {selectedOrder.customerName}</p>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>رقم الهاتف:</strong> <span dir="ltr">{selectedOrder.customerPhone}</span></p>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>البراند:</strong> {selectedOrder.customerBrand}</p>
                {selectedOrder.employeeName && (
                  <p style={{ fontSize: "15px", margin: 0, color: "#A62E2E" }}><strong>بواسطة الموظف:</strong> {selectedOrder.employeeName}</p>
                )}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>المحافظة:</strong> {selectedOrder.customerGovernorate}</p>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>العنوان:</strong> {selectedOrder.customerAddress}</p>
                <p style={{ fontSize: "15px", margin: 0 }}><strong>الشحن:</strong> {selectedOrder.customerShipping}</p>
                <p style={{ fontSize: "15px", margin: 0, color: "#2563eb" }}>
                  <strong>التسليم:</strong> {selectedOrder.deliveryDate || (selectedOrder.createdAt?.toDate ? selectedOrder.createdAt.toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : '')}
                </p>
              </div>
            </div>

            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", marginBottom: "20px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1", fontSize: "14px" }}>
                  <th style={{ padding: "8px", textAlign: "right", width: "35%" }}>الصنف</th>
                  <th style={{ padding: "8px", textAlign: "right", width: "10%" }}>اللون</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "30%" }}>النوع (ثري/قطعة)</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "10%" }}>الكمية</th>
                  <th style={{ padding: "8px", textAlign: "center", width: "15%" }}>السعر (ج)</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items?.map((item, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0", fontSize: "14px" }}>
                    <td style={{ padding: "8px", width: "35%" }}>{item.name} (موديل {item.modelNumber})</td>
                    <td style={{ padding: "8px", width: "10%" }}>{item.selectedColor}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "30%" }}>
                      {item.isSeri ? \`ثري (\${getSizesCount(item.name, item.modelNumber, item.sizes)} مقاس) \${getSizesText(item.name, item.modelNumber, item.sizes)}\` : 'قطعة واحدة'}
                    </td>
                    <td style={{ padding: "8px", textAlign: "center", width: "10%" }}>{item.quantity || 1}</td>
                    <td style={{ padding: "8px", textAlign: "center", width: "15%" }}>{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", justify-content: "flex-end" }}>
              <div style={{ width: "350px", background: "#f8fafc", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px", marginRight: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                  <span>إجمالي القطع:</span><strong>{calculateTotalPieces(selectedOrder.items)} قطعة</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                  <span>إجمالي الثريهات:</span><strong>{calculateTotalSeries(selectedOrder.items)} ثري</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px" }}>
                  <span>الإجمالي الكلي:</span><strong>{calculateTotal(selectedOrder.items)} ج.م</strong>
                </div>
                {Number(selectedOrder.discountPercentage || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px", color: "#16a34a" }}>
                    <span>الخصم ({selectedOrder.discountPercentage}%):</span>
                    <strong>- {(calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage)) / 100} ج.م</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "15px", color: "#16a34a", alignItems: "center" }}>
                  <span>العربون المدفوع:</span><strong>{selectedOrder.deposit || 0}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: "bold", borderTop: "1px solid #cbd5e1", paddingTop: "15px", color: "#A62E2E" }}>
                  <span>الإجمالي المستحق:</span>
                  <span>{calculateTotal(selectedOrder.items) - ((calculateTotal(selectedOrder.items) * Number(selectedOrder.discountPercentage || 0)) / 100) - Number(selectedOrder.deposit || 0)} ج.م</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

const endMatch = content.match(endRegex);
if (!endMatch) {
  console.error("Could not find end of file");
  process.exit(1);
}
// We will replace everything from start marker to the end of the file with newBlock
// Note that newBlock includes the closing tags </div></div>);}.

fs.writeFileSync(filePath, beforeBlock + newBlock);
console.log("Successfully updated hidden invoice!");
