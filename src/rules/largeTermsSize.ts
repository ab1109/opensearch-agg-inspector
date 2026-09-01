import type { Rule, Issue } from "../types.js";
import { docsUrl } from "../docs.js";

/** Default threshold above which a terms `size` is flagged. */
export const DEFAULT_LARGE_TERMS_THRESHOLD = 1000;

/**
 * Flags `terms` aggregations with a very large `size` value.
 * A large size forces OpenSearch to collect and merge many buckets across
 * all shards, which can cause significant heap pressure and slow responses.
 *
 * Use the factory function to customise the threshold:
 * @example
 * import { createLargeTermsSize } from "opensearch-agg-inspector";
 * const rule = createLargeTermsSize({ threshold: 500 });
 */
export const largeTermsSize: Rule = createLargeTermsSize();

export interface LargeTermsSizeOptions {
  /** Size values strictly above this threshold will be flagged. Default: 1000. */
  threshold?: number;
}

export function createLargeTermsSize(options: LargeTermsSizeOptions = {}): Rule {
  const threshold = options.threshold ?? DEFAULT_LARGE_TERMS_THRESHOLD;

  return {
    id: "large-terms-size",
    description: `terms aggregations with size > ${threshold} can cause significant heap pressure.`,
    check({ node, path }): Issue[] {
      const size = node.terms?.size;
      if (typeof size !== "number") return [];
      if (size <= threshold) return [];

      return [
        {
          rule: "large-terms-size",
          severity: "warning",
          message: `terms aggregation at "${path}" has size=${size}, which is above the threshold of ${threshold}. Large sizes increase heap usage and response time.`,
          path,
          suggestion: `Reduce size to ${threshold} or lower. If you need every value, use a composite aggregation with pagination instead.`,
          fixable: false,
          docsUrl: docsUrl("large-terms-size"),
        },
      ];
    },
  };
}
