<?php

namespace App\Spiders;

use App\Processors\YearPagesCountItemProcessor;
use Generator;
use RoachPHP\Http\Response;
use RoachPHP\Http\Request;
use RoachPHP\Spider\BasicSpider;

class YearPagesCountSpider extends BasicSpider
{
    public array $itemProcessors = [
        YearPagesCountItemProcessor::class,
    ];

    /** @return Request[] */
    protected function initialRequests(): array
    {
        $years = range(1899, 2022);

        $requests = array_map(fn ($year) => new Request(
            'GET',
            "https://b2bhint.com/en/search?country=24&years={$year}",
            [$this, 'parse']
        ), $years);

        return $requests;
    }

    public function parse(Response $response): Generator
    {
        $year = explode("years=", $response->getUri())[1];

        $text = trim(explode("(", $this->getDomText($response, '.Search_data__usMPr h2'))[0]);

        $foundCompanies = (int) filter_var($text, FILTER_SANITIZE_NUMBER_INT);

        $pagesCountByFoundCompanies = ceil($foundCompanies / 20);

        $pages = range(1, $pagesCountByFoundCompanies);

        yield $this->item(compact('year', 'pages'));
    }

    protected function getDomText($response, string $selector): string
    {
        return $response->filter($selector)->count() > 0 ? $response->filter($selector)->text() : '';
    }
}
