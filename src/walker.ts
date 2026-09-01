import type { AggregationNode, Rule, Issue, Mapping, RuleState } from "./types.js";

export interface WalkResult {
  issues: Issue[];
  /** Total number of named aggregation nodes visited. */
  aggCount: number;
}

/**
 * Recursively visits every named aggregation in an `aggs` (or `aggregations`)
 * block, running every rule against each node.
 *
 * @example
 * {
 *   aggs: {
 *     status: {
 *       terms: { field: "status" },
 *       aggs: {
 *         avg_latency: { avg: { field: "time" } }
 *       }
 *     }
 *   }
 * }
 */
export function walk(
  query: AggregationNode,
  rules: readonly Rule[],
  mapping?: Mapping
): WalkResult {
  const state: RuleState = new Map();
  const issues: Issue[] = [];

  for (const rule of rules) {
    rule.beforeWalk?.(query, mapping, state);
  }

  const root = query.aggs ?? query.aggregations;
  if (!root) return { issues, aggCount: 0 };

  const aggCount = visitAggsBlock(root, "aggs", query, rules, mapping, state, issues);
  return { issues, aggCount };
}

/** Visits one `aggs` block, recurses into sub-aggs, and returns the node count. */
function visitAggsBlock(
  aggsBlock: Record<string, AggregationNode>,
  pathPrefix: string,
  query: AggregationNode,
  rules: readonly Rule[],
  mapping: Mapping | undefined,
  state: RuleState,
  issues: Issue[]
): number {
  let count = 0;

  for (const [name, node] of Object.entries(aggsBlock)) {
    count += 1;
    const path = `${pathPrefix}.${name}`;

    for (const rule of rules) {
      issues.push(...rule.check({ node, path, mapping, query, state }));
    }

    const subAggs = node.aggs ?? node.aggregations;
    if (subAggs) {
      count += visitAggsBlock(subAggs, path, query, rules, mapping, state, issues);
    }
  }

  return count;
}
