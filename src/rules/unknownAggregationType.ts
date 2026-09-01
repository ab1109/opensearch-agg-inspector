import type { Rule, Issue } from "../types.js";
import { KNOWN_AGG_TYPES, aggTypeKeys } from "../aggTypes.js";
import { docsUrl } from "../docs.js";

/**
 * Flags aggregation nodes that contain no recognized aggregation type.
 *
 * The usual cause is a typo — `term` instead of `terms`, `date_histogtram`,
 * `cardnality` — which the cluster rejects with
 * `Unknown aggregation type [...]`. Because the check is a denylist of *known*
 * types, an aggregation from an unusual plugin may be flagged; silence this
 * rule (`"unknown-aggregation-type": "off"`) or the specific node if so.
 */
export const unknownAggregationType: Rule = {
  id: "unknown-aggregation-type",
  description:
    "Aggregation node has no recognized aggregation type — usually a typo (e.g. `term` for `terms`).",
  check({ node, path }): Issue[] {
    const keys = aggTypeKeys(node as Record<string, unknown>);

    // A node that only nests sub-aggs (aggs/aggregations/meta) is structural,
    // not itself an aggregation — leave it alone.
    if (keys.length === 0) return [];

    if (keys.some((k) => KNOWN_AGG_TYPES.has(k))) return [];

    return [
      {
        rule: unknownAggregationType.id,
        severity: "warning",
        message: `Aggregation at "${path}" has no recognized aggregation type (found: ${keys
          .map((k) => `"${k}"`)
          .join(", ")}). The cluster will reject an unknown type.`,
        path,
        suggestion: "Check for a typo in the aggregation type name.",
        fixable: false,
        docsUrl: docsUrl(unknownAggregationType.id),
      },
    ];
  },
};
