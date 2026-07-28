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

        // Extract Defaulters
        if (processedResult && processedResult.sectors) {
            processedResult.sectors.forEach(sector => {
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
                                sectorName: sector.sectorName
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

        return {
            metrics,
            needsAttention
        };
    }
}

module.exports = AnalyticsService;
