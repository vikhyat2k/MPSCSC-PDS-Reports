const DatabaseManager = require('../server/database/db');
const DataProcessor = require('../server/services/dataProcessor');

(async () => {
    const db = new DatabaseManager();
    await db.init();
    const reports = await db.all("SELECT * FROM reports WHERE scheme = 'nfsa' ORDER BY id DESC LIMIT 1");
    const rawData = JSON.parse(reports[0].raw_data);
    const processed = new DataProcessor().processData(rawData);
    console.log(processed.sectors.map(s => ({
        no: s.serialNo,
        name: s.sectorName,
        block: s.block,
        issueCenter: s.issueCenter,
        districtOffice: s.districtOffice
    })));
})();
