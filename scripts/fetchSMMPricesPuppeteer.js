/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * Robustly extracts BOTH USD and CNY prices to calculate implied rate.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const API_FILE = path.join(__dirname, '..', 'api', 'prices.js');
const SMM_URL = 'https://www.metal.com/Lithium';

async function fetchPrices() {
    console.log('🚀 Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set a real user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`📡 Navigating to ${SMM_URL}...`);
        await page.goto(SMM_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Waiting for price tables...');
        await page.waitForSelector('table', { timeout: 10000 }).catch(() => console.log('Timeout waiting for table'));

        // Extract Data
        const data = await page.evaluate(() => {
            const result = {
                carbonatePrice: null,    // USD
                carbonatePriceCNY: null, // CNY
                futures: []
            };

            const rows = Array.from(document.querySelectorAll('tr'));

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();

                // 1. Spot Lithium Carbonate
                // The table typically has multiple columns like [Name, Price, Change, High, Low, Average, etc.]
                // We need to be smart about extracting both currencies if they appear, or deducing based on magnitude
                if (text.includes('lithium carbonate') && text.includes('99.5')) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const values = cells.map(c => parseFloat(c.innerText.replace(/,/g, ''))).filter(v => !isNaN(v) && v > 1000);

                    values.forEach(v => {
                        // CNY values are usually > 100,000
                        if (v > 100000) result.carbonatePriceCNY = v;
                        // USD values are usually between 10,000 and 50,000
                        else if (v > 10000 && v < 50000) result.carbonatePrice = v;
                    });
                }

                // 2. GFEX Futures (LC contracts)
                if (text.match(/lc2\d{3}/)) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const contractCode = cells[0]?.innerText.trim();
                    const price = parseFloat(cells[1]?.innerText.replace(/,/g, ''));

                    if (contractCode && !isNaN(price)) {
                        result.futures.push({
                            contract: contractCode,
                            priceCNY: price
                        });
                    }
                }
            });

            return result;
        });

        console.log('📊 Extracted Data:', JSON.stringify(data, null, 2));
        return data;

    } catch (error) {
        console.error('❌ Error scraping:', error);
        return null;
    } finally {
        await browser.close();
    }
}

function updateFile(data) {
    if (!data) return;

    let content = fs.readFileSync(API_FILE, 'utf8');
    let updated = false;

    // Update CNY Price
    if (data.carbonatePriceCNY) {
        console.log(`Updating Carbonate CNY: ${data.carbonatePriceCNY}`);
        content = content.replace(/priceCNY:\s*\d+/, `priceCNY: ${data.carbonatePriceCNY}`);
        updated = true;
    }

    // Update USD Price
    // IMPORTANT: This allows us to maintain the dynamic conversion rate based on the page's values
    if (data.carbonatePrice) {
        console.log(`Updating Carbonate USD: ${data.carbonatePrice}`);
        content = content.replace(/price:\s*\d+/, `price: ${data.carbonatePrice}`);
        updated = true;
    }

    // Update Futures
    if (data.futures && data.futures.length > 0) {
        data.futures.forEach(f => {
            const updateRegex = new RegExp(`(contract:\\s*'${f.contract}'.*?priceCNY:\\s*)(\\d+)`, 's');
            if (updateRegex.test(content)) {
                content = content.replace(updateRegex, `$1${f.priceCNY}`);
                // console.log(`Updated ${f.contract} to ${f.priceCNY}`); 
                updated = true;
            }
        });
    }

    if (updated) {
        fs.writeFileSync(API_FILE, content);
        console.log('✅ File updated successfully');
    } else {
        console.log('⚠️ No changes applied to file');
    }
}

fetchPrices().then(data => updateFile(data));
