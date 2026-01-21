/**
 * SMM Price Fetcher using Puppeteer
 * 
 * Scrapes real-time data from metal.com using a headless browser.
 * Targeting specific "VAT included" (USD) and "Original" (CNY) prices.
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`📡 Navigating to ${SMM_URL}...`);
        await page.goto(SMM_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Extract Data
        const data = await page.evaluate(() => {
            const result = {
                carbonate: { price: null, changeUSD: null, changePercent: null, priceCNY: null, changeCNY: null },
                spodumene: { price: null, changeUSD: null, changePercent: null },
                futures: []
            };

            const debug = [];

            // Helper to parse numbers like "22,703.83" or "+859.45"
            const parseNum = (str) => {
                if (!str) return null;
                const clean = str.replace(/[^\d.-]/g, '');
                return parseFloat(clean);
            };

            // 1. Find Price Cards (VAT included / Original)
            // We look for elements containing specific label text
            const allElements = Array.from(document.querySelectorAll('div, span, p, h3, h4, h5, h6'));

            allElements.forEach(el => {
                const text = el.innerText ? el.innerText.trim() : '';

                // Carbonate Detection
                // We assume Carbonate cards are near a "Lithium Carbonate" header, but identifying that relation across DOM is hard without structure
                // However, "Original 158,500" is very unique to Carbonate. "VAT included" might appear for Spodumene too.
                // To distinguish, we need to check if we are in the "Lithium Carbonate" section or "Spodumene" section.
                // Heuristic: check if any parent or nearby element mentions the product name.

                // A safer, more generic approach: Look for row/card structure
                // Let's iterate over parents that have text content

                // CARBONATE LOGIC (Targeting specific text)
                if (text === 'VAT included') {
                    const container = el.parentElement;
                    if (container) {
                        const fullText = container.innerText; // "VAT included 22,703.83 USD/mt +859.45(+3.93%)"

                        // Check if this card belongs to Carbonate or Spodumene
                        // We treat Carbonate as the primary one found first usually, or we check price range
                        const priceMatch = fullText.match(/([\d,]+\.?\d*)\s*USD\/mt/);

                        if (priceMatch && priceMatch[1]) {
                            const val = parseNum(priceMatch[1]);
                            // Carbonate ~10000-50000, Spodumene ~500-4000
                            if (val > 10000) {
                                // Carbonate
                                result.carbonate.price = val;
                                const changeMatch = fullText.match(/([+-][\d,]+\.?\d*)\(/);
                                const percentMatch = fullText.match(/\(([+-]?[\d,]+\.?\d*)%\)/);
                                if (changeMatch) result.carbonate.changeUSD = parseNum(changeMatch[1]);
                                if (percentMatch) result.carbonate.changePercent = parseNum(percentMatch[1]);
                            } else if (val < 5000) {
                                // Spodumene
                                result.spodumene.price = val;
                                const changeMatch = fullText.match(/([+-][\d,]+\.?\d*)\(/);
                                const percentMatch = fullText.match(/\(([+-]?[\d,]+\.?\d*)%\)/);
                                if (changeMatch) result.spodumene.changeUSD = parseNum(changeMatch[1]);
                                if (percentMatch) result.spodumene.changePercent = parseNum(percentMatch[1]);
                            }
                        }
                    }
                }

                // CARBONATE CNY (Original)
                if (text === 'Original') {
                    const container = el.parentElement;
                    if (container) {
                        const fullText = container.innerText; // "Original 158,500 CNY/mt +6,000(+3.93%)"

                        const priceMatch = fullText.match(/([\d,]+\.?\d*)\s*CNY\/mt/);
                        if (priceMatch && priceMatch[1]) {
                            const val = parseNum(priceMatch[1]);
                            if (val > 100000) {
                                result.carbonate.priceCNY = val;
                                const changeMatch = fullText.match(/([+-][\d,]+\.?\d*)\(/);
                                if (changeMatch) result.carbonate.changeCNY = parseNum(changeMatch[1]);
                            }
                        }
                    }
                }
            });

            // 2. Fallback: Table Scanning
            if (!result.carbonate.price || !result.spodumene.price) {
                const rows = Array.from(document.querySelectorAll('tr'));
                rows.forEach(row => {
                    const rowText = row.innerText.toLowerCase();
                    if (rowText.includes('lithium carbonate') && rowText.includes('99.5')) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        cells.forEach(cell => {
                            const val = parseNum(cell.innerText);
                            if (val > 100000) result.carbonate.priceCNY = val;
                            else if (val > 10000 && val < 50000) result.carbonate.price = val;
                        });
                    }
                    if (rowText.includes('spodumene') && rowText.includes('6')) {
                        const cells = Array.from(row.querySelectorAll('td'));
                        cells.forEach(cell => {
                            const val = parseNum(cell.innerText);
                            if (val > 500 && val < 5000) result.spodumene.price = val;
                        });
                    }
                });
            }

            // 3. Futures (LC Contracts)
            const rows = Array.from(document.querySelectorAll('tr'));
            rows.forEach(row => {
                const rowText = row.innerText.toLowerCase();
                if (rowText.match(/lc2\d{3}/)) {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const contract = cells[0]?.innerText.trim();
                    const price = parseNum(cells[1]?.innerText || '');
                    if (contract && !isNaN(price)) {
                        result.futures.push({ contract, priceCNY: price });
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

    // Helper to replace values
    const replaceValue = (key, value) => {
        const regex = new RegExp(`${key}:\\s*-?[\\d,]+(\\.\\d+)?`);
        if (regex.test(content) && value !== null && value !== undefined && !isNaN(value)) {
            content = content.replace(regex, `${key}: ${value}`);
            updated = true;
        }
    };

    // Carbonate
    if (data.carbonate.priceCNY) replaceValue('priceCNY', data.carbonate.priceCNY);
    if (data.carbonate.price) replaceValue('price', data.carbonate.price);
    if (data.carbonate.changeCNY !== null) replaceValue('changeCNY', data.carbonate.changeCNY);
    if (data.carbonate.changeUSD !== null) replaceValue('changeUSD', data.carbonate.changeUSD);
    if (data.carbonate.changePercent !== null) replaceValue('changePercent', data.carbonate.changePercent);

    // Spodumene (We need to ensure these keys exist in the file first to be replaceable)
    // We'll trust the current file structure has these keys roughly in place
    // But wait, Spodumene block might have duplicate keys like 'price', 'changeUSD', etc.
    // The regex above matches GLOBAL first occurence or specific context?
    // It matches the first one found! This is bad if keys are duplicated.
    // We need context-aware replacement.

    // Better replacement strategy:
    const replaceInBlock = (blockName, key, value) => {
        // Find the block:  blockName: { ... }
        const blockRegex = new RegExp(`(${blockName}:\\s*\\{[^}]*?)(${key}:\\s*)([\\d,.-]+)`, 's');
        if (blockRegex.test(content) && value !== null && value !== undefined) {
            // content = content.replace(blockRegex, `$1${key}: ${value}`);
            // The above is tricky with groups. Let's use a function replacer or simpler split
            // Actually, let's just use exact match with enough context
            // e.g. "spodumene: { ... price: 2035"

            // Using a function to only replace inside the specific match
            content = content.replace(blockRegex, (match, prefix, label, oldVal) => {
                return `${prefix}${label}${value}`;
            });
            updated = true;
        }
    };

    // Carbonate
    replaceInBlock('carbonate', 'priceCNY', data.carbonate.priceCNY);
    replaceInBlock('carbonate', 'price', data.carbonate.price);
    replaceInBlock('carbonate', 'changeCNY', data.carbonate.changeCNY);
    replaceInBlock('carbonate', 'changeUSD', data.carbonate.changeUSD);
    replaceInBlock('carbonate', 'changePercent', data.carbonate.changePercent);

    // Spodumene
    replaceInBlock('spodumene', 'price', data.spodumene.price);
    replaceInBlock('spodumene', 'changeUSD', data.spodumene.changeUSD);
    replaceInBlock('spodumene', 'changePercent', data.spodumene.changePercent);

    // Futures
    if (data.futures && data.futures.length > 0) {
        data.futures.forEach(f => {
            const updateRegex = new RegExp(`(contract:\\s*'${f.contract}'.*?priceCNY:\\s*)(\\d+)`, 's');
            if (updateRegex.test(content)) {
                content = content.replace(updateRegex, `$1${f.priceCNY}`);
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
