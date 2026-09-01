import type { Rule, Issue, AggregationNode } from "../types.js";
import { resolveField } from "../mapping.js";
import { docsUrl } from "../docs.js";

/** Metric aggregation keys that take a single `field`. */
const FIELD_AGGS = [
  "terms",
  "avg",
  "sum",
  "min",
  "max",
  "value_count",
  "cardinality",
  "date_histogram",
  "histogram",
] as const;

/**
 * Flags aggregations that reference a field not present in the provided mapping.
 * An unknown field silently returns no results — it never throws a cluster error —
 * which makes it easy to miss in development.
 */
export const unknownField: Rule = {
  id: "unknown-field",
  description:
    "Aggregating on a field that does not exist in the mapping will silently return no results.",
  check({ node, path, mapping }): Issue[] {
    if (!mapping) return [];

    const field = getField(node);
    if (!field) return [];

    // Ignore scripted fields — they don't reference a mapping field.
    if (isScripted(node)) return [];

    if (resolveField(mapping, field) !== undefined) return [];

    return [
      {
        rule: unknownField.id,
        severity: "warning",
        message: `Field "${field}" does not exist in the provided mapping. The aggregation will silently return no data.`,
        path,
        suggestion: `Check the field name spelling and confirm it exists in the index mapping.`,
        fixable: false,
        docsUrl: docsUrl(unknownField.id),
      },
    ];
  },
};

/** Extracts the field name from any supported aggregation type. */
function getField(node: AggregationNode): string | undefined {
  for (const key of FIELD_AGGS) {
    const body = (node as Record<string, { field?: string } | undefined>)[key];
    if (body?.field) return body.field;
  }
  return undefined;
}

function isScripted(node: AggregationNode): boolean {
  for (const key of FIELD_AGGS) {
    const body = (node as Record<string, { script?: unknown } | undefined>)[key];
    if (body?.script) return true;
  }
  return false;
}
