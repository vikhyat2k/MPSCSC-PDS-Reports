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

// Official MDM shop counts per issue point (from portal MDM Shops Status page)
let mdmOfficialCounts = {};
try {
    const mdmCountsPath = path.join(__dirname, '../../config/mdm-shop-counts.json');
    mdmOfficialCounts = JSON.parse(fs.readFileSync(mdmCountsPath, 'utf8'));
} catch (e) {
    console.error('Could not load mdm-shop-counts.json', e);
}

class MDMDataProcessor {

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

    processData(rawData, summaryTotals) {
        let totalAllotted = 0;
        let totalDispatched = 0;
        let totalReceived = 0;
        let totalWheatAllotted = 0, totalWheatDispatched = 0, totalWheatReceived = 0;
        let totalRiceAllotted = 0, totalRiceDispatched = 0, totalRiceReceived = 0;


        // Shops to ignore as they are not mapped and not required in the report
        const ignoredShops = new Set(['3105105', '3102013', '3102016', '3101056', '3110062']);
        
        const validData = (Array.isArray(rawData) ? rawData : []).filter(shop => !ignoredShops.has(String(shop.shopCode)));


        
        const sectorsMap = {};
        const shops = validData;

        // Values are already in Quintals from the scraper — this is a generic numeric parser.
        // ⚠️ DO NOT add any unit conversion (e.g. /100) here. The Kg→Quintal conversion
        // happens exactly once, upstream in mdm_scraper.js.
        const parseNumeric = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        let totalSchools = 0, totalInmates = 0;

        shops.forEach(shop => {
            // Values already arrive in Quintals from the scraper (conversion happens once, upstream) — do not divide again here.
            const wheatAlloc = parseNumeric(shop.wheatAllotted || 0);
            const riceAlloc = parseNumeric(shop.fortifiedRiceAllotted || shop.riceAllotted || 0);
            const totalAlloc = wheatAlloc + riceAlloc;

            const wheatDisp = parseNumeric(shop.wheatDispatched || 0);
            const riceDisp = parseNumeric(shop.fortifiedRiceDispatched || shop.riceDispatched || 0);
            const totalDisp = wheatDisp + riceDisp;

            const wheatRec = parseNumeric(shop.wheatReceived || 0);
            const riceRec = parseNumeric(shop.fortifiedRiceReceived || shop.riceReceived || 0);
            const totalRec = wheatRec + riceRec;

            const schools = parseNumeric(shop.schoolsCount || 0);
            const inmates = parseNumeric(shop.inmatesCount || 0);

            if (totalAlloc === 0 && totalDisp === 0 && totalRec === 0 && schools === 0) return;

            const shopCode = shop.shopCode || '';
            const sectorId = this.shopMapping[shopCode] || 'Unmapped';

            if (!sectorsMap[sectorId]) {
                const matchedConfig = sectorsConfig.find(s => String(s.serialNo) === String(sectorId)) || {};
                sectorsMap[sectorId] = {
                    sectorName: matchedConfig.sectorName || (sectorId === 'Unmapped' ? 'Unmapped' : `Sector ${sectorId}`),
                    serialNo: sectorId,
                    transporter: matchedConfig.transporter || '',
                    mobileNumber: matchedConfig.mobile || '',
                    block: matchedConfig.block || matchedConfig.districtOffice || shop.issuePoint || '',
                    allotted: 0,
                    dispatched: 0,
                    received: 0,
                    wheatAllotted: 0,
                    wheatDispatched: 0,
                    wheatReceived: 0,
                    fortifiedRiceAllotted: 0,
                    fortifiedRiceDispatched: 0,
                    fortifiedRiceReceived: 0,
                    schoolsCount: 0,
                    inmatesCount: 0,
                    totalShops: 0, // computed after rawData is processed
                    shops: []
                };
            }

            totalAllotted += totalAlloc;
            totalDispatched += totalDisp;
            totalReceived += totalRec;
            totalWheatAllotted += wheatAlloc;
            totalWheatDispatched += wheatDisp;
            totalWheatReceived += wheatRec;
            totalRiceAllotted += riceAlloc;
            totalRiceDispatched += riceDisp;
            totalRiceReceived += riceRec;
            totalSchools += schools;
            totalInmates += inmates;

            sectorsMap[sectorId].allotted += totalAlloc;
            sectorsMap[sectorId].dispatched += totalDisp;
            sectorsMap[sectorId].received += totalRec;
            sectorsMap[sectorId].wheatAllotted += wheatAlloc;
            sectorsMap[sectorId].wheatDispatched += wheatDisp;
            sectorsMap[sectorId].wheatReceived += wheatRec;
            sectorsMap[sectorId].fortifiedRiceAllotted += riceAlloc;
            sectorsMap[sectorId].fortifiedRiceDispatched += riceDisp;
            sectorsMap[sectorId].fortifiedRiceReceived += riceRec;
            sectorsMap[sectorId].schoolsCount += schools;
            sectorsMap[sectorId].inmatesCount += inmates;

            
            const existingShop = sectorsMap[sectorId].shops.find(s => s.shopCode === shopCode);
            if (existingShop) {
                existingShop.allocation += totalAlloc;
                existingShop.dispatch += totalDisp;
                existingShop.posReceipt += totalRec;
                existingShop.commodities.wheat += wheatAlloc;
                existingShop.commodities.rice += riceAlloc;
                existingShop.wheatAllotted += wheatAlloc;
                existingShop.wheatDispatched += wheatDisp;
                existingShop.wheatReceived += wheatRec;
                existingShop.fortifiedRiceAllotted += riceAlloc;
                existingShop.fortifiedRiceDispatched += riceDisp;
                existingShop.fortifiedRiceReceived += riceRec;
                existingShop.schoolsCount += schools;
                existingShop.inmatesCount += inmates;
            } else {
                const details = shopsDetails[shopCode] || {};
                const extractedName = details.shopName || shop.shopName || shopCode;
                const formattedName = `${extractedName} (${shopCode})`;

                sectorsMap[sectorId].shops.push({
                    shopCode: shopCode,
                    shopName: formattedName,
                    issuePoint: shop.issuePoint || '',
                    allocation: totalAlloc,
                    dispatch: totalDisp,
                    posReceipt: totalRec,
                    commodities: {
                        wheat: wheatAlloc,
                        rice: riceAlloc
                    },
                    wheatAllotted: wheatAlloc,
                    wheatDispatched: wheatDisp,
                    wheatReceived: wheatRec,
                    fortifiedRiceAllotted: riceAlloc,
                    fortifiedRiceDispatched: riceDisp,
                    fortifiedRiceReceived: riceRec,
                    schoolsCount: schools,
                    inmatesCount: inmates
                });
            }
        });

        const totalDispatchPct = totalAllotted > 0 ? (totalDispatched / totalAllotted) * 100 : 0;

        let totalShopsLeft = 0;
        let totalMdmShops = 0;

        const sectors = Object.values(sectorsMap).map(s => {
            s.dispatchPercentage = s.allotted > 0 ? (s.dispatched / s.allotted) * 100 : 0;
            s.receiptPercentage = s.allotted > 0 ? (s.received / s.allotted) * 100 : 0;
            s.wheatDispatchPct = s.wheatAllotted > 0 ? (s.wheatDispatched / s.wheatAllotted) * 100 : 0;
            s.wheatReceiptPct = s.wheatDispatched > 0 ? (s.wheatReceived / s.wheatDispatched) * 100 : 0;
            s.fortifiedRiceDispatchPct = s.fortifiedRiceAllotted > 0 ? (s.fortifiedRiceDispatched / s.fortifiedRiceAllotted) * 100 : 0;
            s.fortifiedRiceReceiptPct = s.fortifiedRiceDispatched > 0 ? (s.fortifiedRiceReceived / s.fortifiedRiceDispatched) * 100 : 0;
            s.totalAllotted = s.allotted;
            s.totalDispatched = s.dispatched;
            s.totalReceived = s.received;

            const pendingShops = [];
            if (s.shops) {
                s.shops.forEach(shop => {
                    const wA = shop.wheatAllotted || 0;
                    const wD = shop.wheatDispatched || 0;
                    const rA = shop.fortifiedRiceAllotted || shop.riceAllotted || 0;
                    const rD = shop.fortifiedRiceDispatched || shop.riceDispatched || 0;
                    const bal = (wA - wD) + (rA - rD);
                    if (bal > 0) {
                        pendingShops.push({
                            shopCode: shop.shopCode,
                            shopName: shop.shopName || shop.shopCode,
                            balance: parseFloat(bal.toFixed(2)),
                            commodities: {
                                wheat: { balance: parseFloat(Math.max(0, wA - wD).toFixed(2)) },
                                rice: { balance: parseFloat(Math.max(0, rA - rD).toFixed(2)) }
                            }
                        });
                    }
                });
            }
            s.mdmShops = pendingShops;
            s.shopsLeft = pendingShops.length;
            totalShopsLeft += pendingShops.length;
            s.totalSchools = s.schoolsCount || 0;
            s.totalInmates = s.inmatesCount || 0;
            s.totalShops = s.shops ? s.shops.length : 0;
            s.mdmShopCount = s.totalShops;
            if (s.serialNo !== 'Unmapped') totalMdmShops += s.totalShops;

            return s;
        });

        sectors.sort((a, b) => {
            if (a.serialNo === 'Unmapped') return 1;
            if (b.serialNo === 'Unmapped') return -1;
            return parseInt(a.serialNo) - parseInt(b.serialNo);
        });

        return {
            totals: {
                totalAllotted: Number(totalAllotted.toFixed(2)),
                totalDispatched: Number(totalDispatched.toFixed(2)),
                totalReceived: Number(totalReceived.toFixed(2)),
                totalDispatchPct: Number(totalDispatchPct.toFixed(2)),
                wheatAllotted: Number(totalWheatAllotted.toFixed(2)),
                wheatDispatched: Number(totalWheatDispatched.toFixed(2)),
                wheatReceived: Number(totalWheatReceived.toFixed(2)),
                wheatDispatchPct: totalWheatAllotted > 0 ? (totalWheatDispatched / totalWheatAllotted) * 100 : 0,
                fortifiedRiceAllotted: Number(totalRiceAllotted.toFixed(2)),
                fortifiedRiceDispatched: Number(totalRiceDispatched.toFixed(2)),
                fortifiedRiceReceived: Number(totalRiceReceived.toFixed(2)),
                fortifiedRiceDispatchPct: totalRiceAllotted > 0 ? Number((totalRiceDispatched / totalRiceAllotted * 100).toFixed(2)) : 0,
                totalReceiptPct: totalAllotted > 0 ? Number((totalReceived / totalAllotted * 100).toFixed(2)) : 0,
                totalShopsLeft: totalShopsLeft,
                totalMdmShops: totalMdmShops,
                totalSchools: totalSchools,
                totalInmates: totalInmates
            },
            verification: summaryTotals || {},
            sectors: sectors
        };
    }
}

module.exports = MDMDataProcessor;
