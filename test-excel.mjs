import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;
const workbook = xlsx.readFile('المخزن.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = xlsx.utils.sheet_to_json(worksheet);
let total = 0;
let numZero = 0;
for (const row of excelData) {
  const qty = parseInt(row['عدد القطع'], 10);
  if (!isNaN(qty)) {
    total += qty;
    if (qty === 0) numZero++;
  }
}
console.log('Total in Excel:', total);
console.log('Zero qty rows:', numZero);
