# Contributing

## Getting set up

```bash
npm install
npm test          # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # prettier --check + tsc
npm run build      # tsup → dist/
```

## Architecture

```
src/
  types.ts       Rule / Issue / RuleContext / Mapping interfaces
  walker.ts      recursively visits every aggregation node, runs every rule
  inspector.ts   public inspect(query, mapping, options) entrypoint
  mapping.ts     resolveField / hasKeywordForm — mapping lookup helpers
  aggTypes.ts    known aggregation type names (metric / bucket / pipeline)
  docs.ts        docsUrl(ruleId) helper
  cli.ts         thin CLI wrapper around inspect()
  rules/
    <rule>.ts    one file per rule
    index.ts     the default rule set + re-exports
tests/
  inspector.test.ts   behavioural tests
  fixtures.test.ts     runs every tests/fixtures/<rule>/<case>/
  fixtures/            input.json (+ mapping.json) → expected.json
```

Every rule is **independent and stateless**. It receives a `RuleContext`
(the current node, its dot-path, the mapping, the full query, a per-run
`state` bag) and returns `Issue[]`. The walker and inspector never change as
rules are added — this is deliberately the same shape as ESLint.

Rules must not store state on the rule object itself (it's a module
singleton and would leak between `inspect()` calls). If a rule needs to scan
the whole query first, use the optional `beforeWalk(query, mapping, state)`
hook and stash results in `state`, keyed by the rule id.

## Adding a rule

1. Create `src/rules/myRule.ts`:

   ```ts
   import type { Rule, Issue } from "../types.js";
   import { docsUrl } from "../docs.js";

   export const myRule: Rule = {
     id: "my-rule",
     description: "One line describing what's wrong and why.",
     check({ node, path, mapping }): Issue[] {
       // return [] when there's nothing to report
       return [];
     },
   };
   ```

2. Import it in `src/rules/index.ts` and add it to `defaultRules` (and the
   re-export block).
3. Re-export its public symbols from `src/index.ts` if callers need them.
4. Add fixtures under `tests/fixtures/my-rule/<case>/`:
   - `input.json` — the query
   - `mapping.json` — optional
   - `expected.json` — array of partial `Issue` objects (matched with
     `toMatchObject`); `[]` means "this rule reports nothing here"
5. Add `docs/rules/my-rule.md`.
6. Add a row to the rules table in `README.md`.

## Releasing

`npm run prepublishOnly` runs lint + tests + build. Bump the version, update
`CHANGELOG.md`, tag, and `npm publish`.
