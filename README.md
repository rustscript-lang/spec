# RustScript Language Specification

This repository describes the RustScript (`.rss`) language, execution artifact formats, debugging contract, and host interop model.

The specification is implementation-derived, but the public text is intentionally high level: it describes observable language/runtime contracts rather than source layout or implementation details.

## Documents

### Language

- [Lexical structure](language/lexical.md)
- [Syntax](language/syntax.md)
- [Grammar sketch](language/grammar.md)

### Runtime and tooling contracts

- [Bytecode format](formats/bytecode.md)
- [AOT format](formats/aot.md)
- [Debugger conventions](runtime/debugger.md)
- [Host functions](runtime/host-functions.md)

## Scope

This draft covers:

- RustScript syntax and grammar shape.
- VM bytecode as a portable execution artifact.
- AOT packages as a distribution artifact.
- Debugger-facing source, frame, stack, and breakpoint conventions.
- Host function registration and call contracts.

It does not standardize optimizer strategy, internal compiler organization, private runtime data structures, or non-RustScript frontend compatibility.

Where this text and an implementation disagree, the implementation is the compatibility reference until this specification is updated.
