# opensearch-agg-inspector

[![npm](https://img.shields.io/npm/v/opensearch-agg-inspector.svg)](https://www.npmjs.com/package/opensearch-agg-inspector)
[![CI](https://github.com/ab1109/opensearch-agg-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/ab1109/opensearch-agg-inspector/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/opensearch-agg-inspector.svg)](https://www.npmjs.com/package/opensearch-agg-inspector)
[![license](https://img.shields.io/npm/l/opensearch-agg-inspector.svg)](./LICENSE)

Static analysis / linter for **OpenSearch** and **Elasticsearch** aggregation DSL.
Point it at an `aggs` block (and, optionally, your index mapping); it reports
correctness, performance, and best-practice problems — **without ever running the
query against a cluster.**

Aggregation mistakes are quiet:

- a **misspelled field** returns an empty result — no error, just a blank panel
- a `terms` on an analyzed **`text` field** silently buckets word-fragments
  (`"new"`, `"york"`) instead of values, or fails outright with fielddata off
- a `date_histogram` with **no interval**, a `terms` with **`size: 0`**, or a
  metric with **sub-aggregations** all 400 — but only once the request reaches
  the cluster, often in production

This catches all of that from a `.json` file or a JS object, in CI or before
your code sends the query.

```bash
npm install --save-dev opensearch-agg-inspector
```

- Zero runtime dependencies · ESM + CommonJS + TypeScript types
- A **library** (`inspect()`) and a **CLI** (`opensearch-agg-inspector` / `osaggs`)

---

## 60-second tour

`dashboard.json` — a real-looking sales dashboard query with four planted mistakes:

```json
{
  "size": 0,
  "aggs": {
    "sales_by_region": { "terms": { "field": "region", "size": 5000 } },
    "sales_over_time": { "date_histogram": { "field": "ordered_at" } },
    "revenue": {
      "sum": { "field": "amount" },
      "aggs": { "by_channel": { "terms": { "field": "chanel" } } }
    }
  }
}
```

```bash
npx opensearch-agg-inspector dashboard.json --mapping orders-mapping.json
```

```
✖ dashboard.json:4:5  error  prefer-keyword
  Field "region" is a text field and cannot be aggregated on reliably. Use "region.keyword" instead.
  → Change field to "region.keyword"

⚠ dashboard.json:4:5  warning  large-terms-size
  terms aggregation at "aggs.sales_by_region" has size=5000, which is above the threshold of 1000. Large sizes increase heap usage and response time.

⚠ dashboard.json:4:5  warning  missing-shard-size
  terms aggregation at "aggs.sales_by_region" has size=5000 but no shard_size. On multi-shard indices the default shard_size can be too low, producing inaccurate top-N results.

✖ dashboard.json:5:5  error  invalid-date-histogram
  date_histogram is missing "calendar_interval" or "fixed_interval". This will throw a runtime error in OpenSearch 1.x+ and Elasticsearch 7.x+.

✖ dashboard.json:6:5  error  metric-sub-aggregation
  Aggregation at "aggs.revenue" is a metric aggregation ("sum") but has sub-aggregations. The cluster will reject this — only bucket aggregations can have children.

⚠ dashboard.json:9:9  warning  unknown-field
  Field "chanel" does not exist in the provided mapping. The aggregation will silently return no data.

3 errors, 3 warnings across 4 aggregations
```

<sub>(the real output also prints a `→` fix hint and a docs link under each issue)</sub>

| mistake                           | what happens without the linter                                 | rule                                     |
| --------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `terms` on `text` field `region`  | per-token buckets, or a fielddata error at query time           | `prefer-keyword`                         |
| `date_histogram` with no interval | **HTTP 400** every time the query runs                          | `invalid-date-histogram`                 |
| `sum` with a sub-aggregation      | **HTTP 400** every time the query runs                          | `metric-sub-aggregation`                 |
| `"chanel"` — typo for `channel`   | bucket comes back **empty**, no error, dashboard panel is blank | `unknown-field`                          |
| `size: 5000`                      | heavy heap use on every shard; top-N may be inaccurate          | `large-terms-size`, `missing-shard-size` |

Each issue is prefixed with `file:line:col` — clickable in VS Code / iTerm2 / most
terminals. Exit code is `1` when there are any errors, `0` otherwise.

---

## Real-world usage

### 1. Block broken query templates in CI

You keep saved aggregation queries in the repo (dashboard definitions, report
templates, canned searches). Lint every one of them on each PR:

```json
{
  "scripts": {
    "lint:queries": "opensearch-agg-inspector queries/*.json --mapping mapping.json"
  }
}
```

```yaml
# .github/workflows/ci.yml
- run: npm run lint:queries
```

The shell expands the glob; the CLI lints each file. For a nested tree, pass an
explicit list or `$(find queries -name '*.json')`.

A bad merge now fails the build with an exact location instead of shipping a
dashboard that 400s:

```
✓ queries/inventory.agg.json  No issues found across 6 aggregations
✖ queries/sales.agg.json:12:7  error  invalid-date-histogram
  date_histogram is missing "calendar_interval" or "fixed_interval". ...

1 error across 14 aggregations in 2 files
```

Export the mapping once and commit it alongside the queries:

```bash
curl -s localhost:9200/orders/_mapping | jq '.orders.mappings.properties' > mapping.json
```

### 2. Validate a query your code builds at runtime

A reporting endpoint assembles an aggregation from user-selected dimensions.
Check it before it goes to the cluster — throw in development, log-and-continue
in production, so a bad request never becomes silent bad data:

```ts
import { inspect } from "opensearch-agg-inspector";

const mapping = await loadMapping("orders"); // cache this

export async function runReport(client, { groupBy, metric }) {
  const query = {
    size: 0,
    aggs: {
      groups: {
        terms: { field: groupBy },
        aggs: { value: { [metric]: { field: "amount" } } },
      },
    },
  };

  const report = inspect(query, mapping);
  if (report.errorCount > 0) {
    const detail = report.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.path}: ${i.message}`)
      .join("\n");

    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Bad aggregation query:\n${detail}`);
    }
    logger.error({ detail }, "refusing to run a broken aggregation");
    return { buckets: [] };
  }

  return client.search({ index: "orders", body: query });
}
```

If a caller passes `groupBy: "customer_name"` and that's a `text` field, this
stops the request instead of returning a bucket per name-fragment.

### 3. Assert your queries in your test suite

```ts
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { inspect } from "opensearch-agg-inspector";

const mapping = JSON.parse(readFileSync("mapping.json", "utf8"));

test("the sales dashboard query is valid", () => {
  const report = inspect(readFileSync("queries/sales.agg.json", "utf8"), mapping);
  expect(report.issues).toEqual([]); // failure prints every issue with its line
});
```

### 4. Eyeball a query a teammate pasted you

```bash
pbpaste > /tmp/q.json && npx opensearch-agg-inspector /tmp/q.json -m mapping.json
```

or pipe the JSON report into `jq`:

```bash
opensearch-agg-inspector q.json -m mapping.json -f json | jq '.issues[] | {rule, path, message}'
```

---

## API

### `inspect(query, mapping?, options?)`

| argument  | type                                                               | notes                                                                                                    |
| --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `query`   | `{ aggs }` / `{ aggregations }` object, **or** the raw JSON string | pass a string to also get `issue.loc` (`{ line, column, offset }`)                                       |
| `mapping` | `Record<string, MappingField>`                                     | flat `field → { type, fields?, properties? }` map; unlocks `prefer-keyword` + `unknown-field`. Optional. |
| `options` | `{ rules?, ruleOverrides? }`                                       | custom rule set / per-rule severity                                                                      |

```ts
const report = inspect(query, mapping);
// {
//   issues: [{ rule, severity, message, path, loc?, suggestion?, fixable?, docsUrl? }],
//   errorCount, warningCount, infoCount,
//   aggCount,          // aggregation nodes visited
//   passedRules,       // rule ids that ran and found nothing
//   summary,           // "3 errors, 3 warnings across 4 aggregations"
// }
```

`report.errorCount > 0` is the signal to fail a build / block a request.
Warnings are advisory.

### Downgrade or silence a rule

```ts
inspect(query, mapping, {
  ruleOverrides: {
    "large-terms-size": "warning", // or "info"
    "missing-shard-size": "off",
  },
});
```

```bash
opensearch-agg-inspector q.json -m m.json -r large-terms-size=off -r prefer-keyword=warning
```

### Tune a threshold / build a custom rule set

```ts
import { inspect, defaultRules, createLargeTermsSize } from "opensearch-agg-inspector";

inspect(query, mapping, {
  rules: [
    ...defaultRules.filter((r) => r.id !== "large-terms-size"),
    createLargeTermsSize({ threshold: 250 }),
  ],
});
```

### Locations without the CLI

`parseJsonWithLocs(text)` is exported if you want the position map directly
(`{ value, locs: Map<path, {line,column,offset}> }`).

---

## CLI

```
opensearch-agg-inspector <query.json...> [options]

  -m, --mapping <file>          index mapping JSON (unlocks the field-aware rules)
  -f, --format <pretty|json>    output format (default: pretty)
  -r, --rule-override <id=sev>  override a rule severity (error|warning|info|off); repeatable
      --version                 print version
  -h, --help                    show help
```

Accepts multiple files / shell globs. `--format json` prints one report object
for a single file, or an array of `{ file, ...report }` for several. Exit code
`1` if any file has an error-severity issue or fails to parse.

---

## Rules

| id                                                                   | severity     | needs mapping | catches                                              |
| -------------------------------------------------------------------- | ------------ | :-----------: | ---------------------------------------------------- |
| [`unknown-aggregation-type`](docs/rules/unknown-aggregation-type.md) | warning      |       –       | typo'd aggregation type (`term` → `terms`)           |
| [`prefer-keyword`](docs/rules/prefer-keyword.md)                     | error        |      yes      | `terms` on an analyzed `text` field                  |
| [`unknown-field`](docs/rules/unknown-field.md)                       | warning      |      yes      | aggregating on a field absent from the mapping       |
| [`invalid-date-histogram`](docs/rules/invalid-date-histogram.md)     | error / warn |       –       | `date_histogram` missing a modern interval           |
| [`terms-size-zero`](docs/rules/terms-size-zero.md)                   | error        |       –       | `terms` with `size: 0` (rejected by modern clusters) |
| [`metric-sub-aggregation`](docs/rules/metric-sub-aggregation.md)     | error        |       –       | sub-aggregations under a metric aggregation          |
| [`large-terms-size`](docs/rules/large-terms-size.md)                 | warning      |       –       | `terms` `size` above a threshold (default 1000)      |
| [`missing-shard-size`](docs/rules/missing-shard-size.md)             | warning      |       –       | large `terms` `size` with no explicit `shard_size`   |

---

## Compatibility

Targets OpenSearch 1.x+ and Elasticsearch 7.x+ aggregation semantics (the
post-`interval` era). Requires Node 20+.

## Contributing

Adding a rule is one file plus one line — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
