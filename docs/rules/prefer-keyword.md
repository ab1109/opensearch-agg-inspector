# prefer-keyword

**Severity:** error · **Needs mapping:** yes · **Fixable:** when a keyword sub-field exists

## What

Flags `terms` aggregations whose `field` resolves to an analyzed `text` field
in the mapping.

## Why

`text` fields are tokenized at index time. Aggregating on one either fails
outright (fielddata is disabled by default) or, with fielddata enabled,
produces a bucket per _token_ rather than per _value_ — and quietly burns heap
doing it. The value you almost always want lives in a `keyword` multi-field.

## Bad

```json
{ "aggs": { "by_country": { "terms": { "field": "country" } } } }
```

with mapping

```json
{ "country": { "type": "text", "fields": { "keyword": { "type": "keyword" } } } }
```

## Good

```json
{ "aggs": { "by_country": { "terms": { "field": "country.keyword" } } } }
```

If the field has no keyword sub-field, add one to the mapping (or use a
`keyword`-typed field).

## Silence it

```ts
inspect(query, mapping, { ruleOverrides: { "prefer-keyword": "off" } });
```
