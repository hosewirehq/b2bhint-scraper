<?php

namespace App\Processors;

use RoachPHP\ItemPipeline\ItemInterface;
use RoachPHP\ItemPipeline\Processors\ItemProcessorInterface;
use RoachPHP\Support\Configurable;

class CompanyItemProcessor implements ItemProcessorInterface
{
    use Configurable;

    public function processItem(ItemInterface $item): ItemInterface
    {
        $year = $item->get('year');

        $path = $this->getFilePath($year);

        $fileContentsAsArray = $this->getFileContentsAsArray($path);

        $fileContentsAsArray[] = $item->all();

        $this->saveFileContentsAsArray($path, $fileContentsAsArray);

        return $item;
    }
  
    private function defaultOptions(): array
    {
        return [];
    }

    protected function getFilePath(string $year): string
    {
        return "./src/Data/{$year}.json";
    }

    protected function getFileContents(string $filePath): string
    {
        if (! file_exists($filePath)) {
            file_put_contents($filePath, json_encode([]));
        }

        return file_get_contents($filePath);
    }

    protected function getFileContentsAsArray(string $filePath): array
    {
        return json_decode($this->getFileContents($filePath), true);
    }

    protected function saveFileContents(string $filePath, string $contents): void
    {
        file_put_contents($filePath, $contents);
    }

    protected function saveFileContentsAsArray(string $filePath, array $contents): void
    {
        $this->saveFileContents($filePath, json_encode($contents, JSON_PRETTY_PRINT));
    }
}