import * as xlsxImport from 'xlsx';
const xlsx = xlsxImport.default || xlsxImport;
const workbook = xlsx.readFile('المخزن.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const excelData = xlsx.utils.sheet_to_json(worksheet);
console.log(excelData.slice(0, 10));
