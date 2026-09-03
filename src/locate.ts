import type { Loc } from "./types.js";

export interface ParseResult {
  /** The parsed value (equivalent to `JSON.parse(text)`). */
  value: unknown;
  /**
   * Maps an aggregation dot-path to the location of its key token, using the
   * same path convention as the walker: the root `aggs` / `aggregations` key
   * becomes `"aggs"`, and any nested `aggs` / `aggregations` container key is
   * transparent (e.g. `aggs.total_revenue.by_status`, not
   * `aggs.total_revenue.aggs.by_status`).
   */
  locs: Map<string, Loc>;
}

const WS = new Set([" ", "\t", "\n", "\r"]);

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

/**
 * A minimal, dependency-free JSON parser that records the source location of
 * every object key. Used so `inspect()` can attach `loc` to each issue when it
 * is handed the raw JSON string.
 *
 * Accepts standard JSON only (no comments, no trailing commas).
 */
export function parseJsonWithLocs(text: string): ParseResult {
  let i = 0;
  let line = 1;
  let col = 1;
  const locs = new Map<string, Loc>();

  const here = (): Loc => ({ line, column: col, offset: i });

  function advance(n = 1): void {
    for (let k = 0; k < n && i < text.length; k++) {
      if (text[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  }

  function fail(msg: string): never {
    throw new SyntaxError(`${msg} (line ${line}, column ${col})`);
  }

  function skipWs(): void {
    while (i < text.length && WS.has(text[i] as string)) advance();
  }

  function parseValue(path: string): unknown {
    skipWs();
    const ch = text[i];
    if (ch === "{") return parseObject(path);
    if (ch === "[") return parseArray(path);
    if (ch === '"') return parseString();
    if (ch === "-" || isDigit(ch)) return parseNumber();
    if (text.startsWith("true", i)) return (advance(4), true);
    if (text.startsWith("false", i)) return (advance(5), false);
    if (text.startsWith("null", i)) return (advance(4), null);
    fail("Unexpected token");
  }

  function parseObject(path: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    advance(); // {
    skipWs();
    if (text[i] === "}") return (advance(), obj);

    for (;;) {
      skipWs();
      if (text[i] !== '"') fail("Expected a string key");
      const keyLoc = here();
      const key = parseString();
      skipWs();
      if (text[i] !== ":") fail('Expected ":"');
      advance();

      const isAggsContainer = key === "aggs" || key === "aggregations";
      let childPath: string;
      if (isAggsContainer) {
        childPath = path === "" ? "aggs" : path; // root: base path; nested: transparent
        if (path === "") locs.set("aggs", keyLoc);
      } else {
        childPath = path === "" ? key : `${path}.${key}`;
        locs.set(childPath, keyLoc);
      }

      obj[key] = parseValue(childPath);

      skipWs();
      if (text[i] === ",") {
        advance();
        continue;
      }
      if (text[i] === "}") {
        advance();
        break;
      }
      fail('Expected "," or "}"');
    }
    return obj;
  }

  function parseArray(path: string): unknown[] {
    const arr: unknown[] = [];
    advance(); // [
    skipWs();
    if (text[i] === "]") return (advance(), arr);

    for (let idx = 0; ; idx++) {
      arr.push(parseValue(path === "" ? String(idx) : `${path}.${idx}`));
      skipWs();
      if (text[i] === ",") {
        advance();
        continue;
      }
      if (text[i] === "]") {
        advance();
        break;
      }
      fail('Expected "," or "]"');
    }
    return arr;
  }

  function parseString(): string {
    advance(); // opening quote
    let s = "";
    while (i < text.length) {
      const ch = text[i] as string;
      if (ch === '"') return (advance(), s);
      if (ch === "\\") {
        advance();
        const esc = text[i];
        if (esc === "n") s += "\n";
        else if (esc === "t") s += "\t";
        else if (esc === "r") s += "\r";
        else if (esc === "b") s += "\b";
        else if (esc === "f") s += "\f";
        else if (esc === "/") s += "/";
        else if (esc === '"') s += '"';
        else if (esc === "\\") s += "\\";
        else if (esc === "u") {
          const hex = text.slice(i + 1, i + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("Invalid \\u escape");
          s += String.fromCharCode(parseInt(hex, 16));
          advance(4);
        } else fail("Invalid escape sequence");
        advance();
      } else {
        s += ch;
        advance();
      }
    }
    fail("Unterminated string");
  }

  function parseNumber(): number {
    const start = i;
    if (text[i] === "-") advance();
    while (isDigit(text[i])) advance();
    if (text[i] === ".") {
      advance();
      while (isDigit(text[i])) advance();
    }
    if (text[i] === "e" || text[i] === "E") {
      advance();
      if (text[i] === "+" || text[i] === "-") advance();
      while (isDigit(text[i])) advance();
    }
    return Number(text.slice(start, i));
  }

  skipWs();
  const value = parseValue("");
  skipWs();
  if (i < text.length) fail("Unexpected trailing content");
  return { value, locs };
}
