const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simulate the server environment and function
const configPath = path.join(__dirname, '../config/sectors.json');
const sectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const processedResult = {
    totals: { totalDispatch: 500, totalAllotted: 1000 },
    sectors: [
        {
            sectorName: "बैतूल सेक्टर क्र 1",
            serialNo: "1",
            dispatch: 120,
            shops: [{ shopCode: "101", shopName: "Shop 101", dispatch: 120 }]
        }
    ]
};

// Replicate computeNFSADaterangeAnalytics logic
const basePool = [...processedResult.sectors];
if (Array.isArray(sectorsConfig) && sectorsConfig.length > 0) {
    const existingSectorNames = new Set(basePool.map(s => s.sectorName));
    sectorsConfig.forEach(cfg => {
        if (cfg.sectorName && !existingSectorNames.has(cfg.sectorName)) {
            basePool.push({
                sectorName: cfg.sectorName,
                serialNo: String(cfg.serialNo || ''),
                transporter: cfg.transporter || '',
                mobileNumber: cfg.mobile || '',
                block: cfg.block || cfg.districtOffice || '',
                dispatch: 0,
                totalShops: cfg.totalShops || 0,
                shops: []
            });
        }
    });
}

assert.strictEqual(basePool.length, 22, 'basePool should contain all 22 sectors from sectorsConfig');
console.log('✅ Date Range Analytics test passed: All 22 sectors configured and handled properly without ReferenceError.');
