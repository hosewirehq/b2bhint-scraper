# Introduction

## Javascript Version

Install chrome testing version:

```bash
npm install
npx @puppeteer/browsers install chrome@stable
```

Install zx globally:

```bash
npm install -global zx
```

Run the script

```bash
chmod +x ./src/scrape.mjs
./src/scrape.mjs --year={year} --fromPage={fromPage} --toPage={toPage}
```

## PHP Version

Install packages

```bash
composer install
```

Run script

```bash
composer scrape:companies
```