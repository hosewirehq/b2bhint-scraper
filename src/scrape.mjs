#!/usr/bin/env zx

const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeSite() {
    const url = "https://b2bhint.com/en"
    const data = await axios.get(url);
    console.log(data.data);
    return;
    const $ = cheerio.load(data.data);
    // get all data inside .quote class
    const results = [];
    $('.quote').each((i, elem) => {
        const text = $(elem).find('.text').text();
        const author = $(elem).find('.author').text();
        const tags = [];
        $(elem).find('.tag').each((i, elem) => {
            tags.push($(elem).text());
        });
        results.push({ text, author, tags });
    });

    return results;
}

scrapeSite().then(result => {
    console.log(result)
}).catch(err => console.log(err));