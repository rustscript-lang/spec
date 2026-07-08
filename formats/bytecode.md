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

The header declares a bytecode format version. A VM must reject bytecode with an unsupported major version. Minor-version changes may add optional sections or metadata, but must not change the meaning of existing instructions.

Artifacts may also declare feature flags. A VM must reject an artifact that requires a feature it does not support.

## Constant pool

The constant pool stores reusable literals and symbols. Primitive literals include null, booleans, integers, floats, strings, and bytes. Compound values may be represented directly or constructed by instructions, depending on the encoder.

Constant entries are immutable. Mutable arrays, maps, or objects created during execution must be runtime values, not shared mutable constants.

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

## Instructions

The instruction stream is a sequence of VM operations. Each operation has a defined opcode and operands. Operands may reference constants, locals, functions, host calls, jump targets, or type metadata.

Instruction validation happens before execution. A conforming VM should reject malformed jumps, invalid local references, invalid constant references, wrong arity calls, and missing host requirements.

## Control flow

Control-flow instructions use artifact-local targets. Targets must point to instruction boundaries. Conditional and unconditional jumps must not enter the middle of another structured region in a way that violates VM validation rules.

Loop control is lowered into normal control-flow instructions. Source-level loop structure may be preserved only in debug metadata.

## Values and stack discipline

The bytecode model is stack-oriented or register/local-oriented according to VM implementation, but the artifact must define the effect of each instruction on the abstract evaluation state. At validation time, each instruction boundary should have a consistent expected value shape.

Function calls consume arguments and produce exactly one result value, including null for procedures.

## Errors and traps

Runtime errors are observable traps. Examples include invalid index access, unsupported operation for a value type, arity mismatch that was not rejected earlier, and host function failure.

A trap should include enough context for diagnostics: instruction location, active function, source location if known, and an error category.

## Debug metadata

Debug metadata is optional. When present, it maps instructions back to source locations and symbolic names. Debug metadata must not change program behavior.

See [Debugger conventions](../runtime/debugger.md).
