const fs = require('fs');
const lines = fs.readFileSync('C:\\FDMS\\logs\\fiscalization-2026-06-03.log', 'utf8').split('\n');

const targets = ['INV0602', 'INV0603', 'CRN0063', 'CRN0064'];
const results = {};

for (const target of targets) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Payload:') && i > 0) {
      // Look ahead to find if this payload contains our target
      let payloadStart = i + 1;
      let payloadEnd = i + 1;
      let braceCount = 0;
      let started = false;
      
      for (let j = payloadStart; j < lines.length && j < payloadStart + 200; j++) {
        const line = lines[j];
        if (line.includes('{')) {
          started = true;
        }
        if (started) {
          if (line.includes('{')) braceCount++;
          if (line.includes('}')) braceCount--;
          payloadEnd = j;
          if (braceCount === 0 && j > payloadStart + 5) {
            break;
          }
        }
      }
      
      const payload = lines.slice(payloadStart, payloadEnd + 1).join('\n');
      if (payload.includes(target)) {
        results[target] = payload;
        break;
      }
    }
  }
}

for (const [key, value] of Object.entries(results)) {
  console.log('\n=== ' + key + ' ===');
  console.log(value);
}
