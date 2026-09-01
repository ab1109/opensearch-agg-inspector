# metric-sub-aggregation

**Severity:** error · **Needs mapping:** no · **Fixable:** no

## What

Flags a metric aggregation (`avg`, `sum`, `cardinality`, `top_hits`,
`percentiles`, `scripted_metric`, …) that also has an `aggs` / `aggregations`
block.

## Why

Only **bucket** aggregations create buckets for child aggregations to run
against. A metric aggregation produces a single value, so the cluster rejects
children with:

```
Aggregator [avg_price] of type [avg] cannot accept sub-aggregations
```

## Bad

```json
{
  "aggs": {
    "avg_price": {
      "avg": { "field": "price" },
      "aggs": { "by_status": { "terms": { "field": "status" } } }
    }
  }
}
```

## Good

Move the child up a level, or nest both under a bucket aggregation:

```json
{
  "aggs": {
    "by_status": {
      "terms": { "field": "status" },
      "aggs": { "avg_price": { "avg": { "field": "price" } } }
    }
  }
}
```
