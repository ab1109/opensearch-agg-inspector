# unknown-field

**Severity:** warning · **Needs mapping:** yes · **Fixable:** no

## What

Flags an aggregation whose `field` is not present in the supplied mapping.
Checks `terms`, `avg`, `sum`, `min`, `max`, `value_count`, `cardinality`,
`date_histogram`, and `histogram`. Scripted aggregations are ignored.

## Why

A misspelled or non-existent field name never raises a cluster error — the
aggregation just returns an empty result. That's easy to miss until a
dashboard shows nothing.

Field resolution understands both nesting styles:

- `properties` — object / nested sub-fields (`user.name`)
- `fields` — multi-fields (`country.keyword`)

## Bad

```json
{ "aggs": { "by_region": { "terms": { "field": "regionn" } } } }
```

with mapping `{ "region": { "type": "keyword" } }`.

## Good

```json
{ "aggs": { "by_region": { "terms": { "field": "region" } } } }
```

## Notes

Only fields listed in the mapping you pass are "known". If your mapping object
is partial, expect false positives — or set the rule to `off`.
