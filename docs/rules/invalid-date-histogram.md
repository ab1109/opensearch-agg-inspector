# invalid-date-histogram

**Severity:** error (missing interval) / warning (legacy `interval`) · **Needs mapping:** no

## What

Flags `date_histogram` aggregations that don't specify a modern interval:

- **error** — neither `calendar_interval` nor `fixed_interval` is present.
- **warning** — the deprecated `interval` field is used.

## Why

OpenSearch 1.x+ and Elasticsearch 7.x+ split the old `interval` parameter into
`calendar_interval` (calendar-aware units: `1d`, `1M`, `1y`) and
`fixed_interval` (exact multiples: `1h`, `30m`, `90s`). A `date_histogram` with
no interval is a hard runtime error; `interval` still works but is deprecated
and slated for removal.

## Bad

```json
{ "aggs": { "over_time": { "date_histogram": { "field": "created_at" } } } }
```

```json
{
  "aggs": {
    "over_time": { "date_histogram": { "field": "created_at", "interval": "day" } }
  }
}
```

## Good

```json
{
  "aggs": {
    "over_time": {
      "date_histogram": { "field": "created_at", "calendar_interval": "1d" }
    }
  }
}
```

Use `calendar_interval` for `minute`, `hour`, `day`, `week`, `month`,
`quarter`, `year`; `fixed_interval` for anything expressed as a fixed multiple
(`12h`, `7d`).
