const fs = require('fs');
const path = require('path');

let sectorsConfig = [];
try {
    const configPath = path.join(__dirname, '../../config/sectors.json');
    sectorsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.error('Could not load sectors.json', e);
}

class AnalyticsService {
    analyzeReport(processedResult, previousReport, previousSectorAnalytics) {
        const metrics = {
            totalAllocation: 0,
            totalDispatch: 0,
            totalPOSReceipt: 0,
            dispatchPercentage: 0,
            monthOverMonthDelta: 0
        };

        const needsAttention = [];
        const allSectors = [];

        if (processedResult && processedResult.totals) {
            metrics.totalAllocation = processedResult.totals.totalAllocation || processedResult.totals.totalAllotted || 0;
            metrics.totalDispatch = processedResult.totals.totalDispatch || processedResult.totals.totalDispatched || 0;
            metrics.totalPOSReceipt = processedResult.totals.totalPOSReceipt || processedResult.totals.totalReceived || 0;
            metrics.dispatchPercentage = processedResult.totals.dispatchPercentage || processedResult.totals.totalDispatchPct || 0;
        }

        // Calculate Month over Month delta
        if (previousSectorAnalytics && previousSectorAnalytics.length > 0) {
            // compute average previous dispatch %
            const sumPrev = previousSectorAnalytics.reduce((sum, s) => sum + (s.dispatchPercentage || 0), 0);
            const avgPrev = sumPrev / previousSectorAnalytics.length;
            metrics.monthOverMonthDelta = Number((metrics.dispatchPercentage - avgPrev).toFixed(2));
        } else if (previousReport && previousReport.insights && previousReport.insights.metrics) {
            const prevDispPct = previousReport.insights.metrics.dispatchPercentage || 0;
            metrics.monthOverMonthDelta = Number((metrics.dispatchPercentage - prevDispPct).toFixed(2));
        }

        // Extract Defaulters and build Sector Matrix
        if (processedResult && processedResult.sectors) {
            processedResult.sectors.forEach(sector => {
                
                // Add to allSectors for the UI matrix
                allSectors.push({
                    name: sector.sectorName || sector.name,
                    dispatchPercentage: sector.dispatchPercentage,
                    receivingPercentage: sector.receiptPercentage,
                    balance: (sector.allocation || 0) - (sector.dispatch || 0),
                    transporter: sector.transporter || 'N/A'
                });

                if (sector.shops) {
                    sector.shops.forEach(shop => {
                        const alloc = shop.allocation || shop.allotted || 0;
                        const disp = shop.dispatch || shop.dispatched || 0;
                        const balance = alloc - disp;

                        if (balance > 0) {
                            needsAttention.push({
                                shopCode: shop.shopCode,
                                shopName: shop.shopName,
                                balance: Number(balance.toFixed(2)),
                                sectorName: sector.sectorName,
                                transporter: sector.transporter || 'N/A',
                                commodities: shop.commodities || {}
                            });
                        }
                    });
                } else {
                    // For DateRange which only has dispatch
                    if (sector.dispatch === 0) {
                        needsAttention.push({
                            sectorName: sector.sectorName,
                            issue: 'Zero Dispatch'
                        });
                    }
                }
            });
        }

        metrics.totalPendingShops = needsAttention.length;

        let topTransporters = [];
        let bottomTransporters = [];
        const insights = [];

        if (processedResult && processedResult.sectors) {
            // Aggregate commodity totals
            const commodityTotals = {
                wheat: { alloc: 0, disp: 0 },
                rice: { alloc: 0, disp: 0 },
                sugar: { alloc: 0, disp: 0 },
                salt: { alloc: 0, disp: 0 }
            };
            
            let fullLiftedShops = 0;
            let partialLiftedShops = 0;
            let activeShops = 0;

            const uniqueShopsMap = {};
            processedResult.sectors.forEach(sector => {
                if (sector.shops && Array.isArray(sector.shops)) {
                    sector.shops.forEach(shop => {
                        const code = shop.shopCode || shop.code || shop.shopName;
                        if (!code) return;
                        if (!uniqueShopsMap[code]) {
                            uniqueShopsMap[code] = {
                                allocation: 0,
                                dispatch: 0,
                                commodities: { wheat: 0, rice: 0, sugar: 0, salt: 0 },
                                dispatchCommodities: { wheat: 0, rice: 0, sugar: 0, salt: 0 }
                            };
                        }
                        const target = uniqueShopsMap[code];
                        target.allocation += (parseFloat(shop.allocation) || 0);
                        target.dispatch   += (parseFloat(shop.dispatch) || 0);
                        ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                            if (shop.commodities && shop.commodities[c]) target.commodities[c] += (parseFloat(shop.commodities[c]) || 0);
                            if (shop.dispatchCommodities && shop.dispatchCommodities[c]) target.dispatchCommodities[c] += (parseFloat(shop.dispatchCommodities[c]) || 0);
                        });
                    });
                }
            });

            Object.values(uniqueShopsMap).forEach(shop => {
                const alloc = shop.allocation || 0;
                const disp  = shop.dispatch || 0;
                
                if (alloc > 0 || disp > 0) activeShops++;
                if (disp > 0 && disp >= (alloc * 0.99)) fullLiftedShops++;
                else if (disp > 0) partialLiftedShops++;

                ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                    if (shop.commodities && shop.commodities[c]) commodityTotals[c].alloc += shop.commodities[c];
                    if (shop.dispatchCommodities && shop.dispatchCommodities[c]) commodityTotals[c].disp += shop.dispatchCommodities[c];
                });
            });

            // Generate Insights based on total dispatch %
            const totalPct = metrics.dispatchPercentage;
            
            if (totalPct >= 100) insights.push({ icon: '🎉', severity: 'success', message: '100% dispatch achieved for all commodities!' });
            else if (totalPct >= 90) insights.push({ icon: '✅', severity: 'success', message: `Excellent progress: ${totalPct}% total dispatch achieved.` });
            else if (totalPct >= 70) insights.push({ icon: '📈', severity: 'info', message: `Good progress: ${totalPct}% dispatch. ${(100 - totalPct).toFixed(1)}% remaining.` });
            else insights.push({ icon: '⚠️', severity: 'warning', message: `Only ${totalPct}% dispatched. Acceleration needed.` });

            // Generate Commodity-specific insights
            ['wheat', 'rice', 'sugar', 'salt'].forEach(c => {
                const alloc = commodityTotals[c].alloc;
                const disp = commodityTotals[c].disp;
                if (alloc > 0) {
                    const cPct = (disp / alloc) * 100;
                    const balance = alloc - disp;
                    if (cPct < totalPct - 10 && balance > 0) {
                        const name = c.charAt(0).toUpperCase() + c.slice(1);
                        const icon = c === 'wheat' ? '🌾' : (c === 'rice' ? '🍚' : '📦');
                        insights.push({ icon, severity: 'warning', message: `${name} dispatch (${cPct.toFixed(1)}%) is lagging. Balance pending: ${balance.toFixed(2)} Qt.` });
                    }
                }
            });

            // Shop lifting insights
            if (activeShops > 0) {
                const pendingCount = activeShops - fullLiftedShops;
                if (pendingCount === 0) {
                    insights.push({ icon: '🏪', severity: 'success', message: `All ${activeShops} active FPS shops have received full dispatch.` });
                } else if (fullLiftedShops > 0) {
                    insights.push({ icon: '🏪', severity: 'info', message: `${fullLiftedShops} out of ${activeShops} shops have full dispatch. ${pendingCount} shops pending.` });
                }
            }

            // Include both standard NFSA (allocation) and DateRange (dispatch only)
            const activeSectors = processedResult.sectors.filter(s => (s.allocation || s.dispatch) > 0);
            
            const groupTransporters = (data, sortOrder = 'desc', limit = 5) => {
                const stats = {};
                data.forEach(s => {
                    const name = s.transporter || 'N/A';
                    if (!stats[name]) stats[name] = { name, dispatchSum: 0, allottedSum: 0, count: 0 };
                    // Use depot dispatch (not posReceipt) for % calculation — posReceipt can exceed allocation
                    stats[name].dispatchSum += parseFloat(s.dispatch || 0);
                    // If no allocation exists (DateRange), we can't reliably sort by percentage, 
                    // but we can sort by raw dispatch volume. We'll use allocation if it exists.
                    stats[name].allottedSum += (s.allocation !== undefined ? s.allocation : (s.dispatch || 0));
                    stats[name].count++;
                });

                const list = Object.values(stats).map(t => ({
                    name: t.name,
                    avgDispatch: t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0,
                    sectorCount: t.count,
                    balance: parseFloat((t.allottedSum - t.dispatchSum).toFixed(2))
                }));


                const grouped = {};
                list.forEach(t => {
                    const pct = t.avgDispatch.toFixed(2);
                    if (!grouped[pct]) grouped[pct] = { avgDispatch: parseFloat(pct), transporters: [], balance: 0 };
                    grouped[pct].transporters.push(t);
                    grouped[pct].balance += t.balance;
                });

                return Object.values(grouped)
                    .sort((a, b) => sortOrder === 'desc' ? b.avgDispatch - a.avgDispatch : a.avgDispatch - b.avgDispatch)
                    .slice(0, limit)
                    .map(g => ({
                        name: g.transporters.map(t => t.name).join(', '),
                        dispatchPct: g.avgDispatch.toFixed(2),
                        sectorCount: g.transporters.reduce((sum, t) => sum + t.sectorCount, 0),
                        balance: parseFloat(g.balance.toFixed(2))
                    }));
            };

            if (metrics.totalAllocation > 0) {
                topTransporters = groupTransporters(activeSectors, 'desc', 5);
                bottomTransporters = groupTransporters(activeSectors, 'asc', 10);

                // Build allTransporters flat list (all transporters, including 0-dispatch)
                // Used by District Intelligence / Messenger tab
                const allSectorMap = new Map();
                sectorsConfig.forEach(cfg => {
                    const key = cfg.sectorName;
                    if (!key) return;
                    allSectorMap.set(key, {
                        sectorName: cfg.sectorName,
                        transporter: cfg.transporter || 'N/A',
                        name: `${cfg.transporter || 'N/A'} (${cfg.sectorName})`,
                        dispatchSum: 0,
                        allottedSum: parseFloat(cfg.monthlyAllocation || 0)
                    });
                });
                activeSectors.forEach(s => {
                    const sName = s.sectorName || s.name;
                    const key = sName;
                    const existing = allSectorMap.get(key) || {
                        sectorName: sName,
                        transporter: s.transporter || 'N/A',
                        name: `${s.transporter || 'N/A'} (${sName})`,
                        dispatchSum: 0,
                        allottedSum: 0
                    };
                    existing.dispatchSum += parseFloat(s.dispatch || 0);
                    if (s.allocation !== undefined) {
                        existing.allottedSum = parseFloat(s.allocation || 0);
                    }
                    if (s.transporter) existing.transporter = s.transporter;
                    allSectorMap.set(key, existing);
                });
                const allTransportersList = Array.from(allSectorMap.values()).map(t => {
                    const avgDispatch = t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0;
                    const bal = parseFloat((t.allottedSum - t.dispatchSum).toFixed(2));
                    return {
                        name: t.name,
                        transporter: t.transporter,
                        sectorName: t.sectorName,
                        avgDispatch,
                        dispatchPct: avgDispatch,
                        sectorCount: 1,
                        balance: bal < 0 ? 0 : bal
                    };
                });

                // Add insight for zero-dispatch transporters
                const zeroDispatchTransporters = allTransportersList.filter(t => t.avgDispatch === 0).map(t => t.name);
                if (zeroDispatchTransporters.length > 0) {
                    insights.push({
                        icon: '🚨',
                        severity: 'warning',
                        message: `0 उठाओ की मात्रा वाले परिवहनकर्ता: ${zeroDispatchTransporters.join(', ')}`
                    });
                }

            } else {
                topTransporters = [];
                bottomTransporters = [];
                
                // For Date Range reports (which just have dispatch volume, no allocation)
                // Don't calculate top/bottom based on %, as it's meaningless without allocation.
                
                // Add insight for 0 lifting transporters
                const activeTransporters = new Set(activeSectors.map(s => s.transporter).filter(Boolean));
                const allTransporters = new Set(sectorsConfig.map(s => s.transporter).filter(Boolean));
                
                const zeroLifting = [...allTransporters].filter(t => !activeTransporters.has(t));
                if (zeroLifting.length > 0) {
                    insights.push({
                        icon: '⚠️',
                        severity: 'warning',
                        message: `0 उठाओ की मात्रा वाले परिवहनकर्ताओं के नाम: ${zeroLifting.join(', ')}`
                    });
                }
            }
        }

        // Build flat allTransporters list SECTOR-WISE for ALL reports (used by Messenger/District Intelligence)
        // Shows separate entry per sector (e.g. "श्री पीयूष आर्य (बैतूल सेक्टर क्र 2)", "श्री पीयूष आर्य (भीमपुर सेक्टर क्र 11)")
        let allTransportersFlatList = [];
        if (processedResult && processedResult.sectors) {
            const sectorMap = new Map();

            // 1. Seed all 22 sectors from config so 0-dispatch sectors appear
            sectorsConfig.forEach(cfg => {
                const key = cfg.sectorName;
                if (!key) return;
                sectorMap.set(key, {
                    sectorName: cfg.sectorName,
                    transporter: cfg.transporter || 'N/A',
                    mobileNumber: cfg.mobile || '',
                    name: `${cfg.transporter || 'N/A'} (${cfg.sectorName})`,
                    dispatchSum: 0,
                    allottedSum: 0,
                    posReceiptSum: 0
                });
            });

            // 2. Populate from actual processed sector data
            processedResult.sectors.forEach(s => {
                const sName = s.sectorName || s.name;
                const key = sName;
                const existing = sectorMap.get(key) || {
                    sectorName: sName,
                    transporter: s.transporter || 'N/A',
                    mobileNumber: s.mobileNumber || '',
                    name: `${s.transporter || 'N/A'} (${sName})`,
                    dispatchSum: 0,
                    allottedSum: 0,
                    posReceiptSum: 0
                };

                existing.dispatchSum += parseFloat(s.dispatch || 0);
                existing.posReceiptSum += parseFloat(s.posReceipt || 0);
                if (s.allocation !== undefined) {
                    existing.allottedSum = parseFloat(s.allocation || 0);
                } else if (existing.allottedSum === 0) {
                    existing.allottedSum = parseFloat(s.dispatch || 0);
                }

                if (s.transporter) existing.transporter = s.transporter;
                if (s.mobileNumber) existing.mobileNumber = s.mobileNumber;
                sectorMap.set(key, existing);
            });

            allTransportersFlatList = Array.from(sectorMap.values()).map(t => {
                const avgDispatch = t.allottedSum > 0 ? parseFloat(((t.dispatchSum / t.allottedSum) * 100).toFixed(2)) : 0;
                const posReceiptPct = t.allottedSum > 0 ? parseFloat(((t.posReceiptSum / t.allottedSum) * 100).toFixed(2)) : 0;
                const diffPct = parseFloat((avgDispatch - posReceiptPct).toFixed(2));
                const bal = parseFloat((t.allottedSum - t.dispatchSum).toFixed(2));
                return {
                    name: t.name,
                    transporter: t.transporter,
                    sectorName: t.sectorName,
                    mobileNumber: t.mobileNumber || '',
                    avgDispatch,
                    dispatchPct: avgDispatch,
                    posReceiptPct,
                    diffPct,
                    sectorCount: 1,
                    balance: bal < 0 ? 0 : bal
                };
            });
        }

        return {
            metrics,
            needsAttention,
            allSectors,
            topTransporters,
            bottomTransporters,
            allTransporters: allTransportersFlatList,
            insights
        };
    }
}

module.exports = AnalyticsService;
