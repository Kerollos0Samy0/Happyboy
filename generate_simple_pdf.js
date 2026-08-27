const fs = require('fs');
const path = require('path');
const https = require('https');
const { jsPDF } = require('jspdf');

const targetDir = path.join(__dirname, 'Barcode', 'Temp_Images');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const barcodes = [
    '570 - 553', '570 - 554', '570 - 555',
    '575 - 556', '575 - 557', '575 - 558'
];

async function downloadBarcode(text) {
    const filename = text.replace(/ /g, '') + '.png';
    const filePath = path.join(targetDir, filename);
    const url = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=300&dataseparator=&imagetype=Png`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${text}, status code: ${res.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`Saved: ${filename}`);
                resolve(filePath);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            reject(err);
        });
    });
}

async function run() {
    console.log('Downloading barcode images as PNG...');
    const filePaths = [];
    for (const text of barcodes) {
        try {
            const fp = await downloadBarcode(text);
            filePaths.push(fp);
        } catch (e) {
            console.error(e);
        }
    }

    console.log('Creating PDF...');
    // 5cm x 2.5cm is 50mm x 25mm
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [50, 25]
    });
    
    for (let i = 0; i < filePaths.length; i++) {
        if (i > 0) doc.addPage([50, 25], 'landscape');
        const fp = filePaths[i];
        const imgData = fs.readFileSync(fp);
        const base64Img = imgData.toString('base64');
        
        // Add image centered and filling most of the space
        doc.addImage(`data:image/png;base64,${base64Img}`, 'PNG', 2, 2, 46, 21);
    }

    const pdfPath = path.join(__dirname, 'Barcode', 'موديلات_570_و_575_بسيط.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
    console.log('PDF saved at:', pdfPath);
}

run();
