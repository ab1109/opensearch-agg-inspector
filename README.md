# opensearch-agg-inspector

Static analysis / linter for **OpenSearch** and **Elasticsearch** aggregation DSL.

Give it an `aggs` block (and, optionally, your index mapping) and it reports
correctness, performance, and best-practice issues — **without ever running the
query against a cluster.**

```
npm install --save-dev opensearch-agg-inspector
```

- Zero runtime dependencies.
- Ships ESM + CommonJS + TypeScript types.
- Library API **and** a CLI (`opensearch-agg-inspector` / `osaggs`).

---

## Library usage

```ts
import { inspect } from "opensearch-agg-inspector";

const mapping = {
  country: { type: "text", fields: { keyword: { type: "keyword" } } },
};

const query = {
  aggs: {
    by_country: { terms: { field: "country" } },
  },
};

const report = inspect(query, mapping);

report.errorCount; // 1
report.summary; // "1 error across 1 aggregation"
report.issues[0];
// {
//   rule: "prefer-keyword",
//   severity: "error",
//   message: 'Field "country" is a text field ... Use "country.keyword" instead.',
//   path: "aggs.by_country",
//   suggestion: 'Change field to "country.keyword"',
//   fixable: true,
//   docsUrl: "https://github.com/ab1109/opensearch-agg-inspector/blob/main/docs/rules/prefer-keyword.md"
// }
```

`mapping` is optional. Without it, the field-aware rules (`prefer-keyword`,
`unknown-field`) simply don't run — everything else still does.

### Source locations

Pass the **raw JSON string** instead of a parsed object and every issue also
carries a `loc` (`{ line, column, offset }`, 1-based line/column) pointing at
the offending aggregation:

```ts
import { readFileSync } from "node:fs";

const report = inspect(readFileSync("query.json", "utf8"), mapping);
report.issues[0].loc; // { line: 4, column: 5, offset: 31 }
```

### `inspect(query, mapping?, options?)`

| argument  | type                                                               | notes                                                                              |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `query`   | `{ aggs }` / `{ aggregations }` object, **or** the raw JSON string | an object you'd send in a `_search` body; a string additionally yields `issue.loc` |
| `mapping` | `Record<string, MappingField>`                                     | flat map of field name → mapping definition                                        |
| `options` | `InspectOptions`                                                   | `rules` (custom rule set), `ruleOverrides`                                         |

Returns an `InspectReport`:

```ts
interface InspectReport {
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  aggCount: number; // total aggregation nodes visited
  passedRules: string[]; // rule ids that ran and found nothing
  summary: string; // one-line human-readable summary
}
```

### Overriding rule severity

```ts
inspect(query, mapping, {
  ruleOverrides: {
    "large-terms-size": "warning",
    "prefer-keyword": "off",
  },
});
```

### Custom rule set

```ts
import { inspect, defaultRules, createLargeTermsSize } from "opensearch-agg-inspector";

inspect(query, mapping, {
  rules: [
    ...defaultRules.filter((r) => r.id !== "large-terms-size"),
    createLargeTermsSize({ threshold: 500 }),
  ],
});
```

---

## CLI usage

```bash
npx opensearch-agg-inspector query.json --mapping mapping.json
```

```
✖ query.json:4:5  error  prefer-keyword
  Field "country" is a text field and cannot be aggregated on reliably. Use "country.keyword" instead.
  → Change field to "country.keyword"
  https://github.com/ab1109/opensearch-agg-inspector/blob/main/docs/rules/prefer-keyword.md

⚠ query.json:4:5  warning  large-terms-size
  terms aggregation at "aggs.by_country" has size=5000, which is above the threshold of 1000. ...

1 error, 1 warning across 1 aggregation
```

Each issue is prefixed with `file:line:col`, which most terminals (VS Code,
iTerm2, …) turn into a clickable link straight to the aggregation.

| flag                           | description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| `-m, --mapping <file>`         | index mapping JSON (unlocks the field-aware rules)                   |
| `-f, --format <pretty\|json>`  | output format (default `pretty`)                                     |
| `-r, --rule-override <id=sev>` | override a rule's severity (`error\|warning\|info\|off`); repeatable |
| `--version`                    | print version                                                        |
| `-h, --help`                   | show help                                                            |

Exit code is `1` when any error-severity issue is found (or the input is
invalid), otherwise `0` — so it drops straight into CI:

```bash
opensearch-agg-inspector query.json -m mapping.json
```

Try it against the bundled example:

```bash
npx opensearch-agg-inspector examples/query.json -m examples/mapping.json
```

---

## Rules

| id                         | severity   | needs mapping | what it catches                                                 |
| -------------------------- | ---------- | :-----------: | --------------------------------------------------------------- |
| `unknown-aggregation-type` | warning    |       –       | typo'd aggregation type (`term` → `terms`)                      |
| `prefer-keyword`           | error      |      yes      | `terms` on an analyzed `text` field                             |
| `unknown-field`            | warning    |      yes      | aggregating on a field absent from the mapping                  |
| `invalid-date-histogram`   | error/warn |       –       | `date_histogram` missing `calendar_interval` / `fixed_interval` |
| `terms-size-zero`          | error      |       –       | `terms` with `size: 0` (rejected by modern clusters)            |
| `metric-sub-aggregation`   | error      |       –       | sub-aggregations under a metric aggregation                     |
| `large-terms-size`         | warning    |       –       | `terms` `size` above a threshold (default 1000)                 |
| `missing-shard-size`       | warning    |       –       | large `terms` `size` with no explicit `shard_size`              |

Full write-ups, with fix guidance, live in [`docs/rules/`](./docs/rules).

---

## Compatibility

Targets OpenSearch 1.x+ and Elasticsearch 7.x+ aggregation semantics (the
post-`interval` era). Requires Node 18.17+.

## Contributing

Adding a rule is one file plus one line — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
