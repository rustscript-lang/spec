# Bytecode Format

RustScript bytecode is the portable execution artifact consumed by a compatible VM. It represents a compiled program after parsing, name resolution, type checking, lowering, and constant preparation.

This chapter describes the required high-level sections and contracts. It does not prescribe a concrete binary encoding.

## Goals

A bytecode artifact should be:

- deterministic for equivalent source and compiler options;
- self-describing enough for validation before execution;
- separable from host registration, while still naming required host capabilities;
- debuggable when source-map metadata is present;
- forward-compatible through explicit versioning.

## Top-level structure

A bytecode artifact contains these logical sections:

| Section | Purpose |
|---|---|
| Header | Identifies the artifact as RustScript bytecode and declares format version, producer metadata, and compatibility flags. |
| Constant pool | Stores immutable literal values and reusable symbolic names. |
| Function table | Lists all callable bytecode functions, their arity, type parameters, exported name if any, and entry location. |
| Instruction stream | Stores VM instructions for executable functions and top-level program body. |
| Local and frame metadata | Describes local slots, parameter slots, captures, and frame layout needed for validation and debugging. |
| Type metadata | Stores declared schemas and inferred/checked public signatures when available. |
| Import and host requirements | Names modules, built-in namespaces, or host functions that must be available before execution. |
| Debug metadata | Optional source mapping, symbol names, line tables, and breakpoint-safe locations. |

## Versioning

The current bytecode format is **VMBC v14**. A VM must reject bytecode whose version is not the current version.

There is one current schema layout and no compatibility layer: no legacy reader, no legacy adapter, and no version-dependent writer. Artifacts may declare feature flags; a VM must reject an artifact that requires a feature it does not support. Unknown schema tags, malformed carriers, and invalid schema budgets are rejected rather than repaired.

## Constant pool

The constant pool stores reusable literals and symbols. Primitive constants include booleans, integers, floats, strings, bytes, and the internal Null value that carries logical Unit. There is no source-level `null` literal, so the only Null constants are the Unit carrier and positions where the selected schema permits a missing payload.

Compound values may be represented directly or constructed by instructions, depending on the encoder.

Constant entries are immutable. Mutable arrays, maps, or objects created during execution must be runtime values, not shared mutable constants.

## Logical values: Unit, Option, Result

Type metadata carries logical schemas, and the physical carrier does not by itself define the logical type.

**Unit** has schema `()` and uses the internal Null value as its physical carrier. A Unit slot is not a nullable slot: an explicit source `null` is never inferred into Unit, and a missing payload is not a unit value.

**Option** has a logical `Option<T>` schema and a Map carrier with a Boolean `tag`:

- `tag: true` is `Some`, with the active value under `payload`;
- `tag: false` is `None`, and a `None` carrier has no active `payload` entry.

A non-Boolean or missing tag, extra fields, or a payload on `None` are malformed and fail validation. `Some(())` uses the internal Null value as its payload, and a canonicalizing writer may omit a Null-valued payload entry; a tag-only `Some` is restored only when the declared payload schema is logical Unit, while a missing payload under any other payload schema is malformed.

**Result** has a logical `Result<T, E>` schema that preserves both the `ok` and `err` schemas, and the same Map carrier convention: Boolean `tag` where `true` is `Ok`, with the selected value under `payload`. A missing payload means Null only when the selected schema permits it. A missing or non-Boolean tag, extra fields, or a wrong selected payload fail validation. Raw map construction does not establish guest `Result` typing.

Schema tags are part of the current wire contract. Host schemas encode logical Option with tag `15` and Unit with tag `16`; compiler schemas use tag `19` for Option and tag `20` for Unit. Existing tag numbers and builtin IDs are unchanged by this contract. A `Result` schema is encoded as its own schema variant with both parameters, so the two payload schemas survive typing, ownership, and serialization; substituting `unknown` or inventing a named-map identity is not permitted.

Variant selection is by the carrier tag, never by payload truthiness. `Some(0)`, `Some(false)`, `Some("")`, `Some(())`, and `None` are different encoded values, as are `Ok(0)`, `Err(0)`, `Ok(false)`, and `Err(false)`.

## Functions and entry points

A bytecode artifact has one top-level entry point. Additional functions may be private or exported.

Each function record declares:

- stable function identifier within the artifact;
- display name, if available;
- parameter count;
- type parameter count, if applicable;
- local frame size;
- capture requirements for closures;
- instruction range or entry address;
- optional source and symbol metadata.

A function that declares no return type has the logical Unit result schema. Propagation (`?`) is lowered into a branch plus the function's normal return continuation; the artifact does not gain a throw/catch mechanism.

## Instructions

The instruction stream is a sequence of VM operations. Each operation has a defined opcode and operands. Operands may reference constants, locals, functions, host calls, jump targets, or type metadata.

Instruction validation happens before execution. A conforming VM should reject malformed jumps, invalid local references, invalid constant references, wrong arity calls, and missing host requirements.

Logical payload type does not establish a native representation. Generic map reads can remain tagged and require checked unboxing, and a backend may decline a workload it cannot prove; interpreter, JIT, and AOT therefore share one value model rather than one instruction-selection strategy.

## Control flow

Control-flow instructions use artifact-local targets. Targets must point to instruction boundaries. Conditional and unconditional jumps must not enter the middle of another structured region in a way that violates VM validation rules.

Loop control is lowered into normal control-flow instructions. Source-level loop structure may be preserved only in debug metadata.

## Values and stack discipline

The bytecode model is stack-oriented or register/local-oriented according to VM implementation, but the artifact must define the effect of each instruction on the abstract evaluation state. At validation time, each instruction boundary should have a consistent expected value shape.

Function calls consume arguments and produce exactly one result value, including the logical Unit value `()` for procedures. A procedure does not produce a nullable result, and a caller must not treat the Unit result as `Option::None`.

## Errors and traps

Runtime errors are observable traps. Examples include invalid index access, unsupported operation for a value type, arity mismatch that was not rejected earlier, and host function failure.

A fatal trap and a guest `Result::Err` are separate channels. A guest error is an ordinary value in the declared `Result` schema; fuel or epoch suspension, cancellation, quota violations, invalid representation, and host transport failure remain fatal and are not representable as a guest error.

A trap should include enough context for diagnostics: instruction location, active function, source location if known, and an error category.

## Debug metadata

Debug metadata is optional. When present, it maps instructions back to source locations and symbolic names. Debug metadata must not change program behavior.

See [Debugger conventions](../runtime/debugger.md).
