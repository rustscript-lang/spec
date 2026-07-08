# Host Functions

Host functions are capabilities supplied by an embedding application or runtime environment. RustScript code calls them through imported namespaces or direct imports, while registration happens outside the language source.

This chapter describes the host function contract at a high level.

## Model

A host function has:

- a symbolic namespace;
- a symbolic function name;
- an arity contract;
- optional type signature metadata;
- a call implementation supplied by the host;
- optional capability and security metadata.

The VM links RustScript call sites to registered host functions before or during execution. A missing or incompatible host function is a link/validation failure when the requirement is statically known, or a runtime trap otherwise.

## Namespaces

Host functions are grouped by namespace. Namespaces reduce ambiguity and allow embedders to expose only the capability groups they intend to support.

RustScript source refers to host functions using imported names or namespace-qualified calls. The host registry owns the mapping between symbolic names and implementations.

## Registration lifecycle

A host environment should register host functions before loading or executing a bytecode/AOT artifact. Registration provides the callable implementation and metadata used for linking and validation.

Recommended lifecycle:

1. Create a host registry for the VM instance or embedding environment.
2. Register one or more namespaces.
3. Register functions within each namespace with arity and optional type metadata.
4. Load bytecode or AOT artifact.
5. Link artifact requirements against the registry.
6. Execute only after required host functions resolve successfully.

## Function signatures

A host function signature may include:

- parameter names for diagnostics;
- parameter value schemas;
- return value schema;
- optional generic type argument count;
- whether the function can fail;
- whether the function may perform side effects;
- whether it is safe for debugger evaluation.

When type metadata is present, RustScript compile/link diagnostics should report mismatches using source-level names and schemas.

## Calls

At runtime, a host call receives RustScript values and returns one RustScript value. Procedures should return null.

A host call may fail. Failures become RustScript traps unless the embedding API maps them to a language-level result value.

Host functions should not assume a specific internal representation for RustScript values beyond the public host ABI contract.

## Type arguments

Some host functions may accept explicit type arguments. If a host function does not declare generic arity, type arguments are rejected. If it declares generic arity, the call must provide the required number unless the host contract defines inference.

## Capability and security policy

Registration is the boundary for authority. Embedders should expose only the namespaces required for a program. Sensitive capabilities should be opt-in and visible in AOT/bytecode requirement metadata.

A host function may be marked unavailable for debugger evaluation even if it is available during normal execution.

## Determinism

Host functions may be deterministic or non-deterministic. The host registry should expose this as metadata when reproducibility matters. Examples of non-deterministic capabilities include time, random data, network access, and external process interaction.

## Versioning

A host namespace may declare a version. A program requirement may request a minimum version, exact version, or feature flag. If a required version or feature is absent, linking should fail before execution.

## Error reporting

Host-call errors should include:

- host namespace and function name;
- error category;
- user-facing message;
- optional structured details;
- source location if the call site is known.

Sensitive host details should be redacted according to embedding policy.
