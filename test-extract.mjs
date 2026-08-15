import fs from 'fs';

const transcriptPath = 'C:/Users/kokos/.gemini/antigravity/brain/6cdad1b7-359b-4f55-9ba3-7f6fc585c942/.system_generated/logs/transcript_full.jsonl';

const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
const modelsMap = {};

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    // Tool responses look like: { type: "TOOL_RESPONSE", tool_responses: [ { output: "..." } ] }
    if (json.tool_responses && Array.isArray(json.tool_responses)) {
      for (const res of json.tool_responses) {
        if (res.output && typeof res.output === 'string' && res.output.includes('==Start of OCR for page')) {
          const ocrBlocks = res.output.split('==Start of OCR for page');
          for (let i = 1; i < ocrBlocks.length; i++) {
            const block = ocrBlocks[i].split('==End of OCR for page')[0];
            const linesClean = block.split('\n').map(l => l.trim()).filter(l => l && !l.includes('=='));
            
            const sizeColorMatch = block.match(/مقاس\s*([^\:]+):\s*اللون\s*:\s*(.+)/);
            if (!sizeColorMatch) continue;
            
            const size = sizeColorMatch[1].trim();
            const color = sizeColorMatch[2].trim();
            
            const scIdx = linesClean.findIndex(l => l.includes('مقاس') && l.includes('اللون'));
            if (scIdx !== -1 && scIdx >= 2 && scIdx + 2 < linesClean.length) {
                const pName = linesClean[scIdx - 2];
                const pModelNumber = linesClean[scIdx - 1];
                const pBrand = linesClean[scIdx + 1];
                const pBarcode = linesClean[scIdx + 2];
                
                if (!modelsMap[pModelNumber]) {
                    modelsMap[pModelNumber] = {
                        name: pName,
                        sizes: new Set(),
                        colorsMap: {},
                        barcodes: new Set()
                    };
                }
                
                modelsMap[pModelNumber].sizes.add(size);
                modelsMap[pModelNumber].colorsMap[color] = pBarcode;
                modelsMap[pModelNumber].barcodes.add(pBarcode);
            }
          }
        }
      }
    }
  } catch (e) {
  }
}

const result = Object.keys(modelsMap).map(m => {
  const data = modelsMap[m];
  return {
    modelNumber: m,
    name: data.name,
    sizes: Array.from(data.sizes),
    colors: Object.entries(data.colorsMap).map(([name, barcode]) => ({ name, barcode })),
    barcodes: Array.from(data.barcodes)
  };
});

console.log(`Total unique models found: ${result.length}`);
console.log(JSON.stringify(result[0], null, 2));
