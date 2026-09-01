import type { Rule, Issue } from "../types.js";
import { resolveField, hasKeywordForm } from "../mapping.js";
import { docsUrl } from "../docs.js";

/**
 * Flags terms aggregations that run directly on a `text` field.
 * Text fields are analyzed (tokenized) so aggregating on them either fails
 * outright (fielddata disabled) or produces misleading per-token buckets.
 * The fix is almost always to aggregate on a `.keyword` multi-field instead.
 */
export const preferKeyword: Rule = {
  id: "prefer-keyword",
  description:
    "Aggregating on a text field is usually wrong; use a keyword sub-field instead.",
  check({ node, path, mapping }): Issue[] {
    if (!mapping) return [];

    const field = node.terms?.field;
    if (!field) return [];

    const fieldDef = resolveField(mapping, field);
    if (fieldDef?.type !== "text") return [];

    const keyword = hasKeywordForm(mapping, field);
    const target = keyword?.keywordField;

    return [
      {
        rule: preferKeyword.id,
        severity: "error",
        message: target
          ? `Field "${field}" is a text field and cannot be aggregated on reliably. Use "${target}" instead.`
          : `Field "${field}" is a text field and cannot be aggregated on reliably. Add a keyword sub-field to it in your mapping.`,
        path,
        suggestion: target
          ? `Change field to "${target}"`
          : `Add a keyword sub-field to "${field}" in your mapping`,
        fixable: Boolean(target),
        docsUrl: docsUrl(preferKeyword.id),
      },
    ];
  },
};
