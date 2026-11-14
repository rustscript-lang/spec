# RustScript Language Specification

This repository describes the RustScript (`.rss`) language, execution artifact formats, debugging contract, and host interop model.

The specification is implementation-derived, but the public text is intentionally high level: it describes observable language/runtime contracts rather than source layout or implementation details.

## Documents

### Language

- [Lexical structure](language/lexical.md)
- [Syntax](language/syntax.md)
- [Grammar sketch](language/grammar.md)
- [TextMate grammar](syntaxes/rustscript.tmLanguage.json)

### Runtime and tooling contracts

- [Bytecode format](formats/bytecode.md)
- [AOT format](formats/aot.md)
- [Debugger conventions](runtime/debugger.md)
- [Host functions](runtime/host-functions.md)

## Values: Unit, Option, and Result

RustScript has no `null` literal and no `T?` optional type. Absence and failure are explicit values:

```rss
let unit: () = ();                          // Unit
let some: Option<int> = Option::Some(0);    // present
let none: Option<int> = Option::None;       // absent
let ok: Result<int, string> = Result::Ok(1);
let err: Result<int, string> = Result::Err("bad input");
```

- `()` is Unit. Its physical carrier is the VM's internal Null value, but Unit is a logical type and is not a nullable value.
- `Option<T>` wraps at most one value, selected by the carrier's Boolean `tag`. `Some(0)`, `Some(false)`, `Some("")`, and `Some(())` are present values; payload truthiness never selects `None`.
- `Result<T, E>` is a built-in typed success-or-guest-error value. Both parameters are required.
- `?` is expression-level propagation: `Option` passes `Some` through and exits the enclosing `Option`-returning function or closure on `None`; `Result` passes `Ok` through and returns the exact `Err` from the enclosing `Result`-returning function. Error types must match; use `map_err` or `.ok_or(...)` at the boundary.
- `?.` is fallible projection and yields an `Option`.
- A host returns a guest option as `GuestOption<T>` and a guest result as `GuestResult<T, E>`, with the outer `VmResult` reserved for fatal transport failures. See [Host functions](runtime/host-functions.md).

## Contract tests

The language contract is checked by a dependency-free Node test that validates the grammar JSON, the keyword list, the documentation claims, and the fixture below:

```sh
node --test tests/option-result-contract.test.mjs
```

The fixture `tests/fixtures/option-result.rss` is executed by the same test when `RUSTSCRIPT_CORE_BIN` points at a built `pd-vm-run`:

```sh
RUSTSCRIPT_CORE_BIN=/path/to/pd-vm-run node --test tests/option-result-contract.test.mjs
```

Without `RUSTSCRIPT_CORE_BIN` the fixture-execution test fails with an explicit error; it is never skipped silently, because a skipped execution check would report success without running anything. To run only the static checks while a binary is unavailable:

```sh
node --test --test-skip-pattern='executes the fixture' tests/option-result-contract.test.mjs
```

`--test-skip-pattern` is the flag that actually filters under current Node releases; `--test-name-pattern` does not exclude the fixture-execution test, so this document, the test header, and CI all use the skip pattern.

## Scope

This draft covers:

- RustScript syntax and grammar shape.
- VM bytecode as a portable execution artifact.
- AOT packages as a distribution artifact.
- Debugger-facing source, frame, stack, and breakpoint conventions.
- Host function registration and call contracts.

It does not standardize optimizer strategy, internal compiler organization, private runtime data structures, or non-RustScript frontend compatibility.

Where this text and an implementation disagree, the implementation is the compatibility reference until this specification is updated.
