# missing-shard-size

**Severity:** warning · **Needs mapping:** no · **Fixable:** yes

## What

Flags `terms` aggregations with `size` > 100 that don't set `shard_size`
explicitly.

## Why

`terms` results are approximate on a multi-shard index. Each shard returns its
own top `shard_size` terms; if a term is just outside the cut-off on some
shards, its total count comes back low — or it's missed entirely. OpenSearch
defaults `shard_size` to roughly `size * 1.5 + 10`, which is often too small
for high-cardinality fields spread across many shards.

Setting `shard_size` explicitly (higher than the default) makes the
accuracy/cost trade-off a decision rather than an accident.

## Bad

```json
{ "aggs": { "by_user": { "terms": { "field": "user_id", "size": 500 } } } }
```

## Good

```json
{
  "aggs": {
    "by_user": { "terms": { "field": "user_id", "size": 500, "shard_size": 1000 } }
  }
}
```

Larger `shard_size` improves accuracy at the cost of memory and network on the
coordinating node. If you need exact counts, a `composite` aggregation is
exact by construction.
