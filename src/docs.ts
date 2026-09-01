/**
 * Base URL for the per-rule documentation pages.
 * Each rule appends `<rule-id>.md` to build its `docsUrl`.
 */
export const DOCS_BASE =
  "https://github.com/ab1109/opensearch-agg-inspector/blob/main/docs/rules";

/** Builds the docs URL for a given rule id. */
export function docsUrl(ruleId: string): string {
  return `${DOCS_BASE}/${ruleId}.md`;
}
