#!/usr/bin/env zx

import fs from 'fs/promises';
import path from 'path';
import { $ } from 'zx';
import csvWriter from 'csv-writer';

const baseDir = 'src/Data';
const outputFile = 'src/output.csv';

const getCategories = () => {
    return 'Professional Services';
};

const processFile = async (filePath) => {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const company = data[0].company;

    const addressParts = company.address.split(',').map(part => part.trim());

    return {
        name: company.name,
        description: data[0].description,
        categories: getCategories(),
        country_code: 'NG',
        state: addressParts.length >= 6 ? addressParts[5] : '',
        address: company.address,
        postal_code: '',
        city: addressParts.length >= 5 ? addressParts[4] : '',
        street: addressParts.length >= 1 ? addressParts[0] : '',
        latitude: '',
        longitude: '',
        phone: '',
        email: '',
        'links.0.label': '',
        'links.0.url': ''
    };
};

const processFolder = async (folderPath) => {
    const files = await fs.readdir(folderPath);
    const records = [];

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const record = await processFile(filePath);
        records.push(record);
    }

    return records;
};

const writeCsv = async (records, outputFile) => {
    const createCsvWriter = csvWriter.createObjectCsvWriter;
    const csvWriterInstance = createCsvWriter({
        path: outputFile,
        header: [
            { id: 'name', title: 'name' },
            { id: 'description', title: 'description' },
            { id: 'categories', title: 'categories' },
            { id: 'country_code', title: 'country_code' },
            { id: 'state', title: 'state' },
            { id: 'address', title: 'address' },
            { id: 'postal_code', title: 'postal_code' },
            { id: 'city', title: 'city' },
            { id: 'street', title: 'street' },
            { id: 'latitude', title: 'latitude' },
            { id: 'longitude', title: 'longitude' },
            { id: 'phone', title: 'phone' },
            { id: 'email', title: 'email' },
            { id: 'links.0.label', title: 'links.0.label' },
            { id: 'links.0.url', title: 'links.0.url' }
        ]
    });

    await csvWriterInstance.writeRecords(records);
};

const main = async () => {
    const years = (await fs.readdir(baseDir)).filter(async (name) => {
        const dirPath = path.join(baseDir, name);
        const stats = await fs.lstat(dirPath);
        return stats.isDirectory();
    });

    const allRecords = [];
    for (const year of years) {
        const yearFolderPath = path.join(baseDir, year);
        const records = await processFolder(yearFolderPath);
        allRecords.push(...records);
    }

    await writeCsv(allRecords, outputFile);
};

await main();
