import { preferKeyword } from "./preferKeyword.js";
import { unknownField } from "./unknownField.js";
import { invalidDateHistogram } from "./invalidDateHistogram.js";
import { termsSizeZero } from "./termsSizeZero.js";
import { metricSubAggregation } from "./metricSubAggregation.js";
import { unknownAggregationType } from "./unknownAggregationType.js";
import { largeTermsSize, createLargeTermsSize } from "./largeTermsSize.js";
import { missingShardSize } from "./missingShardSize.js";
import type { Rule } from "../types.js";

/**
 * The default rule set, in the order issues are reported.
 *
 * Adding a rule: create `src/rules/<yourRule>.ts`, import it here, and append
 * it to the array. The walker and inspector never need to change.
 */
export const defaultRules: readonly Rule[] = [
  // Correctness
  unknownAggregationType,
  preferKeyword,
  unknownField,
  invalidDateHistogram,
  termsSizeZero,
  metricSubAggregation,
  // Performance / best-practice
  largeTermsSize,
  missingShardSize,
];

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
};
