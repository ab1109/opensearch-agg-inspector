/**
 * Known OpenSearch / Elasticsearch aggregation type keys.
 * Used to catch typos (`term` instead of `terms`) and to tell metric
 * aggregations (which cannot have sub-aggregations) from bucket ones.
 *
 * Not exhaustive across every plugin, but covers core + common X-Pack/OpenSearch
 * aggregations. Keys that appear inside an aggregation node but aren't structural
 * (`aggs`, `aggregations`, `meta`) are handled by the caller.
 */

/** Metric aggregations — they produce a value, not buckets, and take no sub-aggs. */
export const METRIC_AGG_TYPES = new Set<string>([
  "avg",
  "boxplot",
  "cardinality",
  "extended_stats",
  "geo_bounds",
  "geo_centroid",
  "geo_line",
  "matrix_stats",
  "max",
  "median_absolute_deviation",
  "min",
  "percentile_ranks",
  "percentiles",
  "rate",
  "scripted_metric",
  "stats",
  "string_stats",
  "sum",
  "t_test",
  "top_hits",
  "top_metrics",
  "value_count",
  "weighted_avg",
]);

/** Bucket aggregations — they partition documents and may hold sub-aggregations. */
export const BUCKET_AGG_TYPES = new Set<string>([
  "adjacency_matrix",
  "auto_date_histogram",
  "categorize_text",
  "children",
  "composite",
  "date_histogram",
  "date_range",
  "diversified_sampler",
  "filter",
  "filters",
  "frequent_item_sets",
  "geo_distance",
  "geohash_grid",
  "geohex_grid",
  "geotile_grid",
  "global",
  "histogram",
  "ip_prefix",
  "ip_range",
  "missing",
  "multi_terms",
  "nested",
  "parent",
  "random_sampler",
  "range",
  "rare_terms",
  "reverse_nested",
  "sampler",
  "significant_terms",
  "significant_text",
  "terms",
  "time_series",
  "variable_width_histogram",
]);

/** Pipeline aggregations — they run over the output of sibling aggregations. */
export const PIPELINE_AGG_TYPES = new Set<string>([
  "avg_bucket",
  "bucket_script",
  "bucket_selector",
  "bucket_sort",
  "bucket_count_ks_test",
  "bucket_correlation",
  "cumulative_cardinality",
  "cumulative_sum",
  "derivative",
  "extended_stats_bucket",
  "inference",
  "max_bucket",
  "min_bucket",
  "moving_avg",
  "moving_fn",
  "moving_percentiles",
  "normalize",
  "percentiles_bucket",
  "serial_diff",
  "stats_bucket",
  "sum_bucket",
]);

export const KNOWN_AGG_TYPES = new Set<string>([
  ...METRIC_AGG_TYPES,
  ...BUCKET_AGG_TYPES,
  ...PIPELINE_AGG_TYPES,
]);

/** Node keys that are structural rather than an aggregation type. */
export const STRUCTURAL_KEYS = new Set<string>(["aggs", "aggregations", "meta"]);

/** Returns the aggregation-type keys present on a node (excludes structural keys). */
export function aggTypeKeys(node: Record<string, unknown>): string[] {
  return Object.keys(node).filter((k) => !STRUCTURAL_KEYS.has(k));
}
