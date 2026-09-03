export { inspect } from "./inspector.js";
export { walk } from "./walker.js";
export { defaultRules } from "./rules/index.js";
export {
  preferKeyword,
  unknownField,
  invalidDateHistogram,
  termsSizeZero,
  metricSubAggregation,
  unknownAggregationType,
  largeTermsSize,
  createLargeTermsSize,
  missingShardSize,
} from "./rules/index.js";
export { DEFAULT_LARGE_TERMS_THRESHOLD } from "./rules/largeTermsSize.js";
export type { LargeTermsSizeOptions } from "./rules/largeTermsSize.js";

export { resolveField, hasKeywordForm } from "./mapping.js";
export {
  KNOWN_AGG_TYPES,
  METRIC_AGG_TYPES,
  BUCKET_AGG_TYPES,
  PIPELINE_AGG_TYPES,
} from "./aggTypes.js";
export { DOCS_BASE, docsUrl } from "./docs.js";
export { parseJsonWithLocs } from "./locate.js";
export type { ParseResult } from "./locate.js";

export type {
  Rule,
  RuleState,
  Issue,
  Loc,
  Severity,
  RuleContext,
  Mapping,
  MappingField,
  AggregationNode,
  TermsAggBody,
  MetricAggBody,
  DateHistogramAggBody,
  NestedAggBody,
  RuleSeverityOverride,
} from "./types.js";
export type { InspectOptions, InspectReport } from "./inspector.js";
export type { WalkResult } from "./walker.js";
