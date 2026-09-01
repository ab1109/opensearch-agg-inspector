# large-terms-size

**Severity:** warning · **Needs mapping:** no · **Fixable:** no

## What

Flags `terms` aggregations with a `size` above a threshold (default **1000**).

## Why

Each shard has to collect, sort, and return its top `shard_size` terms, and the
coordinating node then merges them all. A large `size` multiplies memory use
and response time across every shard — and the result set is often bigger than
anything a UI or downstream job actually consumes.

## Bad

```json
{ "aggs": { "by_tag": { "terms": { "field": "tag", "size": 5000 } } } }
```

## Good

```json
{ "aggs": { "by_tag": { "terms": { "field": "tag", "size": 100 } } } }
```

If you truly need every value, use a `composite` aggregation with pagination
instead of one huge `terms`.

## Configure the threshold

```ts
import { inspect, defaultRules, createLargeTermsSize } from "opensearch-agg-inspector";

inspect(query, mapping, {
  rules: [
    ...defaultRules.filter((r) => r.id !== "large-terms-size"),
    createLargeTermsSize({ threshold: 500 }),
  ],
});
```
