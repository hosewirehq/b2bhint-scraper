#!/usr/bin/env zx

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";

puppeteer.use(StealthPlugin());

const FAILED_URLS_FILE = "failedUrls.json";

// Load failed URLs from file
function loadFailedUrls() {
  if (fs.existsSync(FAILED_URLS_FILE)) {
    return JSON.parse(fs.readFileSync(FAILED_URLS_FILE, "utf8"));
  }
  return { indexUrls: [], companyUrls: [] };
}

// Save failed URLs to file
function saveFailedUrls(failedUrls) {
  fs.writeFileSync(FAILED_URLS_FILE, JSON.stringify(failedUrls, null, 2), "utf8");
}

// Get user input for the date
async function getDateInput() {
  const args = process.argv.slice(2);
  let dateString = args.find(arg => /^\d{4}-\d{1,2}-\d{1,2}$/.test(arg));

  if (!dateString) {
    dateString = await question("Enter the date (YYYY-M-D or YYYY-MM-DD): ");
  }

  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
    console.error("Invalid date format. Use YYYY-M-D or YYYY-MM-DD (no leading zeros in month/day).");
    process.exit(1);
  }

  const [year, month, day] = dateString.split("-").map(Number);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.error("Invalid date. Please enter a correct month (1-12) and day (1-31).");
    process.exit(1);
  }

  return `${year}-${month}-${day}`; // Ensure leading zeros are removed
}

// Generate index URL for the given date
function generateIndexUrl(dateString) {
  return `https://b2bhint.com/en/archive/ng/${dateString.replace(/-/g, "/")}?page=1`;
}

// Extract company links from an index page
async function extractCompanyLinks(page, indexUrl, failedUrls) {
  let companyLinks = [];

  try {
    await page.goto(indexUrl, { waitUntil: "networkidle2" });
    while (true) {
      console.log(`Extracting company links from: ${indexUrl}`);

      // Modify this selector to match the actual company link elements
      const links = await page.evaluate(() => {
        return [...document.querySelectorAll("table a")].map(link => link.href);
      });

      companyLinks.push(...links);

      // Check for "Next" button
      const nextPageExists = await page.evaluate(() => {
        const nav = document.querySelector(".Page_page__0swp3 nav");
        if (!nav) return false;
        const nextDiv = nav.children[2]; // Third div
        const nextLink = nextDiv.querySelector("a");
        return nextLink ? nextLink.href : false;
      });

      if (!nextPageExists) {
        console.log("No more pages to scrape.");
        break;
      }

      await Promise.all([
        page.click(".Page_page__0swp3 nav div:nth-child(3) a"),
        page.waitForNavigation({ waitUntil: "networkidle2" })
      ]);

      indexUrl = await page.url();
    }
  } catch (error) {
    console.error(`Error extracting links from ${indexUrl}:`, error.message);
    failedUrls.indexUrls.push(indexUrl);
  }

  return companyLinks;
}

async function safeNavigate(page, url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      if (!page.isClosed()) {
        await page.goto(url, { waitUntil: "networkidle2" });
        return;
      }
    } catch (error) {
      console.warn(`Navigation failed. Retrying (${i + 1}/${retries})...`);
      await page.waitForTimeout(3000); // Wait 3 seconds before retry
    }
  }
  throw new Error("Failed to navigate after multiple attempts.");
}

// Scrape data from a company profile page
async function scrapeCompanyData(page, companyUrl, failedUrls) {
  try {
    // await page.goto(companyUrl, { waitUntil: "networkidle2" });
    await safeNavigate(page, companyUrl);
    console.log(`Scraping company data from: ${companyUrl}`);

    const nextDataSelector = await page.locator("#__NEXT_DATA__").waitHandle();
    const nextData = await nextDataSelector?.evaluate(el => el.textContent);
    const companyData = JSON.parse(nextData)?.props?.pageProps?.company;

    return companyData;
  } catch (error) {
    console.error(`Error scraping ${companyUrl}:`, error.message);
    failedUrls.companyUrls.push(companyUrl);
    return null;
  }
}

// Save company data to JSON
function saveCompanyData(companyData, dateString) {
  if (!companyData || !companyData.name) return;

  const sanitizedCompanyName = companyData.name.replace(/[\/:*?"<>|]/g, "").trim();
  const folderPath = path.join("src", "Data", dateString);
  const filePath = path.join(folderPath, `${sanitizedCompanyName}.json`);

  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(companyData, null, 2), "utf8");
  console.log(`Saved: ${filePath}`);
}

// Process all index URLs and extract company links
async function processIndexUrls(page, dateString, failedUrls) {
  const indexUrl = generateIndexUrl(dateString);
  try {
    const companyLinks = await extractCompanyLinks(page, indexUrl, failedUrls);
    console.log(`Found ${companyLinks.length} company links.`);
    return companyLinks;
  } catch (error) {
    console.error(`Error processing index URL: ${indexUrl}`, error.message);
    failedUrls.indexUrls.push(indexUrl);
    return [];
  }
}

// Process all company URLs and scrape data
async function processCompanyUrls(page, companyUrls, dateString, failedUrls) {
  for (const companyUrl of companyUrls) {
    try {
      const companyData = await scrapeCompanyData(page, companyUrl, failedUrls);
      if (companyData) saveCompanyData(companyData, dateString);
    } catch (error) {
      console.error(`Error processing company URL: ${companyUrl}`, error.message);
      failedUrls.companyUrls.push(companyUrl);
    }
  }
}

// Retry failed URLs recursively until none remain
async function retryFailedUrls(browser, dateString) {
  let failedUrls = loadFailedUrls();

  while (failedUrls.indexUrls.length > 0 || failedUrls.companyUrls.length > 0) {
    console.log(`Retrying failed URLs...`);
    saveFailedUrls({ indexUrls: [], companyUrls: [] }); // Clear file before retrying

    const page = await browser.newPage();

    // Retry index URLs
    for (const indexUrl of failedUrls.indexUrls) {
      const companyLinks = await extractCompanyLinks(page, indexUrl, failedUrls);
      await processCompanyUrls(page, companyLinks, dateString, failedUrls);
    }

    // Retry company URLs
    await processCompanyUrls(page, failedUrls.companyUrls, dateString, failedUrls);

    await page.close();

    // Reload failed URLs
    failedUrls = loadFailedUrls();
  }
}

// Main function
(async () => {
  const dateString = await getDateInput();
  console.log(`Scraping data for: ${dateString}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    timeout: 0,
  });

  const page = await browser.newPage();
  let failedUrls = loadFailedUrls();

  if (failedUrls.indexUrls.length === 0 && failedUrls.companyUrls.length === 0) {
    const companyLinks = await processIndexUrls(page, dateString, failedUrls);
    await processCompanyUrls(page, companyLinks, dateString, failedUrls);
  }

  saveFailedUrls(failedUrls);
  await retryFailedUrls(browser, dateString);

  await browser.close();
  console.log("Scraping completed.");
})();