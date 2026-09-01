/**
 * A single mapping field definition, e.g. { type: "text" } or { type: "keyword" }.
 * Kept intentionally loose — real OpenSearch mappings have many more properties,
 * but rules generally only care about `type` and `fields` (multi-fields).
 */
export interface MappingField {
  type?: string;
  fields?: Record<string, MappingField>;
  properties?: Record<string, MappingField>;
}

export type Mapping = Record<string, MappingField>;

// ---------------------------------------------------------------------------
// Narrowed aggregation node shapes — rules use these instead of `any`
// ---------------------------------------------------------------------------

export interface TermsAggBody {
  field?: string;
  size?: number;
  shard_size?: number;
  script?: unknown;
  execution_hint?: string;
}

export interface MetricAggBody {
  field?: string;
  script?: unknown;
}

export interface DateHistogramAggBody {
  field?: string;
  calendar_interval?: string;
  fixed_interval?: string;
  interval?: string; // deprecated pre-7.x form — still seen in the wild
}

export interface NestedAggBody {
  path?: string;
}

/**
 * A single named aggregation node.
 *
 * Known aggregation shapes are typed so rules can discriminate on the key
 * present; the index signature allows any other aggregation type (there are
 * ~70 across OpenSearch, Elasticsearch, and plugins) without losing that.
 */
export interface AggregationNode {
  terms?: TermsAggBody;
  avg?: MetricAggBody;
  sum?: MetricAggBody;
  min?: MetricAggBody;
  max?: MetricAggBody;
  value_count?: MetricAggBody;
  cardinality?: MetricAggBody;
  date_histogram?: DateHistogramAggBody;
  nested?: NestedAggBody;
  reverse_nested?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  histogram?: Record<string, unknown>;
  range?: Record<string, unknown>;
  aggs?: Record<string, AggregationNode>;
  aggregations?: Record<string, AggregationNode>;
  /** Any other aggregation type, plus `meta` and vendor extensions. */
  [key: string]: unknown;
}

export type Severity = "error" | "warning" | "info";

export interface Issue {
  /** Rule id that produced this issue, e.g. "prefer-keyword" */
  rule: string;
  severity: Severity;
  message: string;
  /** Dot path to the offending aggregation, e.g. "aggs.by_country" */
  path: string;
  /** Short human-readable suggestion, e.g. 'Change field to "country.keyword"' */
  suggestion?: string;
  /** True if the issue can be auto-fixed (reserved for future tooling). */
  fixable?: boolean;
  /** Link to the rule's documentation page. */
  docsUrl?: string;
}

/**
 * A per-run key/value bag shared across every rule and every node of a single
 * `inspect()` call. Created fresh for each run, so rules can stash state here
 * without holding it on the (module-singleton) rule object — which would leak
 * between runs. Namespace your keys with the rule id, e.g.
 * `state.set("my-rule:seen", ...)`.
 */
export type RuleState = Map<string, unknown>;

/** Everything a rule needs to evaluate a single aggregation node. */
export interface RuleContext {
  /** The aggregation node currently being visited */
  node: AggregationNode;
  /** Dot path to this node within the original query */
  path: string;
  /** The full mapping, if the caller supplied one */
  mapping?: Mapping;
  /** The full original query, for rules that need broader context */
  query: AggregationNode;
  /** Per-run shared state (see {@link RuleState}). */
  state: RuleState;
}

export interface Rule {
  id: string;
  description: string;
  /**
   * Optional: called once before the walker starts, for rules that need to
   * scan the whole query up front (e.g. to compare a node against its
   * siblings). Write accumulated state into `state`, never onto `this` — the
   * rule object is a shared singleton and would leak between runs.
   */
  beforeWalk?(
    query: AggregationNode,
    mapping: Mapping | undefined,
    state: RuleState
  ): void;
  check(context: RuleContext): Issue[];
}

/** Per-rule severity override: "error" | "warning" | "info" | "off" */
export type RuleSeverityOverride = Severity | "off";
