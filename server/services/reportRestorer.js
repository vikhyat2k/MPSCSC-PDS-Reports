const fs = require('fs');
const path = require('path');
const DataProcessor = require('./dataProcessor');
const MDMDataProcessor = require('./mdmDataProcessor');
const ICDSDataProcessor = require('./icdsDataProcessor');
const WelfareDataProcessor = require('./welfareDataProcessor');
const NFSADaterangeDataProcessor = require('./nfsaDaterangeDataProcessor');
const AnalyticsService = require('./analytics');

let sectorsConfig = [];
try {
    const configPath = path.join(__dirname, '../../config/sectors.json');
    sectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Could not load sectors.json in reportRestorer.js', e);
}

const dataProcessor = new DataProcessor();
const mdmDataProcessor = new MDMDataProcessor();
const icdsDataProcessor = new ICDSDataProcessor();
const welfareDataProcessor = new WelfareDataProcessor();
const nfsaDaterangeDataProcessor = new NFSADaterangeDataProcessor();
const analytics = new AnalyticsService();

const cap = (val) => Math.min(100, Math.max(0, val));

function computeMDMAnalytics(processedResult) {
    const { sectors, totals } = processedResult;
    const activeSectors = sectors.filter(s => (s.totalAllotted || s.allotted) > 0);
    


    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        data.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            stats[name].dispatchSum += (s.wheatDispatched + (s.fortifiedRiceDispatched || s.riceDispatched || 0));
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => ({
                name: g.transporters.map(t => t.name).join(', '),
                dispatchPct: g.avgDispatch.toFixed(2),
                sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0)
            }));
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 5);

    const insights = [];
    const wPct = totals.wheatDispatchPct;
    const rPct = totals.fortifiedRiceDispatchPct;
    const totalPct = totals.totalDispatchPct;

    if (totalPct >= 100) insights.push({ icon: '🎉', severity: 'success', message: '100% dispatch achieved for all commodities!' });
    else if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    const wheatBal = parseFloat((totals.wheatAllotted - totals.wheatDispatched).toFixed(2));
    const riceBal = parseFloat((totals.fortifiedRiceAllotted - totals.fortifiedRiceDispatched).toFixed(2));

    if (wheatBal > 0) insights.push({ icon: '🌾', severity: 'info', message: `Wheat balance pending dispatch: ${wheatBal} Qt (${(100 - wPct).toFixed(1)}% remaining).` });
    if (riceBal > 0) insights.push({ icon: '🍚', severity: 'info', message: `Fortified Rice balance pending: ${riceBal} Qt (${(100 - rPct).toFixed(1)}% remaining).` });

    const pendingSectors = activeSectors.filter(s => s.wheatDispatchPct < 100 || s.fortifiedRiceDispatchPct < 100);
    if (pendingSectors.length === 0) {
        insights.push({ icon: '🏆', severity: 'success', message: 'All sectors have completed 100% dispatch!' });
    } else {
        insights.push({ icon: '📋', severity: 'info', message: `${pendingSectors.length} of ${activeSectors.length} sectors have pending dispatch.` });
    }

    const needsAttention = [];
    let mdmTotalShopsLeft = 0;
    activeSectors.forEach(s => {
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
        if (pendingShops.length > 0) {
            mdmTotalShopsLeft += pendingShops.length;
            s.shopsLeft = pendingShops.length;
            needsAttention.push({
                sectorName: s.sectorName,
                transporter: s.transporter,
                balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
                pendingShops: pendingShops
            });
        }
    });

    const matrix = activeSectors.map(s => ({
        name: s.sectorName,
        block: s.block,
        transporter: s.transporter,
        mobile: s.mobile,
        shops: s.totalShops || (s.shops ? s.shops.length : 0),
        wheatAllotted: s.wheatAllotted,
        wheatDispatched: s.wheatDispatched,
        wheatReceived: s.wheatReceived,
        wheatDispatchPct: s.wheatDispatchPct,
        wheatReceiptPct: s.wheatReceiptPct,
        riceAllotted: s.fortifiedRiceAllotted,
        riceDispatched: s.fortifiedRiceDispatched,
        riceReceived: s.fortifiedRiceReceived,
        riceDispatchPct: s.fortifiedRiceDispatchPct,
        riceReceiptPct: s.fortifiedRiceReceiptPct,
        totalAllotted: s.totalAllotted,
        totalDispatched: s.totalDispatched,
        totalReceived: s.totalReceived
    }));

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: Math.min(totals.wheatDispatched, totals.wheatAllotted),
            wheatReceived: Math.min(totals.wheatReceived, totals.wheatAllotted),
            wheatDispatchPct: Math.min(100, totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatAllotted > 0
                ? Math.min(100, parseFloat(((Math.min(totals.wheatReceived, totals.wheatAllotted) / totals.wheatAllotted) * 100).toFixed(2))) : 0,
            riceAllotted: totals.fortifiedRiceAllotted,
            riceDispatched: Math.min(totals.fortifiedRiceDispatched, totals.fortifiedRiceAllotted),
            riceReceived: Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted),
            riceDispatchPct: Math.min(100, totals.fortifiedRiceDispatchPct),
            riceReceiptPct: totals.fortifiedRiceAllotted > 0
                ? Math.min(100, parseFloat(((Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted) / totals.fortifiedRiceAllotted) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: parseFloat((Math.min(totals.wheatDispatched, totals.wheatAllotted) + Math.min(totals.fortifiedRiceDispatched, totals.fortifiedRiceAllotted)).toFixed(2)),
            totalReceived: parseFloat((Math.min(totals.wheatReceived, totals.wheatAllotted) + Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted)).toFixed(2)),
            totalDispatchPct: Math.min(100, totals.totalDispatchPct || 0),
            totalReceiptPct: totals.totalAllotted > 0 ? Math.min(100, (parseFloat((Math.min(totals.wheatReceived, totals.wheatAllotted) + Math.min(totals.fortifiedRiceReceived, totals.fortifiedRiceAllotted))) / totals.totalAllotted) * 100) : 0,
            totalShops: totals.totalMdmShops,
            totalShopsLeft: mdmTotalShopsLeft,
            activeSectors: activeSectors.length
        },
        matrix,
        needsAttention,
        topTransporters,
        bottomTransporters,
        insights
    };
}

function computeICDSAnalytics(processedResult) {
    const { sectors, totals } = processedResult;
    const activeSectors = sectors.filter(s => (s.totalAllotted || s.allotted) > 0);
    
    let totalIcdsShopsLeft = 0;
    activeSectors.forEach(s => {
        const pendingShops = [];
        if (s.shops) s.shops.forEach(shop => {
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
        s.icdsShops = pendingShops;
        s.shopsLeft = pendingShops.length;
        totalIcdsShopsLeft += pendingShops.length;
    });
    totals.totalShopsLeft = totalIcdsShopsLeft;

    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        const filteredData = sortOrder === 'desc' ? data.filter(s => (s.wheatDispatched + s.riceDispatched + (s.fsaltDispatched || 0)) > 0) : data;

        filteredData.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            stats[name].dispatchSum += (s.wheatDispatched + s.riceDispatched + (s.fsaltDispatched || 0));
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => {
                g.transporters.sort((a, b) => a.name.localeCompare(b.name, 'hi'));
                return {
                    name: g.transporters.map(t => t.name).join(', '),
                    dispatchPct: g.avgDispatch.toFixed(2),
                    sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0)
                };
            });
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 5);

    const needsAttention = activeSectors
        .filter(s => s.totalDispatchPct < 100)
        .sort((a, b) => (a.totalDispatchPct - b.totalDispatchPct))
        .map(s => ({
            name: s.sectorName,
            transporter: s.transporter,
            mobile: s.mobile,
            shopsLeft: s.shopsLeft || 0,
            balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
            shops: s.icdsShops || []
        }));

    const matrix = activeSectors.map(s => ({
        name: s.sectorName, block: s.block, transporter: s.transporter, mobile: s.mobile, shops: s.totalShops || (s.shops ? s.shops.length : 0),
        wheatAllotted: s.wheatAllotted, wheatDispatched: s.wheatDispatched, wheatReceived: s.wheatReceived,
        wheatDispatchPct: cap(s.wheatDispatchPct), wheatReceiptPct: cap(s.wheatReceiptPct),
        riceAllotted: s.riceAllotted, riceDispatched: s.riceDispatched, riceReceived: s.riceReceived,
        riceDispatchPct: cap(s.riceDispatchPct), riceReceiptPct: cap(s.riceReceiptPct),
        fsaltAllotted: s.fsaltAllotted, fsaltDispatched: s.fsaltDispatched, fsaltReceived: s.fsaltReceived,
        fsaltDispatchPct: cap(s.fsaltDispatchPct), fsaltReceiptPct: cap(s.fsaltReceiptPct),
        totalAllotted: s.totalAllotted, totalDispatched: s.totalDispatched, totalReceived: s.totalReceived,
        totalDispatchPct: s.totalAllotted > 0 ? cap(parseFloat(((s.totalDispatched / s.totalAllotted) * 100).toFixed(2))) : 0,
        totalReceiptPct: s.totalAllotted > 0 ? cap(parseFloat(((s.totalReceived / s.totalAllotted) * 100).toFixed(2))) : 0
    }));

    const insights = [];
    const totalPct = cap(totals.totalDispatchPct);
    if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total ICDS dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: Math.min(totals.wheatDispatched, totals.wheatAllotted),
            wheatReceived: Math.min(totals.wheatReceived || 0, totals.wheatAllotted),
            wheatDispatchPct: cap(totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatAllotted > 0 ? cap(parseFloat(((Math.min(totals.wheatReceived || 0, totals.wheatAllotted) / totals.wheatAllotted) * 100).toFixed(2))) : 0,
            riceAllotted: totals.riceAllotted,
            riceDispatched: Math.min(totals.riceDispatched, totals.riceAllotted),
            riceReceived: Math.min(totals.riceReceived || 0, totals.riceAllotted),
            riceDispatchPct: cap(totals.riceDispatchPct),
            riceReceiptPct: totals.riceAllotted > 0 ? cap(parseFloat(((Math.min(totals.riceReceived || 0, totals.riceAllotted) / totals.riceAllotted) * 100).toFixed(2))) : 0,
            fsaltAllotted: totals.fsaltAllotted,
            fsaltDispatched: Math.min(totals.fsaltDispatched, totals.fsaltAllotted),
            fsaltReceived: Math.min(totals.fsaltReceived || 0, totals.fsaltAllotted),
            fsaltDispatchPct: cap(totals.fsaltDispatchPct),
            fsaltReceiptPct: totals.fsaltAllotted > 0 ? cap(parseFloat(((Math.min(totals.fsaltReceived || 0, totals.fsaltAllotted) / totals.fsaltAllotted) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: Math.min(totals.totalDispatched, totals.totalAllotted),
            totalReceived: Math.min(totals.totalReceived || 0, totals.totalAllotted),
            totalDispatchPct: cap(totals.totalDispatchPct),
            totalReceiptPct: cap(totals.totalReceiptPct),
            totalShops: totals.totalIcdsShops,
            totalShopsLeft: totalIcdsShopsLeft,
            activeSectors: activeSectors.length
        },
        matrix,
        topTransporters,
        bottomTransporters,
        needsAttention,
        insights
    };
}

function computeWelfareAnalytics(processedResult) {
    const { sectors, totals } = processedResult;
    const activeSectors = sectors.filter(s => (s.totalAllotted || s.allotted) > 0);
    
    let totalWelfareShopsLeft = 0;
    activeSectors.forEach(s => {
        const pendingShops = [];
        if (s.shops) s.shops.forEach(shop => {
            const wA = shop.wheatAllotted || 0;
            const wD = shop.wheatDispatched || 0;
            const rA = shop.riceAllotted || 0;
            const rD = shop.riceDispatched || 0;

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
        s.welfareShops = pendingShops;
        s.shopsLeft = pendingShops.length;
        totalWelfareShopsLeft += pendingShops.length;
    });
    totals.totalShopsLeft = totalWelfareShopsLeft;

    const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
        const stats = {};
        const filteredData = sortOrder === 'desc' ? data.filter(s => (s.wheatDispatched + s.riceDispatched) > 0) : data;

        filteredData.forEach(s => {
            const name = s.transporter || 'N/A';
            if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
            stats[name].dispatchSum += (s.wheatDispatched + s.riceDispatched);
            stats[name].allottedSum += (s.totalAllotted || 0);
            stats[name].count++;
        });

        const list = Object.values(stats).map(t => ({
            name: t.name,
            avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
            sectorCount: t.count
        }));

        const grouped = {};
        list.forEach(t => {
            const pct = t.avgDispatch.toFixed(2);
            if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [] };
            grouped[pct].transporters.push(t);
        });

        return Object.values(grouped)
            .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
            .slice(0, limit)
            .map(g => {
                g.transporters.sort((a, b) => a.name.localeCompare(b.name, 'hi'));
                return {
                    name: g.transporters.map(t => t.name).join(', '),
                    dispatchPct: g.avgDispatch.toFixed(2),
                    sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0)
                };
            });
    };

    const topTransporters = groupTransporters(activeSectors, 'desc', 5);
    const bottomTransporters = groupTransporters(activeSectors, 'asc', 5);

    const needsAttention = activeSectors
        .filter(s => s.totalDispatchPct < 100)
        .sort((a, b) => (a.totalDispatchPct - b.totalDispatchPct))
        .map(s => ({
            name: s.sectorName, transporter: s.transporter,
            mobile: s.mobile,
            shopsLeft: s.shopsLeft || 0,
            balance: parseFloat((s.totalAllotted - s.totalDispatched).toFixed(2)),
            shops: s.welfareShops || []
        }));

    const matrix = activeSectors.map(s => ({
        name: s.sectorName, block: s.block, transporter: s.transporter, mobile: s.mobile, shops: s.totalShops || (s.shops ? s.shops.length : 0),
        wheatAllotted: s.wheatAllotted, wheatDispatched: s.wheatDispatched, wheatReceived: s.wheatReceived,
        wheatDispatchPct: cap(s.wheatDispatchPct), wheatReceiptPct: cap(s.wheatReceiptPct),
        riceAllotted: s.riceAllotted, riceDispatched: s.riceDispatched, riceReceived: s.riceReceived,
        riceDispatchPct: cap(s.riceDispatchPct), riceReceiptPct: cap(s.riceReceiptPct),
        totalAllotted: s.totalAllotted, totalDispatched: s.totalDispatched, totalReceived: s.totalReceived
    }));

    const insights = [];
    const totalPct = cap(totals.totalDispatchPct);
    if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total Welfare dispatch achieved.` });
    else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
    else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

    return {
        metrics: {
            wheatAllotted: totals.wheatAllotted,
            wheatDispatched: Math.min(totals.wheatDispatched, totals.wheatAllotted),
            wheatReceived: Math.min(totals.wheatReceived || 0, totals.wheatAllotted),
            wheatDispatchPct: cap(totals.wheatDispatchPct),
            wheatReceiptPct: totals.wheatAllotted > 0 ? cap(parseFloat(((Math.min(totals.wheatReceived || 0, totals.wheatAllotted) / totals.wheatAllotted) * 100).toFixed(2))) : 0,
            riceAllotted: totals.riceAllotted,
            riceDispatched: Math.min(totals.riceDispatched, totals.riceAllotted),
            riceReceived: Math.min(totals.riceReceived || 0, totals.riceAllotted),
            riceDispatchPct: cap(totals.riceDispatchPct),
            riceReceiptPct: totals.riceAllotted > 0 ? cap(parseFloat(((Math.min(totals.riceReceived || 0, totals.riceAllotted) / totals.riceAllotted) * 100).toFixed(2))) : 0,
            totalAllotted: totals.totalAllotted,
            totalDispatched: Math.min(totals.totalDispatched, totals.totalAllotted),
            totalReceived: Math.min(totals.totalReceived || 0, totals.totalAllotted),
            totalDispatchPct: cap(totals.totalDispatchPct),
            totalReceiptPct: cap(totals.totalReceiptPct),
            totalShops: totals.totalWelfareShops,
            totalShopsLeft: totalWelfareShopsLeft,
            activeSectors: activeSectors.length
        },
        matrix,
        topTransporters,
        bottomTransporters,
        needsAttention,
        insights
    };
}

class ReportRestorer {
    async restoreReport(report) {
        if (!report || !report.raw_data) return null;

        try {
            let rawData;
            try {
                rawData = JSON.parse(report.raw_data);
            } catch (e) {
                return null;
            }

            const scheme = report.scheme || 'nfsa';
            let processedResult;
            let aiInsights = {};

            // Determine if the old report has old AI insights we want to keep
            try {
                if (report.insights) {
                    const parsed = typeof report.insights === 'string' ? JSON.parse(report.insights) : report.insights;
                    if (parsed.aiInsights) aiInsights = parsed.aiInsights;
                }
            } catch (e) {}

            let isDateRange = false;
            let analyticsResult;

            if (scheme === 'nfsa_daterange') {
                const rData = rawData.rawData || rawData;
                const summaryTotals = rawData.summaryTotals || null;
                const allotmentMap = rawData.allotmentMapping || null;
                const fromDate = report.fromDate || report.from_date || '';
                const toDate = report.toDate || report.to_date || '';
                processedResult = nfsaDaterangeDataProcessor.processData(rData, summaryTotals, allotmentMap);
                isDateRange = true;
                analyticsResult = computeNFSADaterangeAnalytics(processedResult, fromDate, toDate, allotmentMap);
                analyticsResult.isDateRange = true;
            } else if (scheme === 'mdm') {
                processedResult = mdmDataProcessor.processData(rawData);
                analyticsResult = computeMDMAnalytics(processedResult);
            } else if (scheme === 'icds') {
                processedResult = icdsDataProcessor.processData(rawData);
                analyticsResult = computeICDSAnalytics(processedResult);
            } else if (scheme === 'welfare') {
                processedResult = welfareDataProcessor.processData(rawData);
                analyticsResult = computeWelfareAnalytics(processedResult);
            } else {
                processedResult = dataProcessor.processData(rawData);
                analyticsResult = analytics.analyzeReport(processedResult, null, null);
            }

            return {
                ...analyticsResult,
                aiInsights
            };

        } catch (error) {
            console.error('Failed to restore report insights:', error);
            return null;
        }
    }
}

module.exports = new ReportRestorer();
