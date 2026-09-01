import type { MappingField, Mapping } from "./types.js";

/**
 * Resolves a possibly-dotted field name against a mapping.
 *
 * Handles the two ways OpenSearch/Elasticsearch nests fields:
 *   - `properties` — sub-fields of an `object` / `nested` field
 *   - `fields`     — multi-fields, e.g. `title.keyword`
 *
 * @example
 * resolveField({ title: { type: "text", fields: { keyword: { type: "keyword" } } } }, "title.keyword")
 * // => { type: "keyword" }
 *
 * @returns the matching {@link MappingField}, or `undefined` if the path
 *   cannot be resolved.
 */
export function resolveField(
  mapping: Mapping,
  fieldPath: string
): MappingField | undefined {
  const parts = fieldPath.split(".");
  let current: Record<string, MappingField> | undefined = mapping;
  let result: MappingField | undefined;

  for (const part of parts) {
    if (!current || !current[part]) return undefined;
    result = current[part];
    // Descend through either object sub-properties or multi-fields.
    current = result.properties ?? result.fields;
  }

  return result;
}

/**
 * True if `field` resolves to a `keyword` field, either directly or via a
 * `.keyword` (or other) keyword multi-field.
 */
export function hasKeywordForm(
  mapping: Mapping,
  field: string
): { keywordField: string } | undefined {
  const def = resolveField(mapping, field);
  if (!def) return undefined;
  if (def.type === "keyword") return { keywordField: field };

  const sub = Object.entries(def.fields ?? {}).find(([, f]) => f.type === "keyword");
  if (sub) return { keywordField: `${field}.${sub[0]}` };

  return undefined;
}
