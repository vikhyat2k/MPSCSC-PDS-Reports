const ICDSScraper = require('../server/automation/icds_scraper');
const fs = require('fs');
const path = require('path');

async function debugScrape() {
    console.log('🔍 Debugging live ICDS portal scraping for July 2026...');
    const scraper = new ICDSScraper();
    await scraper.init(true);

    try {
        const result = await scraper.extractData(7, 2026, (current, total, msg) => {
            console.log(`[Progress ${current}/${total}] ${msg}`);
        });

        console.log('✅ Scraping Status:', result.status);
        console.log('📊 Summary Totals:', JSON.stringify(result.summaryTotals, null, 2));
        console.log(`📦 Extracted ${result.rawData.length} raw shop rows.`);

        if (result.rawData.length > 0) {
            console.log('Sample shop row 0:', JSON.stringify(result.rawData[0], null, 2));
            console.log('Sample shop row 1:', JSON.stringify(result.rawData[1], null, 2));
            console.log('Sample shop row 2:', JSON.stringify(result.rawData[2], null, 2));
        }

        // Write rawData to debug file
        fs.writeFileSync(path.join(__dirname, 'icds_raw_scraped.json'), JSON.stringify(result.rawData, null, 2));
        console.log('Saved raw data to tests/icds_raw_scraped.json');

    } catch (e) {
        console.error('❌ Error during debug scrape:', e);
    } finally {
        await scraper.close();
    }
}

debugScrape();
