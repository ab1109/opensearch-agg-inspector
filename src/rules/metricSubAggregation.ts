import type { Rule, Issue } from "../types.js";
import { METRIC_AGG_TYPES, aggTypeKeys } from "../aggTypes.js";
import { docsUrl } from "../docs.js";

/**
 * Flags metric aggregations that carry sub-aggregations.
 *
 * Only bucket aggregations produce buckets for children to run against, so a
 * metric aggregation (`avg`, `cardinality`, `top_hits`, …) with an `aggs`
 * block is rejected by the cluster with
 * `Aggregator [...] of type [...] cannot accept sub-aggregations`.
 */
export const metricSubAggregation: Rule = {
  id: "metric-sub-aggregation",
  description:
    "Metric aggregations cannot contain sub-aggregations; only bucket aggregations can.",
  check({ node, path }): Issue[] {
    const subAggs = node.aggs ?? node.aggregations;
    if (!subAggs || Object.keys(subAggs).length === 0) return [];

    const metricKey = aggTypeKeys(node as Record<string, unknown>).find((k) =>
      METRIC_AGG_TYPES.has(k)
    );
    if (!metricKey) return [];

    return [
      {
        rule: metricSubAggregation.id,
        severity: "error",
        message: `Aggregation at "${path}" is a metric aggregation ("${metricKey}") but has sub-aggregations. The cluster will reject this — only bucket aggregations can have children.`,
        path,
        suggestion: `Move the sub-aggregations out of "${path}", or wrap them in a bucket aggregation (e.g. filter, terms, nested).`,
        fixable: false,
        docsUrl: docsUrl(metricSubAggregation.id),
      },
    ];
  },
};
