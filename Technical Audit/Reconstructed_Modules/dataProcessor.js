const fs = require('fs');
const path = require('path');

class DataProcessor {
    constructor() {
        this.shopMapping = {};
        try {
            const mappingPath = path.join(__dirname, '../../config/shops-mapping.json');
            if (fs.existsSync(mappingPath)) {
                this.shopMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
            }
        } catch (e) {
            console.error('Could not load shops-mapping.json', e);
        }
    }

    processData(rawData, combinedVerificationTotals, processedCategories, expectedCategories, expectedIssuePointTotals) {
        let totalAllocation = 0;
        let totalDispatch = 0;
        let totalPOSReceipt = 0;

        const sectorsMap = {};

        // Process raw data
        const shops = Array.isArray(rawData) ? rawData : [];

        shops.forEach(shop => {
            const shopCode = shop.shopCode || '';
            const sectorId = this.shopMapping[shopCode] || 'Unmapped';
            const sectorName = sectorId === 'Unmapped' ? 'Unmapped' : `Sector ${sectorId}`;

            if (!sectorsMap[sectorId]) {
                sectorsMap[sectorId] = {
                    sectorName: sectorName,
                    serialNo: sectorId,
                    transporter: '',
                    block: shop.issuePoint || '',
                    allocation: 0,
                    dispatch: 0,
                    posReceipt: 0,
                    shops: []
                };
            }

            // The scraper already provides values, but we might need to divide by 100 if they are in kg
            // balancesReportGenerator.js conventions state dividing raw portal values by 100
            const parseKg = (val) => {
                if (typeof val === 'number') return val / 100;
                if (typeof val === 'string') {
                    const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                    return isNaN(parsed) ? 0 : parsed / 100;
                }
                return 0;
            };

            const alloc = parseKg(shop.allocation || shop.nfsaAllocation || 0);
            const disp = parseKg(shop.dispatch || shop.nfsaDispatch || 0);
            const rec = parseKg(shop.posReceipt || shop.nfsaReceipt || 0);

            totalAllocation += alloc;
            totalDispatch += disp;
            totalPOSReceipt += rec;

            sectorsMap[sectorId].allocation += alloc;
            sectorsMap[sectorId].dispatch += disp;
            sectorsMap[sectorId].posReceipt += rec;

            const commodities = {};
            if (shop.commodities) {
                for (const [key, val] of Object.entries(shop.commodities)) {
                    commodities[key] = parseKg(val);
                }
            } else {
                // Check flat properties
                ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                    if (shop[`${c}Allotted`] !== undefined) {
                        commodities[c] = parseKg(shop[`${c}Allotted`]);
                    }
                });
            }

            sectorsMap[sectorId].shops.push({
                shopCode: shopCode,
                shopName: shop.shopName || shopCode,
                issuePoint: shop.issuePoint || '',
                allocation: alloc,
                dispatch: disp,
                posReceipt: rec,
                commodities: commodities
            });
        });

        const dispatchPercentage = totalAllocation > 0 ? (totalDispatch / totalAllocation) * 100 : 0;

        const sectors = Object.values(sectorsMap).map(s => {
            s.dispatchPercentage = s.allocation > 0 ? (s.dispatch / s.allocation) * 100 : 0;
            s.receiptPercentage = s.dispatch > 0 ? (s.posReceipt / s.dispatch) * 100 : 0;
            return s;
        });

        // Sort sectors by serialNo
        sectors.sort((a, b) => {
            if (a.serialNo === 'Unmapped') return 1;
            if (b.serialNo === 'Unmapped') return -1;
            return parseInt(a.serialNo) - parseInt(b.serialNo);
        });

        return {
            totals: {
                totalAllocation: Number(totalAllocation.toFixed(2)),
                totalDispatch: Number(totalDispatch.toFixed(2)),
                totalPOSReceipt: Number(totalPOSReceipt.toFixed(2)),
                dispatchPercentage: Number(dispatchPercentage.toFixed(2))
            },
            verification: combinedVerificationTotals || {},
            sectors: sectors
        };
    }
}

module.exports = DataProcessor;
