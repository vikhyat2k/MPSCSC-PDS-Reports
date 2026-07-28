const fs = require('fs');
const path = require('path');

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
        
        const sectorsMap = {};
        const shops = Array.isArray(rawData) ? rawData : [];

        const parseKg = (val) => {
            if (typeof val === 'number') return val / 100;
            if (typeof val === 'string') {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed / 100;
            }
            return 0;
        };

        shops.forEach(row => {
            const shopCode = row.shopCode || '';
            const sectorId = this.shopMapping[shopCode] || 'Unmapped';
            const sectorName = sectorId === 'Unmapped' ? 'Unmapped' : `Sector ${sectorId}`;

            if (!sectorsMap[sectorId]) {
                sectorsMap[sectorId] = {
                    sectorName: sectorName,
                    serialNo: sectorId,
                    transporter: '',
                    block: '',
                    dispatch: 0,
                    shops: []
                };
            }

            const disp = parseKg(row.dispatch || 0);
            totalDispatch += disp;
            sectorsMap[sectorId].dispatch += disp;

            const commodities = {};
            if (row.dispatchCommodities) {
                for (const [key, val] of Object.entries(row.dispatchCommodities)) {
                    commodities[key] = parseKg(val);
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

            sectorsMap[sectorId].shops.push({
                shopCode: shopCode,
                shopName: row.shopName || shopCode,
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
