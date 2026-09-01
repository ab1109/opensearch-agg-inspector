# Rules

| id                                                        | severity     | needs mapping | catches                                            |
| --------------------------------------------------------- | ------------ | :-----------: | -------------------------------------------------- |
| [unknown-aggregation-type](./unknown-aggregation-type.md) | warning      |       –       | typo'd aggregation type (`term` → `terms`)         |
| [prefer-keyword](./prefer-keyword.md)                     | error        |      yes      | `terms` on an analyzed `text` field                |
| [unknown-field](./unknown-field.md)                       | warning      |      yes      | aggregating on a field absent from the mapping     |
| [invalid-date-histogram](./invalid-date-histogram.md)     | error / warn |       –       | `date_histogram` missing a modern interval         |
| [terms-size-zero](./terms-size-zero.md)                   | error        |       –       | `terms` with `size: 0`                             |
| [metric-sub-aggregation](./metric-sub-aggregation.md)     | error        |       –       | sub-aggregations under a metric aggregation        |
| [large-terms-size](./large-terms-size.md)                 | warning      |       –       | `terms` `size` above a threshold (default 1000)    |
| [missing-shard-size](./missing-shard-size.md)             | warning      |       –       | large `terms` `size` with no explicit `shard_size` |

Every rule can be downgraded or silenced:

```ts
inspect(query, mapping, { ruleOverrides: { "rule-id": "warning" | "info" | "off" } });
```

or from the CLI:

```bash
opensearch-agg-inspector query.json -r rule-id=off
```
