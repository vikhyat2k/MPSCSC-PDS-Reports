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

// Official ICDS shop counts per issue point (from portal ICDS RO Status page)
let icdsOfficialCounts = {};
try {
    const icdsCountsPath = path.join(__dirname, '../../config/icds-shop-counts.json');
    icdsOfficialCounts = JSON.parse(fs.readFileSync(icdsCountsPath, 'utf8'));
} catch (e) {
    console.error('Could not load icds-shop-counts.json', e);
}

class ICDSDataProcessor {

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
        let totalSaltAllotted = 0, totalSaltDispatched = 0, totalSaltReceived = 0;



        
        const sectorsMap = {};
        const shops = Array.isArray(rawData) ? rawData : [];

        // Values are already in Quintals from the scraper — this is a generic numeric parser.
        // ⚠️ DO NOT add any unit conversion (e.g. /100) here. The Kg→Quintal conversion
        // happens exactly once, upstream in icds_scraper.js.
        const parseNumeric = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        let totalAwc = 0, totalInmates = 0;

        shops.forEach(shop => {
            // ICDS typical commodities: wheat, rice, fsalt
            const wheatAlloc = parseNumeric(shop.wheatAllotted || 0);
            const riceAlloc = parseNumeric(shop.riceAllotted || 0);
            const saltAlloc = parseNumeric(shop.fsaltAllotted || 0);
            const totalAlloc = wheatAlloc + riceAlloc + saltAlloc;

            const wheatDisp = parseNumeric(shop.wheatDispatched || 0);
            const riceDisp = parseNumeric(shop.riceDispatched || 0);
            const saltDisp = parseNumeric(shop.fsaltDispatched || 0);
            const totalDisp = wheatDisp + riceDisp + saltDisp;

            const wheatRec = parseNumeric(shop.wheatReceived || 0);
            const riceRec = parseNumeric(shop.riceReceived || 0);
            const saltRec = parseNumeric(shop.fsaltReceived || 0);
            const totalRec = wheatRec + riceRec + saltRec;

            const awc = parseNumeric(shop.awcCount || 0);
            const inmates = parseNumeric(shop.inmatesCount || 0);

            if (totalAlloc === 0 && totalDisp === 0 && totalRec === 0 && awc === 0) return;

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
                    riceAllotted: 0,
                    riceDispatched: 0,
                    riceReceived: 0,
                    fsaltAllotted: 0,
                    fsaltDispatched: 0,
                    fsaltReceived: 0,
                    awcCount: 0,
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
            totalSaltAllotted += saltAlloc;
            totalSaltDispatched += saltDisp;
            totalSaltReceived += saltRec;
            totalAwc += awc;
            totalInmates += inmates;

            sectorsMap[sectorId].allotted += totalAlloc;
            sectorsMap[sectorId].dispatched += totalDisp;
            sectorsMap[sectorId].received += totalRec;
            sectorsMap[sectorId].wheatAllotted += wheatAlloc;
            sectorsMap[sectorId].wheatDispatched += wheatDisp;
            sectorsMap[sectorId].wheatReceived += wheatRec;
            sectorsMap[sectorId].riceAllotted += riceAlloc;
            sectorsMap[sectorId].riceDispatched += riceDisp;
            sectorsMap[sectorId].riceReceived += riceRec;
            sectorsMap[sectorId].fsaltAllotted += saltAlloc;
            sectorsMap[sectorId].fsaltDispatched += saltDisp;
            sectorsMap[sectorId].fsaltReceived += saltRec;
            sectorsMap[sectorId].awcCount += awc;
            sectorsMap[sectorId].inmatesCount += inmates;

            
            const existingShop = sectorsMap[sectorId].shops.find(s => s.shopCode === shopCode);
            if (existingShop) {
                existingShop.allocation += totalAlloc;
                existingShop.dispatch += totalDisp;
                existingShop.posReceipt += totalRec;
                existingShop.commodities.wheat += wheatAlloc;
                existingShop.commodities.rice += riceAlloc;
                existingShop.commodities.salt += saltAlloc;
                existingShop.wheatAllotted += wheatAlloc;
                existingShop.wheatDispatched += wheatDisp;
                existingShop.wheatReceived += wheatRec;
                existingShop.riceAllotted += riceAlloc;
                existingShop.riceDispatched += riceDisp;
                existingShop.riceReceived += riceRec;
                existingShop.fsaltAllotted += saltAlloc;
                existingShop.fsaltDispatched += saltDisp;
                existingShop.fsaltReceived += saltRec;
                existingShop.awcCount += awc;
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
                        rice: riceAlloc,
                        salt: saltAlloc
                    },
                    wheatAllotted: wheatAlloc,
                    wheatDispatched: wheatDisp,
                    wheatReceived: wheatRec,
                    riceAllotted: riceAlloc,
                    riceDispatched: riceDisp,
                    riceReceived: riceRec,
                    fsaltAllotted: saltAlloc,
                    fsaltDispatched: saltDisp,
                    fsaltReceived: saltRec,
                    awcCount: awc,
                    inmatesCount: inmates
                });
            }
        });

        const totalDispatchPct = totalAllotted > 0 ? (totalDispatched / totalAllotted) * 100 : 0;

        let totalShopsLeft = 0;
        let totalIcdsShops = 0;

        const sectors = Object.values(sectorsMap).map(s => {
            s.dispatchPercentage = s.allotted > 0 ? (s.dispatched / s.allotted) * 100 : 0;
            s.receiptPercentage = s.allotted > 0 ? (s.received / s.allotted) * 100 : 0;
            s.wheatDispatchPct = s.wheatAllotted > 0 ? (s.wheatDispatched / s.wheatAllotted) * 100 : 0;
            s.wheatReceiptPct = s.wheatDispatched > 0 ? (s.wheatReceived / s.wheatDispatched) * 100 : 0;
            s.riceDispatchPct = s.riceAllotted > 0 ? (s.riceDispatched / s.riceAllotted) * 100 : 0;
            s.riceReceiptPct = s.riceDispatched > 0 ? (s.riceReceived / s.riceDispatched) * 100 : 0;
            s.fsaltDispatchPct = s.fsaltAllotted > 0 ? (s.fsaltDispatched / s.fsaltAllotted) * 100 : 0;
            s.fsaltReceiptPct = s.fsaltDispatched > 0 ? (s.fsaltReceived / s.fsaltDispatched) * 100 : 0;
            s.totalAllotted = s.allotted;
            s.totalDispatched = s.dispatched;
            s.totalReceived = s.received;

            const pendingShops = [];
            if (s.shops) {
                s.shops.forEach(shop => {
                    const wA = shop.wheatAllotted || 0;
                    const wD = shop.wheatDispatched || 0;
                    const rA = shop.riceAllotted || 0;
                    const rD = shop.riceDispatched || 0;
                    const sA = shop.fsaltAllotted || 0;
                    const sD = shop.fsaltDispatched || 0;
                    const bal = (wA - wD) + (rA - rD) + (sA - sD);
                    if (bal > 0) {
                        pendingShops.push({
                            shopCode: shop.shopCode,
                            shopName: shop.shopName || shop.shopCode,
                            balance: parseFloat(bal.toFixed(2)),
                            commodities: {
                                wheat: { balance: parseFloat(Math.max(0, wA - wD).toFixed(2)) },
                                rice: { balance: parseFloat(Math.max(0, rA - rD).toFixed(2)) },
                                salt: { balance: parseFloat(Math.max(0, sA - sD).toFixed(2)) }
                            }
                        });
                    }
                });
            }
            s.icdsShops = pendingShops;
            s.shopsLeft = pendingShops.length;
            totalShopsLeft += pendingShops.length;
            s.totalShops = s.shops ? s.shops.length : 0;
            s.icdsShopCount = s.totalShops;
            if (s.serialNo !== 'Unmapped') totalIcdsShops += s.icdsShopCount;

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
                riceAllotted: Number(totalRiceAllotted.toFixed(2)),
                riceDispatched: Number(totalRiceDispatched.toFixed(2)),
                riceReceived: Number(totalRiceReceived.toFixed(2)),
                riceDispatchPct: totalRiceAllotted > 0 ? (totalRiceDispatched / totalRiceAllotted) * 100 : 0,
                fsaltAllotted: Number(totalSaltAllotted.toFixed(2)),
                fsaltDispatched: Number(totalSaltDispatched.toFixed(2)),
                fsaltReceived: Number(totalSaltReceived.toFixed(2)),
                fsaltDispatchPct: totalSaltAllotted > 0 ? Number((totalSaltDispatched / totalSaltAllotted * 100).toFixed(2)) : 0,
                totalReceiptPct: totalAllotted > 0 ? Number((totalReceived / totalAllotted * 100).toFixed(2)) : 0,
                totalShopsLeft: totalShopsLeft,
                totalIcdsShops: totalIcdsShops,
                totalAwc: totalAwc,
                totalInmates: totalInmates
            },
            verification: summaryTotals || {},
            sectors: sectors
        };
    }
}

module.exports = ICDSDataProcessor;
