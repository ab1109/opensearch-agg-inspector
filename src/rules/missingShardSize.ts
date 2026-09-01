import type { Rule, Issue } from "../types.js";
import { docsUrl } from "../docs.js";

/** terms size above this value triggers the shard_size check. */
const SIZE_THRESHOLD = 100;

/**
 * Flags `terms` aggregations with a large `size` but no explicit `shard_size`.
 *
 * OpenSearch defaults `shard_size` to `size * 1.5 + 10`. For high-cardinality
 * fields spread across many shards that default is often too low, so the final
 * top-N can be inaccurate (counts and even membership can be wrong). Setting
 * `shard_size` explicitly — higher than the default — makes the accuracy /
 * cost trade-off intentional.
 */
export const missingShardSize: Rule = {
  id: "missing-shard-size",
  description:
    "terms aggregation with large size but no shard_size may produce inaccurate results on multi-shard indices.",
  check({ node, path }): Issue[] {
    const terms = node.terms;
    if (!terms) return [];

    const { size, shard_size } = terms;

    if (typeof size !== "number" || size <= SIZE_THRESHOLD) return [];
    if (typeof shard_size === "number") return [];

    // Recommend meaningfully above the automatic default (size * 1.5 + 10).
    const recommended = size * 2 + 10;

    return [
      {
        rule: missingShardSize.id,
        severity: "warning",
        message: `terms aggregation at "${path}" has size=${size} but no shard_size. On multi-shard indices the default shard_size can be too low, producing inaccurate top-N results.`,
        path,
        suggestion: `Set shard_size explicitly — e.g. ${recommended} — above the automatic default of ${Math.ceil(size * 1.5) + 10}.`,
        fixable: true,
        docsUrl: docsUrl(missingShardSize.id),
      },
    ];
  },
};
