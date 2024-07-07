const fs = require('fs');
const path = require('path');

class CompanyItemProcessor {
    constructor() {
        // Initialization or default options can go here
    }

    async processItem(item) {
        const year = item.year;
        const title = item.title;

        await this.ensureFolderExists(year);

        const filePath = this.getFilePath(year, title);

        let fileContentsAsArray = await this.getFileContentsAsArray(filePath);

        fileContentsAsArray.push(item);

        await this.saveFileContentsAsArray(filePath, fileContentsAsArray);

        return item;
    }

    async ensureFolderExists(year) {
        const folderPath = path.join(__dirname, 'Data', year.toString());

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
    }

    getFilePath(year, title) {
        // Define a pattern that matches all characters that are not allowed in folder names
        const pattern = /[<>:"\/\\|\?\*\x00-\x1F]/g;

        // Replace all invalid characters with an empty string
        const sanitizedFileName = title.replace(pattern, '').replace(/\s+/g, ' ').trim();

        return path.join(__dirname, 'Data', year.toString(), `${sanitizedFileName}.json`);
    }

    async getFileContents(filePath) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([]));
        }

        return fs.readFileSync(filePath, 'utf-8');
    }

    async getFileContentsAsArray(filePath) {
        const fileContents = await this.getFileContents(filePath);
        return JSON.parse(fileContents);
    }

    async saveFileContents(filePath, contents) {
        fs.writeFileSync(filePath, contents);
    }

    async saveFileContentsAsArray(filePath, contents) {
        await this.saveFileContents(filePath, JSON.stringify(contents, null, 2));
    }
}

// Export the class
module.exports = CompanyItemProcessor;
