require('dotenv').config();
const { closeFiscalDay } = require('../src/integrations/pdfFiscalizationService');

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         CLOSE FISCAL DAY                               ║');
  console.log('║           Rapid Roots Investment Pvt Ltd              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    const result = await closeFiscalDay();
    
    if (result) {
      console.log('\n✅ SUCCESS! Fiscal day closed.');
      console.log('The next fiscal day will auto-open at 06:00 AM.');
    } else {
      console.log('\n❌ Failed to close fiscal day.');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('ZIMRA Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
