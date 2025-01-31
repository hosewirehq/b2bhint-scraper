const readline = require("readline");

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Create a readline interface to get user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to get user input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Function to generate URLs for each day of the year
function generateIndexUrls(year) {
  const urls = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() + 1 === month) { // Ensure valid dates (e.g., no Feb 30)
        urls.push(`https://b2bhint.com/en/archive/ng/${year}/${month}/${day}?page=1`);
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
        return [...document.querySelectorAll("a.company-link-selector")].map(el => el.href);
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
      
      if (!nextPageExists) break;

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

    // Modify this part to match the actual data structure on the page
    const companyData = await page.evaluate(() => {
        // Select the block containing the required data
        const summaryBlock = document.querySelector('.Block_blok__tzptC');
        
        if (!summaryBlock) return null;

        // Extract the Name
        const name = summaryBlock.querySelector('dl > div > dt:contains("Name") + dd')?.innerText.trim();

        // Extract Jurisdiction (and Flag Image)
        const jurisdiction = summaryBlock.querySelector('dl > div > dt:contains("Jurisdiction") + dd')?.innerText.trim();

        // Extract Registration number
        const registrationNumber = summaryBlock.querySelector('dl > div > dt:contains("Registration number (RC)") + dd')?.innerText.trim();

        // Extract Incorporation Date
        const incorporationDate = summaryBlock.querySelector('dl > div > dt:contains("Incorporation Date") + dd')?.innerText.trim();

        return {
        name,
        jurisdiction,
        registrationNumber,
        incorporationDate
        };
    });

    return companyData;
  } catch (error) {
    console.error(`Error scraping ${companyUrl}:`, error.message);
    return null;
  }
}

// Main function
(async () => {
  const year = await askQuestion("Enter the year: ");
  rl.close();

  const indexUrls = generateIndexUrls(year);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  let allCompanyData = [];

  for (const indexUrl of indexUrls) {
    try {
      const companyLinks = await extractCompanyLinks(page, indexUrl);
      for (const companyUrl of companyLinks) {
        const companyData = await scrapeCompanyData(page, companyUrl);
        if (companyData) allCompanyData.push(companyData);
      }
    } catch (error) {
      console.error(`Error processing ${indexUrl}:`, error.message);
    }
  }

  await browser.close();
  console.log("Scraping completed. Total companies scraped:", allCompanyData.length);
})();
