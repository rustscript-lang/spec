# RustScript Language Specification

This repository describes the RustScript (`.rss`) language as implemented by `project-d`.

The current draft is implementation-derived. The normative source for this draft is the `project-d` parser, lexer, source loader, and compiler IR:

- `pd-vm/src/compiler/frontends/rustscript.rs`
- `pd-vm/src/compiler/parser/lexer.rs`
- `pd-vm/src/compiler/parser/mod.rs`
- `pd-vm/src/compiler/parser/statements.rs`
- `pd-vm/src/compiler/parser/expressions.rs`
- `pd-vm/src/compiler/source_loader/imports.rs`
- `pd-vm/src/compiler/ir.rs`

## Documents

- [Lexical structure](language/lexical.md)
- [Syntax](language/syntax.md)
- [Grammar sketch](language/grammar.md)

## Scope

This draft covers syntax accepted by the RustScript frontend. It intentionally does not define VM bytecode, host ABI behavior, standard library semantics, optimizer behavior, or non-RustScript frontend compatibility.

Where the text and implementation disagree, the implementation wins until this specification is updated.
