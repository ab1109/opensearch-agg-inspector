import type { Rule, Issue } from "../types.js";
import { docsUrl } from "../docs.js";

/**
 * Flags `terms` (and `significant_terms` / `multi_terms`) aggregations with
 * `size: 0`.
 *
 * In Elasticsearch 1.x–5.x, `size: 0` meant "return every bucket". That was
 * removed in 6.0 and never existed in OpenSearch — the cluster now rejects the
 * request with `[size] must be greater than 0`. To get all values, use a
 * `composite` aggregation with pagination.
 */
export const termsSizeZero: Rule = {
  id: "terms-size-zero",
  description:
    'terms aggregations no longer accept size: 0 ("all buckets"); the request is rejected.',
  check({ node, path }): Issue[] {
    const body =
      node.terms ??
      (node as Record<string, { size?: number } | undefined>).significant_terms ??
      (node as Record<string, { size?: number } | undefined>).multi_terms;
    if (!body) return [];
    if (body.size !== 0) return [];

    return [
      {
        rule: termsSizeZero.id,
        severity: "error",
        message: `terms aggregation at "${path}" has size: 0. Modern OpenSearch/Elasticsearch rejects this with "[size] must be greater than 0".`,
        path,
        suggestion:
          "Set a positive size, or use a composite aggregation with pagination to retrieve every value.",
        fixable: false,
        docsUrl: docsUrl(termsSizeZero.id),
      },
    ];
  },
};
