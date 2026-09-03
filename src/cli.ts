#!/usr/bin/env node
/**
 * opensearch-agg-inspector CLI
 *
 * Usage:
 *   opensearch-agg-inspector <query.json...> [options]
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
import type { InspectReport, Mapping, RuleSeverityOverride } from "./index.js";

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
  opensearch-agg-inspector <query.json...> [options]

${c.bold("Options:")}
  -m, --mapping <file>          index mapping JSON (unlocks field-aware rules)
  -f, --format <pretty|json>    output format (default: pretty)
  -r, --rule-override <id=sev>  override a rule severity (error|warning|info|off); repeatable
      --version                 print version and exit
  -h, --help                   show this help

${c.bold("Examples:")}
  opensearch-agg-inspector query.json
  opensearch-agg-inspector queries/*.json -m mapping.json
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

const queryFiles = positionals;
if (queryFiles.length === 0) {
  console.error(HELP);
  process.exit(1);
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

// Lint each file. Read as raw text so every issue carries a source location.
interface FileResult {
  file: string;
  report?: InspectReport;
  error?: string;
}

const results: FileResult[] = queryFiles.map((file) => {
  const source = readFile(file, "query");
  try {
    return { file, report: inspect(source, mapping, { ruleOverrides }) };
  } catch (err) {
    return { file, error: (err as Error).message };
  }
});

if (format === "json") {
  const payload =
    results.length === 1 && results[0]!.report
      ? results[0]!.report
      : results.map((r) => ({ file: r.file, ...(r.report ?? { error: r.error }) }));
  console.log(JSON.stringify(payload, null, 2));
  process.exit(exitCode());
}

// ── pretty ──────────────────────────────────────────────────────────────────
let totalErrors = 0;
let totalWarnings = 0;
let totalInfo = 0;
let totalAggs = 0;

for (const { file, report, error } of results) {
  if (error) {
    console.log(`${c.red("✖")} ${c.bold(file)}  ${c.red("could not be parsed")}`);
    console.log(`  ${error}\n`);
    continue;
  }
  if (!report) continue;

  totalErrors += report.errorCount;
  totalWarnings += report.warningCount;
  totalInfo += report.infoCount;
  totalAggs += report.aggCount;

  if (report.issues.length === 0) {
    console.log(`${c.green("✓")} ${c.bold(file)}  ${c.dim(report.summary)}`);
    continue;
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
      ? `${file}:${issue.loc.line}:${issue.loc.column}`
      : `${file} (${issue.path})`;

    console.log(`${icon} ${c.bold(where)}  ${label}  ${c.dim(issue.rule)}`);
    console.log(`  ${issue.message}`);
    if (issue.suggestion) console.log(c.dim(`  → ${issue.suggestion}`));
    if (issue.docsUrl) console.log(c.dim(`  ${issue.docsUrl}`));
    console.log();
  }
}

const parseFailures = results.filter((r) => r.error).length;
const parts: string[] = [];
if (totalErrors)
  parts.push(c.red(c.bold(`${totalErrors} error${totalErrors !== 1 ? "s" : ""}`)));
if (totalWarnings)
  parts.push(
    c.yellow(c.bold(`${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}`))
  );
if (totalInfo) parts.push(c.cyan(`${totalInfo} info`));

const scope =
  queryFiles.length === 1
    ? `${totalAggs} aggregation${totalAggs !== 1 ? "s" : ""}`
    : `${totalAggs} aggregation${totalAggs !== 1 ? "s" : ""} in ${queryFiles.length} files`;

if (parts.length === 0 && parseFailures === 0) {
  console.log(`${c.green("✓")} no issues across ${scope}`);
} else {
  if (parts.length) console.log(`${parts.join(", ")} across ${scope}`);
  if (parseFailures) console.log(c.red(`${parseFailures} file(s) failed to parse`));
}

process.exit(exitCode());

function exitCode(): number {
  const anyErrors = results.some((r) => r.error || (r.report?.errorCount ?? 0) > 0);
  return anyErrors ? 1 : 0;
}
