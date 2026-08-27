const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'Barcode', 'New_Models');
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const barcodes = [
    '570 - 1', '570 - 2', '570 - 3', '570 - 4', '570 - 5', '570 - 6',
    '575 - 1', '575 - 2', '575 - 3', '575 - 4', '575 - 5', '575 - 6'
];

async function generate() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch();
    
    for (const text of barcodes) {
        console.log(`Generating ${text}...`);
        const page = await browser.newPage();
        
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
            <style>
                body { margin: 0; padding: 20px; text-align: center; background: white; }
                svg { display: block; margin: 0 auto; }
            </style>
        </head>
        <body>
            <svg id="barcode"></svg>
            <script>
                JsBarcode("#barcode", "${text}", {
                    format: "CODE128",
                    lineColor: "#000",
                    width: 4,
                    height: 120,
                    displayValue: true,
                    fontSize: 34,
                    fontOptions: "bold",
                    textMargin: 8,
                    margin: 15,
                    background: "#ffffff"
                });
            </script>
        </body>
        </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        // Find the SVG element and take a screenshot of it
        const svgElement = await page.$('#barcode');
        const filename = text.replace(/ /g, '') + '.jpeg';
        await svgElement.screenshot({
            path: path.join(targetDir, filename),
            type: 'jpeg',
            quality: 100,
            omitBackground: false
        });
        
        await page.close();
    }

    await browser.close();
    console.log('All barcodes generated in', targetDir);
}

generate().catch(console.error);
