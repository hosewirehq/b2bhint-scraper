#!/usr/bin/env zx

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

// Function to get user input if not provided as an argument
async function getYearInput() {
  const args = process.argv.slice(2);
  let year = args.find(arg => /^\d{4}$/.test(arg));

  if (!year) {
    year = await question("Enter the year: ");
  }

  return year;
}

// Function to generate URLs for each day of the year
function generateIndexUrls(year) {
  const urls = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() + 1 === month) { // Ensure valid dates (e.g., no Feb 30)
        urls.push({ url: `https://b2bhint.com/en/archive/ng/${year}/${month}/${day}?page=1`, date });
      }
    }
  }
  return urls;
}

// Function to extract company profile links from an index page
async function extractCompanyLinks(page, indexUrl) {
  let companyLinks = [];

  try {
    await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
    while (true) {
      console.log(`Extracting company links from: ${indexUrl}`);

      // Modify this selector to match the actual company link elements
      const links = await page.evaluate(() => {
        return [...document.querySelectorAll("table a")].map(link => link.href);
      });

      companyLinks.push(...links);

      // Check for the "Next" button in pagination
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
      };

      await Promise.all([
        page.click(".Page_page__0swp3 nav div:nth-child(3) a"),
        page.waitForNavigation({ waitUntil: "domcontentloaded" })
      ]);

      indexUrl = await page.url();
    }
  } catch (error) {
    console.error(`Error extracting links from ${indexUrl}:`, error.message);
  }

  return companyLinks;
}

// Function to scrape data from a company profile page
async function scrapeCompanyData(page, companyUrl) {
  try {
    await page.goto(companyUrl, { waitUntil: "domcontentloaded" });
    console.log(`Scraping company data from: ${companyUrl}`);

    const nextDataSelector = await page
      .locator('#__NEXT_DATA__')
      .waitHandle()

    const nextData = await nextDataSelector?.evaluate(el => el.textContent);
    console.log(nextData);

    const companyData = JSON.parse(nextData)?.props?.pageProps?.company;

    return companyData;
  } catch (error) {
    console.error(`Error scraping ${companyUrl}:`, error.message);
    return null;
  }
}

// Function to save company data to a JSON file
function saveCompanyData(companyData, year, month, day) {
  if (!companyData || !companyData.name) return;

  const sanitizedCompanyName = companyData.name.replace(/[\/:*?"<>|]/g, "").trim(); // Remove invalid filename characters
  const folderPath = path.join("src", "Data", year, `${month}-${day}`);
  const filePath = path.join(folderPath, `${sanitizedCompanyName}.json`);

  fs.mkdirSync(folderPath, { recursive: true });

  fs.writeFileSync(filePath, JSON.stringify(companyData, null, 2), "utf8");
  console.log(`Saved: ${filePath}`);
}

// Main function
(async () => {
  const year = await getYearInput();

  if (!/^\d{4}$/.test(year)) {
    console.error("Invalid year provided. Please enter a valid four-digit year.");
    process.exit(1);
  }

  console.log(`Scraping data for the year: ${year}`);

  const indexUrls = generateIndexUrls(year);
  const browser = await puppeteer.launch({
    headless: false,
    // executablePath: 'chrome/linux-126.0.6478.126/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    timeout: 0,
  });
  const page = await browser.newPage();

  for (const { url, date } of indexUrls) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    try {
      const companyLinks = await extractCompanyLinks(page, url);
      console.log(`Found ${companyLinks.length} company links.`);
      console.log(companyLinks);
      for (const companyUrl of companyLinks) {
        const companyData = await scrapeCompanyData(page, companyUrl);
        saveCompanyData(companyData, year, month, day);
      }
    } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
    }
  }

  await browser.close();
  console.log("Scraping completed.");
})();
