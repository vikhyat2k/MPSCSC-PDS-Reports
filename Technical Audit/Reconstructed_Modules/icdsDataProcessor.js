const fs = require('fs');
const path = require('path');

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
                    allotted: 0,
                    dispatched: 0,
                    received: 0,
                    shops: []
                };
            }

            // ICDS typical commodities: wheat, rice, fsalt
            const wheatAlloc = parseKg(shop.wheatAllotted || 0);
            const riceAlloc = parseKg(shop.riceAllotted || 0);
            const saltAlloc = parseKg(shop.fsaltAllotted || 0);
            const totalAlloc = wheatAlloc + riceAlloc + saltAlloc;

            const wheatDisp = parseKg(shop.wheatDispatched || 0);
            const riceDisp = parseKg(shop.riceDispatched || 0);
            const saltDisp = parseKg(shop.fsaltDispatched || 0);
            const totalDisp = wheatDisp + riceDisp + saltDisp;

            const wheatRec = parseKg(shop.wheatReceived || 0);
            const riceRec = parseKg(shop.riceReceived || 0);
            const saltRec = parseKg(shop.fsaltReceived || 0);
            const totalRec = wheatRec + riceRec + saltRec;

            totalAllotted += totalAlloc;
            totalDispatched += totalDisp;
            totalReceived += totalRec;

            sectorsMap[sectorId].allotted += totalAlloc;
            sectorsMap[sectorId].dispatched += totalDisp;
            sectorsMap[sectorId].received += totalRec;

            sectorsMap[sectorId].shops.push({
                shopCode: shopCode,
                shopName: shop.shopName || shopCode,
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
                riceAllotted: riceAlloc,
                riceDispatched: riceDisp,
                fsaltAllotted: saltAlloc,
                fsaltDispatched: saltDisp
            });
        });

        const totalDispatchPct = totalAllotted > 0 ? (totalDispatched / totalAllotted) * 100 : 0;

        const sectors = Object.values(sectorsMap).map(s => {
            s.dispatchPercentage = s.allotted > 0 ? (s.dispatched / s.allotted) * 100 : 0;
            s.receiptPercentage = s.dispatched > 0 ? (s.received / s.dispatched) * 100 : 0;
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
                totalDispatchPct: Number(totalDispatchPct.toFixed(2))
            },
            verification: summaryTotals || {},
            sectors: sectors
        };
    }
}

module.exports = ICDSDataProcessor;
