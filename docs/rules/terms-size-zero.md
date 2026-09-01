# terms-size-zero

**Severity:** error · **Needs mapping:** no · **Fixable:** no

## What

Flags `terms` (and `significant_terms` / `multi_terms`) aggregations with
`size: 0`.

## Why

In Elasticsearch 1.x–5.x, `size: 0` meant "return every bucket". That shortcut
was removed in 6.0 and never existed in OpenSearch. Modern clusters reject the
request with:

```
[size] must be greater than 0. Use [2147483647] as a maximum value ...
```

## Bad

```json
{ "aggs": { "all_tags": { "terms": { "field": "tag", "size": 0 } } } }
```

## Good

```json
{ "aggs": { "top_tags": { "terms": { "field": "tag", "size": 100 } } } }
```

To genuinely enumerate every value, page through a `composite` aggregation:

```json
{
  "aggs": {
    "all_tags": {
      "composite": {
        "size": 1000,
        "sources": [{ "tag": { "terms": { "field": "tag" } } }]
      }
    }
  }
}
```
