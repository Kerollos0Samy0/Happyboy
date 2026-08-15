import * as xlsx from 'xlsx';

const workbook = xlsx.readFile('بيانات_العملاء_Winter2027.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet);

console.log(data.slice(0, 5));
