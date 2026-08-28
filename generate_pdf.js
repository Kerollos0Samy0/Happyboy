const fs = require('fs');
const path = require('path');
const https = require('https');
const { jsPDF } = require('jspdf');

const targetDir = path.join(__dirname, 'Barcode', 'New_Models');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const barcodes = [
    '570 - 1', '570 - 2', '570 - 3', '570 - 4', '570 - 5', '570 - 6',
    '575 - 1', '575 - 2', '575 - 3', '575 - 4', '575 - 5', '575 - 6'
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
    const doc = new jsPDF();
    
    let x = 20;
    let y = 20;
    const imgWidth = 70;
    const imgHeight = 40;

    for (let i = 0; i < filePaths.length; i++) {
        const fp = filePaths[i];
        const imgData = fs.readFileSync(fp);
        const base64Img = imgData.toString('base64');
        
        doc.addImage(`data:image/png;base64,${base64Img}`, 'PNG', x, y, imgWidth, imgHeight);
        
        x += imgWidth + 20;
        if (x + imgWidth > 200) {
            x = 20;
            y += imgHeight + 20;
        }
        
        if (y + imgHeight > 280) {
            doc.addPage();
            x = 20;
            y = 20;
        }
    }

    const pdfPath = path.join(__dirname, 'Barcode', 'موديلات_570_و_575.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(doc.output('arraybuffer')));
    console.log('PDF saved at:', pdfPath);
}

run();
