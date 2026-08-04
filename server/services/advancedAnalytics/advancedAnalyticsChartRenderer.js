const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class AdvancedAnalyticsChartRenderer {
    constructor() {
        this.vendorChartPath = path.join(__dirname, '../../../public/vendor/chart.umd.js');
    }

    /**
     * Renders 4 chart image buffers using Puppeteer and Chart.js
     * 
     * @param {Object} computed Data computed from AdvancedAnalyticsCompute
     * @returns {Promise<Object>} Object containing PNG buffers: { blockBar, tierDonut, sectorGroupedBar, posGapBar }
     */
    async renderCharts(computed) {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });

            const blockLabels = computed.blocks.map(b => b.block);
            const blockValues = computed.blocks.map(b => Number((b.liftPct * 100).toFixed(2)));

            const tierCounts = [
                computed.kpis.criticalSectorsCount,
                computed.kpis.watchSectorsCount,
                computed.kpis.goodSectorsCount,
                computed.kpis.excellentSectorsCount
            ];

            const sectorLabels = computed.sectors.slice(0, 12).map(s => s.sectorName.replace(' बैतूल', '').replace(' क्र ', ' #'));
            const sectorDispatchPct = computed.sectors.slice(0, 12).map(s => Number((s.liftPct * 100).toFixed(2)));
            const sectorPosPct = computed.sectors.slice(0, 12).map(s => Number((s.posReceiptPct * 100).toFixed(2)));

            // Top-8 POS gaps (largest absolute gap)
            const topGaps = [...computed.sectors]
                .filter(s => Math.abs(s.posGapPP) > 5)
                .sort((a, b) => Math.abs(b.posGapPP) - Math.abs(a.posGapPP))
                .slice(0, 8);

            const gapLabels = topGaps.map(s => s.sectorName.replace(' बैतूल', '').replace(' क्र ', ' #'));
            const gapValues = topGaps.map(s => s.posGapPP);
            const gapColors = topGaps.map(s => s.posGapPP > 0 ? '#D98E04' : '#6B4C93'); // Amber for lag, Purple for anomaly

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
                    body {
                        font-family: 'Noto Sans Devanagari', Arial, sans-serif;
                        background: #ffffff;
                        margin: 0;
                        padding: 20px;
                    }
                    .chart-container {
                        width: 700px;
                        height: 400px;
                        margin-bottom: 30px;
                        background: #ffffff;
                    }
                    .donut-container {
                        width: 450px;
                        height: 450px;
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            </head>
            <body>
                <div class="chart-container"><canvas id="blockBarCanvas"></canvas></div>
                <div class="chart-container donut-container"><canvas id="tierDonutCanvas"></canvas></div>
                <div class="chart-container"><canvas id="sectorGroupedBarCanvas"></canvas></div>
                <div class="chart-container"><canvas id="posGapBarCanvas"></canvas></div>

                <script>
                    window.renderComplete = false;

                    function initCharts() {
                        try {
                            // 1. Block-wise Lift % Bar Chart
                            new Chart(document.getElementById('blockBarCanvas').getContext('2d'), {
                                type: 'bar',
                                data: {
                                    labels: ${JSON.stringify(blockLabels)},
                                    datasets: [{
                                        label: 'उठाव % (Lift %)',
                                        data: ${JSON.stringify(blockValues)},
                                        backgroundColor: '#0B2545',
                                        borderRadius: 6
                                    }]
                                },
                                options: {
                                    indexAxis: 'y',
                                    responsive: false,
                                    plugins: {
                                        title: { display: true, text: 'ब्लॉक-वार उठाव प्रतिशत / Block-wise Lift %', font: { size: 16, weight: 'bold' } },
                                        legend: { display: false }
                                    },
                                    scales: {
                                        x: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
                                    }
                                }
                            });

                            // 2. Risk Tier Donut Chart
                            new Chart(document.getElementById('tierDonutCanvas').getContext('2d'), {
                                type: 'doughnut',
                                data: {
                                    labels: ['Critical (<70%)', 'Watch (70-85%)', 'Good (85-95%)', 'Excellent (>=95%)'],
                                    datasets: [{
                                        data: ${JSON.stringify(tierCounts)},
                                        backgroundColor: ['#B23A2E', '#D98E04', '#2E6F95', '#1E7B4D']
                                    }]
                                },
                                options: {
                                    responsive: false,
                                    plugins: {
                                        title: { display: true, text: 'जोखिम श्रेणी विभाजन / Risk Tier Distribution', font: { size: 16, weight: 'bold' } },
                                        legend: { position: 'bottom' }
                                    }
                                }
                            });

                            // 3. Sector Grouped Bar Chart
                            new Chart(document.getElementById('sectorGroupedBarCanvas').getContext('2d'), {
                                type: 'bar',
                                data: {
                                    labels: ${JSON.stringify(sectorLabels)},
                                    datasets: [
                                        { label: 'डिस्पैच % (Lift %)', data: ${JSON.stringify(sectorDispatchPct)}, backgroundColor: '#0B2545', borderRadius: 4 },
                                        { label: 'POS प्राप्ति % (POS %)', data: ${JSON.stringify(sectorPosPct)}, backgroundColor: '#2E6F95', borderRadius: 4 }
                                    ]
                                },
                                options: {
                                    responsive: false,
                                    plugins: {
                                        title: { display: true, text: 'सेक्टर-वार डिस्पैच बनाम POS प्राप्ति % / Dispatch vs POS Receipt %', font: { size: 16, weight: 'bold' } }
                                    },
                                    scales: {
                                        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
                                    }
                                }
                            });

                            // 4. POS Gap Bar Chart
                            new Chart(document.getElementById('posGapBarCanvas').getContext('2d'), {
                                type: 'bar',
                                data: {
                                    labels: ${JSON.stringify(gapLabels)},
                                    datasets: [{
                                        label: 'POS अंतर pp (POS Gap pp)',
                                        data: ${JSON.stringify(gapValues)},
                                        backgroundColor: ${JSON.stringify(gapColors)},
                                        borderRadius: 4
                                    }]
                                },
                                options: {
                                    responsive: false,
                                    plugins: {
                                        title: { display: true, text: 'शीर्ष POS अंतर विसंगतियां / Top POS Gap Anomalies (pp)', font: { size: 16, weight: 'bold' } },
                                        legend: { display: false }
                                    },
                                    scales: {
                                        y: { title: { display: true, text: 'प्रतिशत अंक अंतर (pp)' } }
                                    }
                                }
                            });

                            setTimeout(() => { window.renderComplete = true; }, 400);
                        } catch (err) {
                            console.error('Chart init error:', err);
                            window.renderComplete = true;
                        }
                    }

                    if (typeof Chart !== 'undefined') {
                        initCharts();
                    } else {
                        window.onload = initCharts;
                    }
                </script>
            </body>
            </html>
            `;

            await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction('window.renderComplete === true', { timeout: 10000 }).catch(() => {});

            // Capture base64 data URLs for all 4 canvases
            const images = await page.evaluate(() => {
                const getBuffer = (id) => {
                    const canvas = document.getElementById(id);
                    return canvas ? canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '') : null;
                };
                return {
                    blockBar: getBuffer('blockBarCanvas'),
                    tierDonut: getBuffer('tierDonutCanvas'),
                    sectorGroupedBar: getBuffer('sectorGroupedBarCanvas'),
                    posGapBar: getBuffer('posGapBarCanvas')
                };
            });

            return {
                blockBar: images.blockBar ? Buffer.from(images.blockBar, 'base64') : null,
                tierDonut: images.tierDonut ? Buffer.from(images.tierDonut, 'base64') : null,
                sectorGroupedBar: images.sectorGroupedBar ? Buffer.from(images.sectorGroupedBar, 'base64') : null,
                posGapBar: images.posGapBar ? Buffer.from(images.posGapBar, 'base64') : null
            };
        } catch (error) {
            console.error('Failed to render advanced analytics charts:', error);
            return { blockBar: null, tierDonut: null, sectorGroupedBar: null, posGapBar: null };
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }
}

module.exports = AdvancedAnalyticsChartRenderer;
