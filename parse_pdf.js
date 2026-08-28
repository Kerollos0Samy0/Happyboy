const fs = require('fs');
const zlib = require('zlib');

const pdfData = fs.readFileSync('Barcode/570-575.pdf');
const pdfString = pdfData.toString('binary');

const regex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
let match;
let allText = '';

while ((match = regex.exec(pdfString)) !== null) {
    const streamData = match[1];
    try {
        const buf = Buffer.from(streamData, 'binary');
        const inflated = zlib.unzipSync(buf);
        allText += inflated.toString('utf8') + '\n';
    } catch (e) {
        // Not all streams are zlib, some might fail or be images
    }
}

// Write the raw extracted stream text to a file for inspection
fs.writeFileSync('extracted_raw.txt', allText);
console.log("Extracted raw text, analyzing...");

// Try to extract lines matching the format: "(text) Tj" or similar
let readableText = '';
const textRegex = /\((.*?)\)/g;
let textMatch;
while ((textMatch = textRegex.exec(allText)) !== null) {
    readableText += textMatch[1] + '\n';
}

fs.writeFileSync('extracted_readable.txt', readableText);
console.log("Readable text saved to extracted_readable.txt");
