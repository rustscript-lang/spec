// RustScript Unit / Option / Result specification contract test.
//
// Dependency-free: only Node built-ins, run with the built-in test runner.
//
//   node --test tests/option-result-contract.test.mjs
//
// The fixture-execution test needs a built pd-vm-run:
//
//   RUSTSCRIPT_CORE_BIN=/path/to/pd-vm-run node --test tests/option-result-contract.test.mjs
//
// Without RUSTSCRIPT_CORE_BIN that test fails with an explicit error. It is
// deliberately not a skip: a skipped execution check reports success while
// having run nothing.
//
// Static checks only (no binary available):
//
//   node --test --test-skip-pattern='executes the fixture' tests/option-result-contract.test.mjs
//
// `--test-skip-pattern` is the flag that filters under current Node releases;
// `--test-name-pattern` no longer implies "run everything else", so README.md
// and .github/workflows/ci.yml use the skip pattern too.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const grammarPath = join(repoRoot, "syntaxes", "rustscript.tmLanguage.json");
const lexicalPath = join(repoRoot, "language", "lexical.md");
const fixturePath = join(repoRoot, "tests", "fixtures", "option-result.rss");

const docPaths = [
  "README.md",
  "language/lexical.md",
  "language/syntax.md",
  "language/grammar.md",
  "runtime/host-functions.md",
  "runtime/debugger.md",
  "formats/bytecode.md",
  "formats/aot.md",
].map((relative) => join(repoRoot, relative));

function readDoc(path) {
  const text = readFileSync(path, "utf8");
  assert.ok(text.trim().length > 0, `${path} is empty`);
  return text;
}

/** Returns every fenced code block body in a Markdown document. */
function fencedBlocks(markdown) {
  const blocks = [];
  let open = null;
  for (const line of markdown.split("\n")) {
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (open === null) {
        open = { marker: fence[1], lines: [] };
        continue;
      }
      if (line.trim().startsWith(open.marker)) {
        blocks.push(open.lines.join("\n"));
        open = null;
        continue;
      }
    }
    if (open !== null) open.lines.push(line);
  }
  assert.equal(open, null, "unterminated code fence in Markdown");
  return blocks;
}

/** Keywords listed by language/lexical.md under its "## Keywords" heading. */
function lexicalKeywords() {
  const markdown = readDoc(lexicalPath);
  const section = markdown.split(/^## Keywords$/m)[1];
  assert.ok(section, "language/lexical.md has no '## Keywords' section");
  const block = fencedBlocks(section)[0];
  assert.ok(block, "language/lexical.md has no fenced keyword list");
  return block.trim().split(/\s+/).sort();
}

/**
 * Identifiers that language/lexical.md documents as context-sensitive rather
 * than as lexer keywords. The TextMate grammar highlights these too, so the
 * consistency check compares the grammar against keywords plus this set.
 */
function contextSensitiveIdentifiers(keywords) {
  const markdown = readDoc(lexicalPath);
  const names = new Set();
  for (const line of markdown.split("\n")) {
    if (!/context-sensitive/.test(line)) continue;
    for (const match of line.matchAll(/`([a-z_][a-z0-9_]*)`/g)) {
      if (!keywords.includes(match[1])) names.add(match[1]);
    }
  }
  return [...names].sort();
}

/** Words highlighted as language keywords by the TextMate grammar. */
function textmateKeywords(grammar) {
  const repository = grammar.repository ?? {};
  const words = new Set();
  const strip = (pattern) =>
    pattern
      .replace(/\\b/g, " ")
      .replace(/\(\?:/g, " ")
      .replace(/[()|?]/g, " ")
      .split(/[^A-Za-z]+/)
      .filter(Boolean);
  const collect = (node) => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object") return;
    if (typeof node.match === "string") strip(node.match).forEach((word) => words.add(word));
    for (const value of Object.values(node)) collect(value);
  };
  collect(repository.keywords);
  collect(repository.booleans);
  return [...words].sort();
}

function allRegexSources(node, out = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => allRegexSources(item, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  for (const key of ["match", "begin", "end"]) {
    if (typeof node[key] === "string") out.push({ key, source: node[key] });
  }
  for (const value of Object.values(node)) allRegexSources(value, out);
  return out;
}

test("the TextMate grammar is valid JSON with nested repository includes", () => {
  const grammar = JSON.parse(readDoc(grammarPath));
  assert.equal(grammar.scopeName, "source.rss");
  assert.deepEqual(grammar.fileTypes, ["rss"]);
  assert.ok(Array.isArray(grammar.patterns) && grammar.patterns.length > 0);
  assert.equal(typeof grammar.repository, "object");

  const includeTarget = (value) => {
    const match = /^#(.+)$/.exec(value);
    if (!match) return null;
    return match[1];
  };
  const missing = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (typeof node.include === "string") {
      const key = includeTarget(node.include);
      if (key && !(key in grammar.repository)) missing.push(node.include);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(grammar.patterns);
  for (const rule of Object.values(grammar.repository)) walk(rule);
  assert.deepEqual(missing, [], "dangling #include targets");
});

test("null is not highlighted and is not part of the keyword list", () => {
  const grammar = JSON.parse(readDoc(grammarPath));
  assert.equal(
    "null-literal" in grammar.repository,
    false,
    "the grammar still has a null-literal rule",
  );
  const offending = allRegexSources(grammar.repository).filter((entry) =>
    /\bnull\b/.test(entry.source),
  );
  assert.deepEqual(offending, [], "a grammar regex still matches the word null");

  const keywords = lexicalKeywords();
  assert.ok(
    !keywords.includes("null"),
    "language/lexical.md still lists null as a keyword",
  );
  assert.ok(keywords.includes("true") && keywords.includes("false"));
});

test("the TextMate keyword rules match the lexical keyword list", () => {
  const grammar = JSON.parse(readDoc(grammarPath));
  const documented = lexicalKeywords();
  const expected = [...documented, ...contextSensitiveIdentifiers(documented)].sort();
  const highlighted = textmateKeywords(grammar);
  assert.ok(highlighted.length > 0, "no keyword rules found in the grammar");
  assert.deepEqual(
    highlighted,
    expected,
    "TextMate keyword highlighting and language/lexical.md are out of sync",
  );
});

test("the grammar highlights Unit, Option/Result constructors, ? and ?.", () => {
  const grammar = JSON.parse(readDoc(grammarPath));
  const repository = grammar.repository;
  for (const key of [
    "unit-literal",
    "option-result-constructor",
    "propagation-operator",
    "optional-access-operator",
  ]) {
    assert.ok(key in repository, `grammar is missing the #${key} rule`);
  }
  assert.match(repository["unit-literal"].match, /\\\(\\\)/, "unit rule must match ()");
  assert.match(repository["option-result-constructor"].match, /Option/);
  assert.match(repository["option-result-constructor"].match, /Result/);
  assert.match(repository["propagation-operator"].match, /\\\?/);
  assert.match(repository["optional-access-operator"].match, /\\\?\\\./);

  // The constructor rule must pair each namespace with its own variants:
  // `Option::Ok` and `Result::Some` do not exist and must stay unhighlighted.
  const constructor = new RegExp(repository["option-result-constructor"].match);
  for (const source of [
    "Option::Some(1)",
    "Option::None",
    "Result::Ok(1)",
    "Result::Err(2)",
    "Option :: None",
  ]) {
    assert.ok(constructor.test(source), `constructor rule does not highlight ${source}`);
  }
  for (const source of ["Option::Ok(1)", "Result::Some(1)", "Option::Err(2)", "Result::None"]) {
    assert.equal(
      constructor.test(source),
      false,
      `constructor rule highlights the non-existent ${source}`,
    );
  }
  assert.deepEqual(
    constructor.exec("Option::Some(1)")?.slice(1),
    ["Option", "", "::", "", "Some"],
    "constructor captures are 1=namespace, 3=::, 5=variant",
  );

  const includes = (grammar.patterns ?? []).map((pattern) => pattern.include);
  for (const key of [
    "#unit-literal",
    "#option-result-constructor",
    "#propagation-operator",
    "#optional-access-operator",
  ]) {
    assert.ok(includes.includes(key), `grammar patterns do not include ${key}`);
  }
});

test("documentation never presents null as a literal or T? as a type", () => {
  const violations = [];
  for (const path of docPaths) {
    const markdown = readDoc(path);
    for (const block of fencedBlocks(markdown)) {
      for (const line of block.split("\n")) {
        const where = `${path.replace(repoRoot + "/", "")}: ${line.trim()}`;
        if (/^\s*null\s*$/.test(line)) violations.push(`bare null literal -> ${where}`);
        if (/\bnull\s*:/.test(line)) violations.push(`null map key -> ${where}`);
        if (/=>\s*null\b/.test(line) || /\bnull\s*=>/.test(line)) {
          violations.push(`null in a match arm -> ${where}`);
        }
        // `->`, `:` or `=` followed by a type that ends in the legacy `T?` suffix.
        if (/(?:->|:)\s*[A-Za-z_][A-Za-z0-9_<>, \[\]]*\?/.test(line)) {
          violations.push(`legacy optional type suffix -> ${where}`);
        }
        if (/\b(?:Type|T)\?/.test(line)) {
          violations.push(`legacy T? type -> ${where}`);
        }
        if (/\bOptionalSuffix\b/.test(line)) {
          violations.push(`legacy optional suffix production -> ${where}`);
        }
      }
    }
  }
  assert.deepEqual(violations, [], "documentation still teaches null or T?");
});

test("documentation describes the current Unit/Option/Result contract", () => {
  const read = (relative) => readDoc(join(repoRoot, relative));
  const checks = [
    ["language/lexical.md", /`null` is neither a keyword nor a literal/],
    ["language/syntax.md", /Option::Some\(0\)/],
    ["language/syntax.md", /Option::None/],
    ["language/syntax.md", /Result::Ok\(21\)/],
    ["language/syntax.md", /Result::Err\("bad input"\)/],
    ["language/grammar.md", /OptionType ::= "Option" "<" Type ">"/],
    ["language/grammar.md", /ResultType ::= "Result" "<" Type "," Type ">"/],
    ["runtime/host-functions.md", /GuestOption<T>/],
    ["runtime/host-functions.md", /GuestResult<T, E>/],
    ["runtime/host-functions.md", /fatal transport channel/],
    ["runtime/host-functions.md", /json::decode::<T>\(text\)/],
    ["formats/bytecode.md", /VMBC v14/],
    ["formats/bytecode.md", /tag `15`/],
    ["formats/bytecode.md", /tag `20`/],
    ["README.md", /no `null` literal and no `T\?` optional type/],
  ];
  for (const [file, pattern] of checks) {
    assert.match(read(file), pattern, `${file} does not document ${pattern}`);
  }
  const bytecode = read("formats/bytecode.md");
  assert.ok(!/\bnull for procedures\b/.test(bytecode), "bytecode.md keeps the null-procedure text");
  assert.ok(
    !/missing payload is not a unit value/.test(bytecode),
    "bytecode.md still states the unmatchable 'missing payload is not a unit value' rule",
  );
  assert.match(
    bytecode,
    /a Null value is Unit only where the declared schema is `\(\)`/,
    "bytecode.md does not scope Unit to the `()` schema",
  );
  const host = read("runtime/host-functions.md");
  assert.ok(
    !/Procedures should return null/.test(host),
    "host-functions.md keeps the null-procedure text",
  );
  assert.ok(
    !/omitted logical `Option` argument/.test(host),
    "host-functions.md still claims a host argument may be omitted and normalized to None",
  );
  assert.match(
    host,
    /A trailing `Option<T>` parameter may be omitted/,
    "host-functions.md does not document the omittable Rust `Option<T>` parameter",
  );
  assert.match(
    host,
    /A `GuestOption<T>` or `GuestResult<T, E>` parameter may not be omitted/,
    "host-functions.md does not document that guest `Option`/`Result` arguments are required",
  );
  assert.match(
    host,
    /`missing \{wrapper_ident\} \{param\}`/,
    "host-functions.md does not name the wrapper-generated missing-argument error",
  );
  assert.match(
    host,
    /`missing argument: \{wrapper_ident\} \{param\}`/,
    "host-functions.md does not name the wrapper-label missing-argument error for other parameter types",
  );
  assert.ok(
    !/missing json::decode/.test(host),
    "host-functions.md uses a guest path as the missing-argument wrapper label",
  );
  assert.ok(
    !/missing argument: <label>/.test(host),
    "host-functions.md keeps the stale `missing argument: <label>` error text",
  );
  assert.ok(
    !/No argument is ever omitted/.test(host),
    "host-functions.md keeps the blanket no-omission claim instead of the layered rule",
  );

  const syntax = read("language/syntax.md");
  const grammar = read("language/grammar.md");

  // `Option::X(...)`/`Result::X(...)` bind; they are not type patterns.
  assert.ok(
    !/Option::Some\(TypeName\)/.test(syntax),
    "syntax.md still lists Option::Some(TypeName) as a type pattern",
  );
  assert.ok(
    !/Result::(?:Ok|Err)\(TypeName\)/.test(syntax),
    "syntax.md still lists Result::Ok(TypeName) as a type pattern",
  );
  assert.match(syntax, /always a binding name/, "syntax.md does not state the constructor binding rule");
  assert.match(syntax, /Option::Some\(int\)/, "syntax.md does not show a type-shaped binding name");
  assert.match(
    syntax,
    /Some\(\.\.\.\) and None match patterns require an optional value/,
    "syntax.md does not document the legacy optional-slot rejection",
  );
  assert.ok(
    !/falls back to value matching/.test(syntax),
    "syntax.md still claims bare constructor names fall back to value matching",
  );
  assert.match(
    syntax,
    /bare `Ok\(value\)` or `Err\(value\)` arm is a parse error/,
    "syntax.md does not document that bare Ok/Err arms are parse errors",
  );
  assert.ok(
    !/simply false for an `Option` carrier/.test(syntax),
    "syntax.md still claims every `Some(TypeName)` is false for an `Option` carrier",
  );
  assert.match(
    syntax,
    /`Some\(map\)` and `Some\(Map\)` do match an `Option` carrier/,
    "syntax.md does not document that `Some(map)` matches an `Option` carrier",
  );
  assert.match(
    syntax,
    /Result match cannot mix constructor arms with value patterns/,
    "syntax.md does not document the separate Result mixing error",
  );

  // The `?.` receiver rule covers declared arrays and strings.
  assert.match(syntax, /data\?\.arr\?\.\[1\]/, "syntax.md does not show array projection");
  assert.match(syntax, /text\?\.\[9\]/, "syntax.md does not show string projection");
  assert.ok(
    !/a struct type or a declared `map<T>`\./.test(syntax),
    "syntax.md still narrows `?.` receivers to struct and map<T>",
  );
  assert.ok(
    !/work on every declared receiver shape/.test(syntax),
    "syntax.md still claims both `?.` forms work on every declared receiver",
  );
  assert.match(
    syntax,
    /a `bytes` receiver lowers to `Option::None`/,
    "syntax.md does not state the `bytes` projection boundary",
  );

  // Grammar: one binding production, one legacy production, no dangling rule.
  assert.match(grammar, /MatchBinding ::= Identifier \| "_"/, "grammar.md has no MatchBinding production");
  assert.match(grammar, /LegacyOptionalPattern ::=/, "grammar.md has no legacy pattern production");
  assert.ok(
    !/"Option" "::" "Some" "\(" MatchTypeName/.test(grammar),
    "grammar.md still offers a type-name alternative for Option::Some",
  );
  assert.ok(
    !/"Result" "::" "(?:Ok|Err)" "\(" MatchTypeName/.test(grammar),
    "grammar.md still offers a type-name alternative for Result::Ok/Err",
  );
  assert.match(grammar, /OptionNone ::= "Option" "::" "None"/, "grammar.md does not define OptionNone");
  const primary = grammar.split(/^PrimaryExpr ::=/m)[1]?.split(/^$/m)[0] ?? "";
  assert.match(primary, /\| OptionNone/, "PrimaryExpr does not admit OptionNone");

  // The debugger note must not claim Unit and None share a carrier.
  const debuggerDoc = read("runtime/debugger.md");
  assert.ok(
    !/Unit and `Option::None` share/.test(debuggerDoc),
    "debugger.md still claims Unit and Option::None share the Null carrier",
  );
  assert.match(
    debuggerDoc,
    /`Option::None` is a Map that carries only a Boolean `tag` of `false`/,
    "debugger.md does not describe the tag-only None carrier",
  );
});

test("the fixture exists and uses Unit, Option, Result, ? and ?.", () => {
  assert.ok(existsSync(fixturePath), `missing fixture ${fixturePath}`);
  const source = readDoc(fixturePath);
  assert.match(source, /Option::Some\(/);
  assert.match(source, /Option::None/);
  assert.match(source, /Result::Ok\(/);
  assert.match(source, /Result::Err\(/);
  assert.match(source, /let unit: \(\) = \(\);/, "fixture does not declare a Unit value");
  assert.match(source, /\nfn nothing\(\) \{ \}/, "fixture has no implicit-Unit function");
  assert.match(source, /\)\?\s*;/, "fixture does not propagate a Result with ?");
  assert.match(source, /=\s*\w+\?\s*;/, "fixture does not propagate an Option with ?");
  assert.match(source, /\?\.\w+/, "fixture has no ?. field projection");
  assert.match(source, /\?\.\[/, "fixture has no ?.[key] projection");
});

test("the VM executes the fixture and prints the named contract lines", () => {
  const bin = process.env.RUSTSCRIPT_CORE_BIN?.trim();
  assert.ok(
    bin,
    [
      "RUSTSCRIPT_CORE_BIN is not set, so the Unit/Option/Result fixture was not executed.",
      "This check fails instead of skipping: an unexecuted fixture proves nothing.",
      "Build the binary and re-run:",
      "  cargo build --bin pd-vm-run",
      "  RUSTSCRIPT_CORE_BIN=/path/to/pd-vm-run node --test tests/option-result-contract.test.mjs",
    ].join("\n"),
  );
  assert.ok(existsSync(bin), `RUSTSCRIPT_CORE_BIN does not exist: ${bin}`);
  const mode = statSync(bin).mode;
  assert.ok((mode & 0o111) !== 0, `RUSTSCRIPT_CORE_BIN is not executable: ${bin}`);

  let version;
  try {
    version = execFileSync(bin, ["--version"], { encoding: "utf8" }).trim();
  } catch (error) {
    assert.fail(`failed to run ${bin} --version: ${error.message}`);
  }
  assert.match(version, /^pd-vm-run\b/, `unexpected binary: ${version}`);

  const result = spawnSync(bin, [fixturePath], { encoding: "utf8" });
  assert.equal(
    result.error,
    undefined,
    `failed to spawn ${bin}: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    0,
    `fixture exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );

  const lines = new Set(result.stdout.split("\n").map((line) => line.trim()));
  const expected = [
    "unit_literal=ok",
    "unit_fn_returns_unit=ok",
    "option_some=0",
    "option_none=-1",
    "option_some_unit=some_unit",
    "option_binding_is_binding=6",
    "option_relay=2",
    "option_relay_absent=-1",
    "result_is_ok=true",
    "result_is_err=true",
    "result_match=21",
    "result_forward_ok=0",
    "result_forward_err=9",
    "result_map_err=7",
    "result_ok_to_option=21",
    "project_field=crab",
    "project_missing_key=missing",
    "project_present_key=one",
    "project_array_index=20",
    "project_string_index=b",
  ];
  const missing = expected.filter((line) => !lines.has(line));
  assert.deepEqual(
    missing,
    [],
    `fixture output is missing named lines: ${missing.join(", ")}\nstdout:\n${result.stdout}`,
  );
});
