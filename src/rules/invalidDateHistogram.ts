import type { Rule, Issue } from "../types.js";
import { docsUrl } from "../docs.js";

/**
 * Flags `date_histogram` aggregations that are missing both
 * `calendar_interval` and `fixed_interval`.
 *
 * OpenSearch 1.x+ and Elasticsearch 7.x+ removed the deprecated `interval`
 * parameter. Omitting both of the modern interval fields causes a hard
 * runtime error. Using the old `interval` field produces a deprecation
 * warning and will eventually fail.
 */
export const invalidDateHistogram: Rule = {
  id: "invalid-date-histogram",
  description:
    "date_histogram must specify calendar_interval or fixed_interval; the legacy interval field is deprecated.",
  check({ node, path }): Issue[] {
    const dh = node.date_histogram;
    if (!dh) return [];

    if (dh.calendar_interval || dh.fixed_interval) return [];

    if (dh.interval) {
      // Legacy form — present but deprecated
      return [
        {
          rule: invalidDateHistogram.id,
          severity: "warning",
          message: `date_histogram uses the deprecated "interval" field. Replace it with "calendar_interval" (e.g. "1d") or "fixed_interval" (e.g. "1h").`,
          path,
          suggestion: `Replace interval: "${dh.interval}" with calendar_interval: "${dh.interval}" or fixed_interval: "${dh.interval}"`,
          fixable: true,
          docsUrl: docsUrl(invalidDateHistogram.id),
        },
      ];
    }

    // Neither form present
    return [
      {
        rule: invalidDateHistogram.id,
        severity: "error",
        message: `date_histogram is missing "calendar_interval" or "fixed_interval". This will throw a runtime error in OpenSearch 1.x+ and Elasticsearch 7.x+.`,
        path,
        suggestion: `Add calendar_interval (e.g. "1d", "1M") or fixed_interval (e.g. "1h", "30m").`,
        fixable: false,
        docsUrl: docsUrl(invalidDateHistogram.id),
      },
    ];
  },
};
