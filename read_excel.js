const xlsx = require('xlsx');

const workbook = xlsx.readFile('بيانات_العملاء_Winter2027.xlsx');
const sheet = workbook.Sheets['جميع العملاء'];
const data = xlsx.utils.sheet_to_json(sheet);

console.log(data.slice(0, 5));
