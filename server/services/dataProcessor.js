const fs = require('fs');
const path = require('path');

// Load sectors config once at module load
let sectorsConfig = [];
try {
    const configPath = path.join(__dirname, '../../config/sectors.json');
    sectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Could not load sectors.json', e);
}

let shopsDetails = {};
try {
    const detailsPath = path.join(__dirname, '../../config/shops-details.json');
    shopsDetails = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
} catch (e) {
    console.error('Could not load shops-details.json', e);
}

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

        const mappedCounts = {};
        if (this.shopMapping) {
            for (const shopCode in this.shopMapping) {
                const secId = this.shopMapping[shopCode];
                mappedCounts[secId] = (mappedCounts[secId] || 0) + 1;
            }
        }
        
        const sectorsMap = {};

        const shops = Array.isArray(rawData) ? rawData : [];

        // Values are already in Quintals from the scraper — this is a generic numeric parser.
        // ⚠️ DO NOT add any unit conversion (e.g. /100) here. The Kg→Quintal conversion
        // happens exactly once, upstream in scraper_v2.js.
        const parseNumeric = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        shops.forEach(shop => {
            const alloc = parseNumeric(shop.allocation || shop.nfsaAllocation || 0);
            const disp = parseNumeric(shop.dispatch || shop.nfsaDispatch || 0);
            const rec = parseNumeric(shop.posReceipt || shop.nfsaReceipt || 0);

            if (alloc === 0 && disp === 0 && rec === 0) return;

            const shopCode = shop.shopCode || '';
            const sectorId = this.shopMapping[shopCode] || 'Unmapped';

            if (!sectorsMap[sectorId]) {
                // Look up by serialNo (numeric match)
                const matchedConfig = sectorsConfig.find(s => String(s.serialNo) === String(sectorId)) || {};
                sectorsMap[sectorId] = {
                    sectorName: matchedConfig.sectorName || (sectorId === 'Unmapped' ? 'Unmapped' : `Sector ${sectorId}`),
                    serialNo: sectorId,
                    transporter: matchedConfig.transporter || '',
                    mobileNumber: matchedConfig.mobile || '',
                    block: matchedConfig.block || matchedConfig.districtOffice || shop.issuePoint || '',
                    allocation: 0,
                    dispatch: 0,
                    posReceipt: 0,
                    totalShops: mappedCounts[sectorId] || 0,
                    shops: []
                };
            }

            totalAllocation += alloc;
            totalDispatch += disp;
            totalPOSReceipt += rec;

            sectorsMap[sectorId].allocation += alloc;
            sectorsMap[sectorId].dispatch += disp;
            sectorsMap[sectorId].posReceipt += rec;

            const commodities = {};
            if (shop.commodities) {
                for (const [key, val] of Object.entries(shop.commodities)) {
                    commodities[key] = parseNumeric(val);
                }
            } else {
                ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                    if (shop[`${c}Allotted`] !== undefined) {
                        commodities[c] = parseNumeric(shop[`${c}Allotted`]);
                    }
                });
            }

            const dispatchCommodities = {};
            if (shop.dispatchCommodities) {
                for (const [key, val] of Object.entries(shop.dispatchCommodities)) {
                    dispatchCommodities[key] = parseNumeric(val);
                }
            } else {
                ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                    if (shop[`${c}Dispatched`] !== undefined) {
                        dispatchCommodities[c] = parseNumeric(shop[`${c}Dispatched`]);
                    }
                });
            }

            const existingShop = sectorsMap[sectorId].shops.find(s => s.shopCode === shopCode);
            if (existingShop) {
                existingShop.allocation += alloc;
                existingShop.dispatch += disp;
                existingShop.posReceipt += rec;
                
                for (const [key, val] of Object.entries(commodities)) {
                    existingShop.commodities[key] = (existingShop.commodities[key] || 0) + val;
                }
                for (const [key, val] of Object.entries(dispatchCommodities)) {
                    existingShop.dispatchCommodities[key] = (existingShop.dispatchCommodities[key] || 0) + val;
                }
            } else {
                const details = shopsDetails[shopCode] || {};
                const extractedName = details.shopName || shop.shopName || shopCode;
                const formattedName = `${extractedName} (${shopCode})`;

                sectorsMap[sectorId].shops.push({
                    shopCode: shopCode,
                    shopName: formattedName,
                    issuePoint: shop.issuePoint || '',
                    allocation: alloc,
                    dispatch: disp,
                    posReceipt: rec,
                    commodities: commodities,
                    dispatchCommodities: dispatchCommodities
                });
            }
        });

        const dispatchPercentage = totalAllocation > 0 ? (totalDispatch / totalAllocation) * 100 : 0;

        const sectors = Object.values(sectorsMap).map(s => {
            s.dispatchPercentage = s.allocation > 0 ? (s.dispatch / s.allocation) * 100 : 0;
            s.receiptPercentage = s.allocation > 0 ? (s.posReceipt / s.allocation) * 100 : 0;
            s.dispatchReceiptDiffPercentage = s.dispatchPercentage - s.receiptPercentage;
            return s;
        });

        // Sort sectors by serialNo
        sectors.sort((a, b) => {
            if (a.serialNo === 'Unmapped') return 1;
            if (b.serialNo === 'Unmapped') return -1;
            return parseInt(a.serialNo) - parseInt(b.serialNo);
        });

        const totalReceiptPercentage = totalAllocation > 0 ? Number(((totalPOSReceipt / totalAllocation) * 100).toFixed(2)) : 0;
        const totalDiffPercentage = Number((dispatchPercentage - totalReceiptPercentage).toFixed(2));

        return {
            totals: {
                totalAllocation: Number(totalAllocation.toFixed(2)),
                totalDispatch: Number(totalDispatch.toFixed(2)),
                totalPOSReceipt: Number(totalPOSReceipt.toFixed(2)),
                dispatchPercentage: Number(dispatchPercentage.toFixed(2)),
                receiptPercentage: totalReceiptPercentage,
                dispatchReceiptDiffPercentage: totalDiffPercentage
            },
            verification: combinedVerificationTotals || {},
            processedCategories: processedCategories || [],
            expectedCategories: expectedCategories || [],
            sectors: sectors
        };
    }
}

module.exports = DataProcessor;
