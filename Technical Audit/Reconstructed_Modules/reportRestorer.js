const dataProcessor = require('./dataProcessor');
const mdmDataProcessor = require('./mdmDataProcessor');
const icdsDataProcessor = require('./icdsDataProcessor');
const welfareDataProcessor = require('./welfareDataProcessor');
const nfsaDaterangeDataProcessor = require('./nfsaDaterangeDataProcessor');
const analytics = require('./analytics');

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

            if (scheme === 'nfsa_daterange') {
                // nfsa_daterange has a specific signature: (rData, summaryTotals, allotmentMapping)
                // If it's a legacy report, we might not have all these, so we pass nulls and let it handle
                const rData = rawData.rawData || rawData;
                const summaryTotals = rawData.summaryTotals || null;
                const allotmentMap = rawData.allotmentMapping || null;
                processedResult = nfsaDaterangeDataProcessor.processData(rData, summaryTotals, allotmentMap);
                isDateRange = true;
            } else if (scheme === 'mdm') {
                processedResult = mdmDataProcessor.processData(rawData);
            } else if (scheme === 'icds') {
                processedResult = icdsDataProcessor.processData(rawData);
            } else if (scheme === 'welfare') {
                processedResult = welfareDataProcessor.processData(rawData);
            } else {
                processedResult = dataProcessor.processData(rawData);
            }

            const analyticsResult = analytics.analyzeReport(processedResult, null, null);
            
            if (isDateRange) {
                analyticsResult.isDateRange = true;
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

module.exports = ReportRestorer;
