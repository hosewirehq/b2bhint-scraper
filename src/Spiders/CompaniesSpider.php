<?php

namespace App\Spiders;

use App\Processors\CompanyItemProcessor;
use Generator;
use RoachPHP\Http\Response;
use RoachPHP\Http\Request;
use RoachPHP\Spider\BasicSpider;

class CompaniesSpider extends BasicSpider
{
    public array $itemProcessors = [
        CompanyItemProcessor::class,
    ];

    /** @return Request[] */
    protected function initialRequests(): array
    {
        $requests = [];

        $yearsWithPages = json_decode(file_get_contents('./src/Data/pages-by-year.json'), true);
        
        foreach ($yearsWithPages as $yearWithPages) {
            $pages = $yearWithPages['pages'];
            $year = $yearWithPages['year'];

            $requests = array_merge($requests, array_map(fn ($page) => new Request(
                'GET',
                "https://b2bhint.com/en/search?country=24&years={$year}&type=companies&page={$page}",
                [$this, 'parse']
            ), $pages));
        }

        return $requests;
    }

    public function parse(Response $response): \Generator
    {
        $links = $response->filter('.SearchItem_item__ab1gL a')->links();
        
        foreach ($links as $link) {
            yield $this->request('GET', $link->getUri(), 'parseCompanyPage');
        }
    }

    public function parseCompanyPage(Response $response): Generator
    {
        $data = json_decode($this->getDomText($response, '#__NEXT_DATA__'))
            ->props
            ->pageProps;

        $year = $this->getDomText($response, '.CompanyHeader_breadcrumb__h9kWp > a:nth-child(2)');
        $title = $data->title;
        $description = $data->description;
        $company = $data->company;

        yield $this->item(compact(
            'year',
            'title',
            'description',
            'company',
        ));
    }

    protected function getDomText($response, string $selector): string
    {
        return $response->filter($selector)->count() > 0 ? $response->filter($selector)->text() : '';
    }
}
