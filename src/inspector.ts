import { walk } from "./walker.js";
import { defaultRules } from "./rules/index.js";
import type {
  AggregationNode,
  Issue,
  Mapping,
  Rule,
  RuleSeverityOverride,
  Severity,
} from "./types.js";

export interface InspectOptions {
  /** Override the default rule set entirely, or pass a custom list. */
  rules?: readonly Rule[];
  /**
   * Per-rule severity overrides. Use `"off"` to silence a rule entirely.
   *
   * @example
   * { "large-terms-size": "warning", "prefer-keyword": "off" }
   */
  ruleOverrides?: Record<string, RuleSeverityOverride>;
}

export interface InspectReport {
  issues: Issue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Total number of aggregation nodes visited. */
  aggCount: number;
  /** IDs of rules that ran and produced zero issues. */
  passedRules: string[];
  /** One-line human-readable summary. */
  summary: string;
}

/**
 * Analyzes an OpenSearch/Elasticsearch query's `aggs` block and returns a
 * report of correctness, performance, and best-practice issues — without ever
 * executing the query.
 *
 * @param query   an object with an `aggs` (or `aggregations`) block
 * @param mapping optional index mapping; unlocks the field-aware rules
 * @param options custom rule set and/or per-rule severity overrides
 *
 * @example
 * const report = inspect(query, mapping);
 * if (report.errorCount) console.error(report.summary);
 *
 * @example — silence or downgrade a rule
 * inspect(query, mapping, {
 *   ruleOverrides: { "large-terms-size": "warning", "prefer-keyword": "off" },
 * });
 */
export function inspect(
  query: AggregationNode,
  mapping?: Mapping,
  options: InspectOptions = {}
): InspectReport {
  const rules = options.rules ?? defaultRules;
  const overrides = options.ruleOverrides ?? {};

  if (query == null || typeof query !== "object") {
    throw new TypeError(
      `inspect() expects a query object with an "aggs" block, got ${query === null ? "null" : typeof query}`
    );
  }

  const { issues: rawIssues, aggCount } = walk(query, rules, mapping);

  // Apply per-rule severity overrides; drop issues from rules set to "off".
  const issues: Issue[] = [];
  for (const issue of rawIssues) {
    const override = overrides[issue.rule];
    if (override === "off") continue;
    issues.push(override ? { ...issue, severity: override as Severity } : issue);
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const firedRuleIds = new Set(issues.map((i) => i.rule));
  const passedRules = rules
    .map((r) => r.id)
    .filter((id) => !firedRuleIds.has(id) && overrides[id] !== "off");

  const parts: string[] = [];
  if (errorCount) parts.push(`${errorCount} error${errorCount !== 1 ? "s" : ""}`);
  if (warningCount) parts.push(`${warningCount} warning${warningCount !== 1 ? "s" : ""}`);
  if (infoCount) parts.push(`${infoCount} info`);
  const agg = `${aggCount} aggregation${aggCount !== 1 ? "s" : ""}`;
  const summary =
    parts.length === 0
      ? `No issues found across ${agg}`
      : `${parts.join(", ")} across ${agg}`;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    aggCount,
    passedRules,
    summary,
  };
}
