# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-03

Initial release.

### Added

- `inspect(query, mapping?, options?)` engine with a recursive aggregation
  walker and pluggable, stateless rules.
- Rules: `unknown-aggregation-type`, `prefer-keyword`, `unknown-field`,
  `invalid-date-histogram`, `terms-size-zero`, `metric-sub-aggregation`,
  `large-terms-size`, `missing-shard-size`.
- Source locations: pass the raw JSON string to `inspect()` and every issue
  gets a `loc` (`{ line, column, offset }`). Exposed via `parseJsonWithLocs`,
  a dependency-free position-tracking JSON parser.
- Per-rule severity overrides (`ruleOverrides`, including `"off"`) and custom
  rule sets.
- CLI (`opensearch-agg-inspector` / `osaggs`) with `pretty` and `json` output,
  `--mapping`, repeatable `--rule-override`, and a CI-friendly exit code. The
  pretty output prefixes each issue with a clickable `file:line:col`.
- Mapping helpers `resolveField` / `hasKeywordForm` that understand both
  `properties` (object sub-fields) and `fields` (multi-fields).
- Dual ESM + CommonJS builds with TypeScript declarations.
- Per-rule documentation under `docs/rules/`.

[0.1.0]: https://github.com/ab1109/opensearch-agg-inspector/releases/tag/v0.1.0
