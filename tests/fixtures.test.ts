/**
 * Fixture-based test runner.
 *
 * Convention:
 *   tests/fixtures/<rule-id>/<case-name>/input.json     — the query
 *   tests/fixtures/<rule-id>/<case-name>/mapping.json   — (optional) the mapping
 *   tests/fixtures/<rule-id>/<case-name>/expected.json  — Issue[] expected subset
 *
 * expected.json is an array of partial Issue objects — each entry is matched
 * with toMatchObject so you only need to assert the fields you care about.
 * An empty array [] means "expect zero issues from this rule".
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "../src/inspector.js";
import type { Mapping } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// Discover all fixture cases: fixtures/<rule-id>/<case-name>/
const ruleDirs = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const ruleId of ruleDirs) {
  const rulePath = join(FIXTURES_DIR, ruleId);
  const cases = readdirSync(rulePath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  describe(`rule: ${ruleId}`, () => {
    for (const caseName of cases) {
      it(caseName, () => {
        const casePath = join(rulePath, caseName);

        const query = JSON.parse(readFileSync(join(casePath, "input.json"), "utf8"));
        const mapping: Mapping | undefined = existsSync(join(casePath, "mapping.json"))
          ? JSON.parse(readFileSync(join(casePath, "mapping.json"), "utf8"))
          : undefined;
        const expected = JSON.parse(
          readFileSync(join(casePath, "expected.json"), "utf8")
        ) as object[];

        const report = inspect(query, mapping);

        // Filter to only issues from this rule so fixtures stay focused
        const ruleIssues = report.issues.filter((i) => i.rule === ruleId);

        expect(ruleIssues).toHaveLength(expected.length);
        expected.forEach((want, i) => {
          expect(ruleIssues[i]).toMatchObject(want);
        });
      });
    }
  });
}
