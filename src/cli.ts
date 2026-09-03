#!/usr/bin/env node
/**
 * opensearch-agg-inspector CLI
 *
 * Usage:
 *   opensearch-agg-inspector <query.json> [options]
 *
 * Options:
 *   -m, --mapping <file>            index mapping JSON (unlocks field-aware rules)
 *   -f, --format <pretty|json>      output format (default: pretty)
 *   -r, --rule-override <id=sev>    override a rule's severity; repeatable
 *                                   sev = error | warning | info | off
 *       --version                   print version and exit
 *   -h, --help                      show this help
 *
 * Exit code: 1 if any error-severity issue is found (or on bad input), else 0.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { inspect } from "./index.js";
import type { Mapping, RuleSeverityOverride } from "./index.js";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { version: string };

const isTTY = process.stdout.isTTY;
const paint = (code: string, s: string) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: (s: string) => paint("1", s),
  dim: (s: string) => paint("2", s),
  red: (s: string) => paint("31", s),
  green: (s: string) => paint("32", s),
  yellow: (s: string) => paint("33", s),
  cyan: (s: string) => paint("36", s),
};

const HELP = `${c.bold("opensearch-agg-inspector")} — lint OpenSearch/Elasticsearch aggregation DSL

${c.bold("Usage:")}
  opensearch-agg-inspector <query.json> [options]

${c.bold("Options:")}
  -m, --mapping <file>          index mapping JSON (unlocks field-aware rules)
  -f, --format <pretty|json>    output format (default: pretty)
  -r, --rule-override <id=sev>  override a rule severity (error|warning|info|off); repeatable
      --version                 print version and exit
  -h, --help                   show this help

${c.bold("Examples:")}
  opensearch-agg-inspector query.json
  opensearch-agg-inspector query.json -m mapping.json -f json
  opensearch-agg-inspector query.json -r large-terms-size=off -r prefer-keyword=warning`;

function fail(msg: string): never {
  console.error(`${c.red("Error:")} ${msg}`);
  process.exit(1);
}

function parse() {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        mapping: { type: "string", short: "m" },
        format: { type: "string", short: "f", default: "pretty" },
        "rule-override": {
          type: "string",
          short: "r",
          multiple: true,
          default: [] as string[],
        },
        version: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err) {
    return fail((err as Error).message);
  }
}

const { values, positionals } = parse();

if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (values.version) {
  console.log(version);
  process.exit(0);
}

const queryFile = positionals[0];
if (!queryFile) {
  console.error(HELP);
  process.exit(1);
}
if (positionals.length > 1) {
  fail(`unexpected extra argument "${positionals[1]}" (did you forget a flag?)`);
}

const format = values.format;
if (format !== "pretty" && format !== "json") {
  fail(`--format must be "pretty" or "json" (got "${format}")`);
}

function readFile(filePath: string, label: string): string {
  const abs = resolve(filePath);
  if (!existsSync(abs)) fail(`${label} file not found: ${abs}`);
  try {
    return readFileSync(abs, "utf8");
  } catch (err) {
    return fail(`could not read ${label} file: ${(err as Error).message}`);
  }
}

function loadJson<T>(filePath: string, label: string): T {
  const raw = readFile(filePath, label);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fail(`${label} file is not valid JSON: ${resolve(filePath)}`);
  }
}

// Read the query as raw text and let inspect() parse it, so every issue carries
// a source location.
const querySource = readFile(queryFile, "query");
const mapping: Mapping | undefined = values.mapping
  ? loadJson<Mapping>(values.mapping, "mapping")
  : undefined;

const VALID_SEVERITIES = new Set(["error", "warning", "info", "off"]);
const ruleOverrides: Record<string, RuleSeverityOverride> = {};
for (const flag of values["rule-override"]) {
  const eq = flag.indexOf("=");
  if (eq === -1)
    fail(`--rule-override must look like "rule-id=severity" (got "${flag}")`);
  const id = flag.slice(0, eq);
  const severity = flag.slice(eq + 1);
  if (!VALID_SEVERITIES.has(severity)) {
    fail(`invalid severity "${severity}" for rule "${id}" (use error|warning|info|off)`);
  }
  ruleOverrides[id] = severity as RuleSeverityOverride;
}

let report: ReturnType<typeof inspect>;
try {
  report = inspect(querySource, mapping, { ruleOverrides });
} catch (err) {
  fail(
    `query file is not valid JSON: ${resolve(queryFile)}\n  ${(err as Error).message}`
  );
}

if (format === "json") {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errorCount > 0 ? 1 : 0);
}

if (report.issues.length === 0) {
  console.log(`${c.green("✓")} ${report.summary}`);
  if (report.passedRules.length > 0) {
    console.log(c.dim(`  passed: ${report.passedRules.join(", ")}`));
  }
  process.exit(0);
}

for (const issue of report.issues) {
  const icon =
    issue.severity === "error"
      ? c.red("✖")
      : issue.severity === "warning"
        ? c.yellow("⚠")
        : c.cyan("ℹ");
  const label =
    issue.severity === "error"
      ? c.red("error")
      : issue.severity === "warning"
        ? c.yellow("warning")
        : c.cyan("info");

  // `file:line:col` — clickable in most terminals; falls back to the dot-path.
  const where = issue.loc
    ? `${queryFile}:${issue.loc.line}:${issue.loc.column}`
    : `${queryFile} (${issue.path})`;

  console.log(`${icon} ${c.bold(where)}  ${label}  ${c.dim(issue.rule)}`);
  console.log(`  ${issue.message}`);
  if (issue.suggestion) console.log(c.dim(`  → ${issue.suggestion}`));
  if (issue.docsUrl) console.log(c.dim(`  ${issue.docsUrl}`));
  console.log();
}

const parts: string[] = [];
if (report.errorCount)
  parts.push(
    c.red(c.bold(`${report.errorCount} error${report.errorCount !== 1 ? "s" : ""}`))
  );
if (report.warningCount)
  parts.push(
    c.yellow(
      c.bold(`${report.warningCount} warning${report.warningCount !== 1 ? "s" : ""}`)
    )
  );
if (report.infoCount) parts.push(c.cyan(`${report.infoCount} info`));
console.log(
  `${parts.join(", ")} across ${report.aggCount} aggregation${report.aggCount !== 1 ? "s" : ""}`
);

process.exit(report.errorCount > 0 ? 1 : 0);
