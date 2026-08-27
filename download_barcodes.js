const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, 'Barcode', 'New_Models');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const barcodes = [
    '570 - 1', '570 - 2', '570 - 3', '570 - 4', '570 - 5', '570 - 6',
    '575 - 1', '575 - 2', '575 - 3', '575 - 4', '575 - 5', '575 - 6'
];

async function downloadBarcode(text) {
    const filename = text.replace(/ /g, '') + '.gif';
    const filePath = path.join(targetDir, filename);
    const url = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=96&dataseparator=`;

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
    console.log('Downloading barcode images...');
    for (const text of barcodes) {
        try {
            await downloadBarcode(text);
        } catch (e) {
            console.error(e);
        }
    }
    console.log('All done! Barcodes are saved in:', targetDir);
}

run();
