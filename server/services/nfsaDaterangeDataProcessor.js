const fs = require('fs');
const path = require('path');

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

class NFSADaterangeDataProcessor {
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

    processData(rawData, summaryTotals, allotmentMapping) {
        let totalDispatch = 0;
        
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
        // happens exactly once, upstream in nfsa_daterange_scraper.js.
        const parseNumeric = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        shops.forEach(row => {
            const shopCode = row.shopCode || '';
            const disp = parseNumeric(row.dispatch || 0);
            
            let alloc = 0;
            if (allotmentMapping && allotmentMapping[shopCode]) {
                for (const val of Object.values(allotmentMapping[shopCode])) {
                    alloc += parseNumeric(val);
                }
            }

            if (disp === 0 && alloc === 0) return;

            const sectorId = this.shopMapping[shopCode] || 'Unmapped';

            if (!sectorsMap[sectorId]) {
                const matchedConfig = sectorsConfig.find(s => String(s.serialNo) === String(sectorId)) || {};
                sectorsMap[sectorId] = {
                    sectorName: matchedConfig.sectorName || (sectorId === 'Unmapped' ? 'Unmapped' : `Sector ${sectorId}`),
                    serialNo: sectorId,
                    transporter: matchedConfig.transporter || '',
                    mobileNumber: matchedConfig.mobile || '',
                    block: matchedConfig.block || matchedConfig.districtOffice || row.issuePoint || '',
                    dispatch: 0,
                    totalShops: mappedCounts[sectorId] || 0,
                    shops: []
                };
            }

            totalDispatch += disp;
            sectorsMap[sectorId].dispatch += disp;

            const commodities = {};
            if (row.dispatchCommodities) {
                for (const [key, val] of Object.entries(row.dispatchCommodities)) {
                    commodities[key] = parseNumeric(val);
                }
            }

            // Calculate Full/Partial dispatch based on allotmentMapping
            let completenessFlag = '';
            if (allotmentMapping && allotmentMapping[shopCode]) {
                const allottedComms = Object.keys(allotmentMapping[shopCode]);
                const dispatchedComms = Object.keys(commodities).filter(k => commodities[k] > 0);
                
                // If the shop received all commodities it was allotted
                let full = true;
                for (const c of allottedComms) {
                    if (!dispatchedComms.includes(c) || commodities[c] <= 0) {
                        full = false;
                        break;
                    }
                }
                completenessFlag = full ? 'Full' : 'Partial';
            }

            const details = shopsDetails[shopCode] || {};
            const extractedName = details.shopName || row.shopName || shopCode;
            const formattedName = `${extractedName} (${shopCode})`;

            sectorsMap[sectorId].shops.push({
                shopCode: shopCode,
                shopName: formattedName,
                roNo: row.roNo || '',
                truckNo: row.truckNo || '',
                truckChitNo: row.truckChitNo || '',
                dispatch: disp,
                dispatchedDate: row.dispatchedDate || '',
                commodities: commodities,
                completenessFlag: completenessFlag
            });
        });

        const sectors = Object.values(sectorsMap);
        sectors.sort((a, b) => {
            if (a.serialNo === 'Unmapped') return 1;
            if (b.serialNo === 'Unmapped') return -1;
            return parseInt(a.serialNo) - parseInt(b.serialNo);
        });

        return {
            totals: {
                totalDispatch: Number(totalDispatch.toFixed(2))
            },
            verification: summaryTotals || {},
            sectors: sectors
        };
    }
}

module.exports = NFSADaterangeDataProcessor;
