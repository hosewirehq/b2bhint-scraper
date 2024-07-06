#!/usr/bin/env zx

const argv = minimist(process.argv.slice(2));
const { year, fromPage, toPage } = argv;

// Import the CompanyItemProcessor class
const CompanyItemProcessor = require('./companyProcessor');
const processor = new CompanyItemProcessor();

// const puppeteer = require("puppeteer");
// puppeteer-extra is a drop-in replacement for puppeteer, 
// it augments the installed puppeteer with plugin functionality 
const puppeteer = require('puppeteer-extra');

// add stealth plugin and use defaults (all evasion techniques) 
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function generateUrls() {
    const urls = [];

    for (let i = fromPage; i <= toPage; i++) {
        urls.push(`https://b2bhint.com/en/search?country=24&years=${year}&page=${i}`)
    }

    return urls;
}

async function scrapeCompany(browser, link) {
    const page = await browser.newPage();
    console.info(`scraping: ${link}`)
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(link, { waitUntil: 'load', timeout: 0 });

    // Extract the content of the element with the ID #__NEXT_DATA__
    const nextData = await page.evaluate(() => {
        const element = document.querySelector('#__NEXT_DATA__');
        return element ? element.innerText : null;
    });

    const year = await page.evaluate(() => {
        const element = document.querySelector('.CompanyHeader_breadcrumb__h9kWp > a:nth-child(2)');
        return element ? element.innerText : null;
    });
    const { title, description, company } = JSON.parse(nextData).props.pageProps;

    console.info(`processing: ${title}`)
    await processor.processItem({year, title, description, company });
    
    await page.close();
}

async function crawlURL(browser, url) {
    const page = await browser.newPage();
    console.info(`crawling: ${url}`)
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(url, { waitUntil: 'load', timeout: 0 });

    // Extract all links
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.SearchItem_item__ab1gL a')).map(anchor => anchor.href);
    });

    // Use Promise.all to wait for all scrapeCompany operations to complete
    await Promise.all(links.map(link => scrapeCompany(browser, link)));

    await page.close();
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'chrome/linux-126.0.6478.126/chrome-linux64/chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 0,
    });
    const urls = await generateUrls();

    // Use Promise.all to wait for all crawlURL operations to complete
    // await Promise.all(urls.map(url => crawlURL(browser, url)));

    // Define batch size
    const batchSize = 1;

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += batchSize) {
        const batchUrls = urls.slice(i, i + batchSize);
        await Promise.all(batchUrls.map(url => crawlURL(browser, url)));
    }

    await browser.close();
})();
