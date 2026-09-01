# unknown-aggregation-type

**Severity:** warning · **Needs mapping:** no · **Fixable:** no

## What

Flags an aggregation node that contains no recognized aggregation type key
(ignoring the structural keys `aggs`, `aggregations`, `meta`).

## Why

The usual cause is a typo — `term` instead of `terms`, `date_histogtram`,
`cardnality` — which the cluster rejects with `Unknown aggregation type [...]`.
Catching it before the request goes out saves a round trip.

## Bad

```json
{ "aggs": { "by_status": { "term": { "field": "status" } } } }
```

## Good

```json
{ "aggs": { "by_status": { "terms": { "field": "status" } } } }
```

## Notes

The check is a denylist: it knows the core + common OpenSearch / X-Pack
aggregations (`METRIC_AGG_TYPES`, `BUCKET_AGG_TYPES`, `PIPELINE_AGG_TYPES`,
exported from the package). An aggregation from an unusual plugin may be
flagged even though it's valid — set the rule to `off`, or downgrade it, if
that's your situation.
