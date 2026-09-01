import { describe, it, expect } from "vitest";
import { inspect } from "../src/index.js";
import type { AggregationNode, Mapping } from "../src/index.js";

const mapping: Mapping = {
  country: { type: "text", fields: { keyword: { type: "keyword" } } },
  status: { type: "keyword" },
  created_at: { type: "date" },
  user: { properties: { name: { type: "text" } } },
};

describe("inspect", () => {
  it("reports no issues for a clean query and lists passed rules", () => {
    const report = inspect(
      { aggs: { by_status: { terms: { field: "status" } } } },
      mapping
    );
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
    expect(report.aggCount).toBe(1);
    expect(report.passedRules).toContain("prefer-keyword");
    expect(report.summary).toBe("No issues found across 1 aggregation");
  });

  it("counts nested aggregations", () => {
    const report = inspect(
      {
        aggs: {
          by_status: {
            terms: { field: "status" },
            aggs: {
              over_time: {
                date_histogram: { field: "created_at", calendar_interval: "1d" },
              },
            },
          },
        },
      },
      mapping
    );
    expect(report.aggCount).toBe(2);
  });

  it("applies rule severity overrides and 'off'", () => {
    const query: AggregationNode = {
      aggs: { by_country: { terms: { field: "country" } } },
    };
    expect(inspect(query, mapping).errorCount).toBe(1);

    const downgraded = inspect(query, mapping, {
      ruleOverrides: { "prefer-keyword": "warning" },
    });
    expect(downgraded.errorCount).toBe(0);
    expect(downgraded.warningCount).toBe(1);

    const silenced = inspect(query, mapping, {
      ruleOverrides: { "prefer-keyword": "off" },
    });
    expect(silenced.issues).toHaveLength(0);
    expect(silenced.passedRules).not.toContain("prefer-keyword");
  });

  it("handles a query with no aggregations", () => {
    const report = inspect({});
    expect(report.aggCount).toBe(0);
    expect(report.issues).toHaveLength(0);
    expect(report.summary).toBe("No issues found across 0 aggregations");
  });

  it("throws a clear error on a non-object query", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => inspect(null)).toThrow(TypeError);
    // @ts-expect-error
    expect(() => inspect("nope")).toThrow(/expects a query object/);
  });
});

describe("prefer-keyword", () => {
  it("flags a terms aggregation on a text field and points at the keyword sub-field", () => {
    const report = inspect(
      { aggs: { by_country: { terms: { field: "country" } } } },
      mapping
    );
    const issue = report.issues.find((i) => i.rule === "prefer-keyword");
    expect(issue).toMatchObject({
      severity: "error",
      path: "aggs.by_country",
      fixable: true,
    });
    expect(issue?.message).toContain("country.keyword");
  });

  it("does not fire when the query already targets the keyword sub-field", () => {
    const report = inspect(
      { aggs: { by_country: { terms: { field: "country.keyword" } } } },
      mapping
    );
    expect(report.issues.filter((i) => i.rule === "prefer-keyword")).toHaveLength(0);
    // ...and unknown-field must not treat the multi-field as missing
    expect(report.issues.filter((i) => i.rule === "unknown-field")).toHaveLength(0);
  });
});

describe("unknown-field", () => {
  it("resolves object sub-fields via properties", () => {
    const report = inspect(
      { aggs: { names: { terms: { field: "user.name.keyword" } } } },
      {
        user: {
          properties: {
            name: { type: "text", fields: { keyword: { type: "keyword" } } },
          },
        },
      }
    );
    expect(report.issues.filter((i) => i.rule === "unknown-field")).toHaveLength(0);
  });

  it("ignores scripted fields", () => {
    const report = inspect(
      { aggs: { x: { terms: { script: "doc['a'].value" } } } },
      mapping
    );
    expect(report.issues.filter((i) => i.rule === "unknown-field")).toHaveLength(0);
  });
});

describe("terms-size-zero", () => {
  it("flags size: 0", () => {
    const report = inspect({ aggs: { t: { terms: { field: "status", size: 0 } } } });
    expect(report.issues.find((i) => i.rule === "terms-size-zero")).toMatchObject({
      severity: "error",
    });
  });
});

describe("metric-sub-aggregation", () => {
  it("flags a metric aggregation that has children", () => {
    const report = inspect({
      aggs: {
        avg_price: {
          avg: { field: "price" },
          aggs: { nope: { terms: { field: "status" } } },
        },
      },
    });
    expect(report.issues.find((i) => i.rule === "metric-sub-aggregation")).toMatchObject({
      severity: "error",
      path: "aggs.avg_price",
    });
  });

  it("does not flag a bucket aggregation with children", () => {
    const report = inspect({
      aggs: {
        by_status: {
          terms: { field: "status" },
          aggs: { avg_price: { avg: { field: "price" } } },
        },
      },
    });
    expect(report.issues.filter((i) => i.rule === "metric-sub-aggregation")).toHaveLength(
      0
    );
  });
});

describe("unknown-aggregation-type", () => {
  it("flags a typo'd aggregation type", () => {
    const report = inspect({ aggs: { x: { term: { field: "status" } } } });
    expect(
      report.issues.find((i) => i.rule === "unknown-aggregation-type")
    ).toMatchObject({
      severity: "warning",
    });
  });

  it("ignores a purely structural nesting node", () => {
    const report = inspect({
      aggs: { g: { global: {}, aggs: { by_status: { terms: { field: "status" } } } } },
    });
    expect(
      report.issues.filter((i) => i.rule === "unknown-aggregation-type")
    ).toHaveLength(0);
  });
});
