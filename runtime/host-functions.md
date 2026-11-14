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

Result schemas are logical. A host function that declares no return type publishes the logical Unit schema `()`, not a nullable value. A host function that may return an absent value declares `Option<T>`, and one that may return a guest error declares `Result<T, E>`. Both `Result` parameters are required.

## Calls

At runtime a host call receives RustScript values and returns one RustScript value under its declared result schema. There is no null-return convention for procedures:

- **Unit.** A host function that returns no value has the logical Unit return schema. The call still supplies the internal Null value as the physical payload, and `()` remains distinct from `Option::None` and from a missing value.
- **Option.** A guest `Option<T>` crosses the typed Rust boundary as the guest wrapper `GuestOption<T>`, which converts by variant with the standard Rust `Option<T>`. `GuestOption` is not an optional-user-argument marker: a logical `None` is an explicit value, not an omitted parameter.
- **Result.** A guest `Result<T, E>` crosses the typed Rust boundary as `GuestResult<T, E>`. Both parameters are preserved through descriptors and schema generation.

The typed host signature in Rust is therefore `VmResult<GuestOption<T>>` for an optional result and `VmResult<GuestResult<T, E>>` for a fallible one, or `VmResult<()>` for a procedure.

The outer `VmResult` is the fatal transport channel. Fuel or epoch suspension, cancellation, pending host work, quota violations, an invalid representation, and host transport failure are reported there and never become a catchable guest `Result::Err`. Only `GuestResult::Err` produces a guest error value. Do not fold a transport failure into a guest error, and do not turn a guest error into a fatal VM failure.

Host functions should not assume a specific internal representation for RustScript values beyond the public host ABI contract.

## Logical values at the boundary

Variant selection is by the carrier's Boolean `tag`, never by payload truthiness:

- `None`, `Some(0)`, `Some(false)`, `Some("")`, `Some(())`, and nested options are all distinct values. A falsy payload never selects `None`.
- `Ok(0)`, `Err(0)`, `Ok(false)`, and `Err(false)` are distinct `Result` values for the same reason.
- `Option::None` is a tagged value. It is not a map deletion and not an omitted field.
- Host arguments are positional, and whether an absent argument is an error depends on the declared Rust type of the parameter. There are three layers, and none of them turns an omission into a guest value the guest did not write:
  - **A trailing `Option<T>` parameter may be omitted.** `from_missing_arg` returns `Ok(None)` for `Option<T>`, and the parameter's schema label is the nullable form — `Option<i64>` is labelled `int | null`. An omission arrives as an absent argument, not as a guest value: nothing is pushed onto the guest argument list, so the guest never sees an `Option::None` it did not write. Only trailing parameters can be omitted, because the required parameters are the leading non-optional ones; omitting a parameter to the left of a supplied one is a signature mismatch. This is a Rust-side convenience that never produces a logical `Option` value.
  - **A `GuestOption<T>` or `GuestResult<T, E>` parameter may not be omitted.** Both are decoded by the same generated argument decoder, which reports a missing argument by wrapper and parameter name: `missing {wrapper} {param}` — for example `missing json::decode text`. It is not reported as a generic missing-argument label, and `GuestOption` gets no omittable variant: `guest_result_shape` matches the guest `Option` wrapper as well as the guest `Result`, and the wrapper expands every such parameter to a required `args.get(index)`.
  - **Every other parameter type rejects an absent argument the same way**, with `missing {wrapper} {param}`, so a missing argument never becomes an implicit `None` for a value the guest did not write.
  The one place an `Option` may be absent without an argument is a `map`/`struct` literal built against a declared schema, where the construction site materializes the omitted field as `Option::None`.

Ownership follows the existing rules. An `Option::Some` or a `Result` payload may own a resource; the unselected branch owns nothing. A selected resource is published, transferred, taken, or closed exactly once through the live-VM publication journal, and unselected branches do not acquire ownership. Borrowed-resource returns are rejected, including nested combinations, and a resource array is not supported by the host handle ABI and is refused with a capability error. Dynamic and unknown payloads, and transport results such as `VmResult` nested inside a payload, are also rejected.

## Calls that may fail

A host call may fail in two different ways, and the distinction is part of the contract:

- A **guest error** is an ordinary value in the declared `Result<T, E>`. RustScript code observes it as `Result::Err` and may match, map, or propagate it with `?`.
- A **fatal failure** is a VM trap or an outer `VmResult` error. It is not observable as a guest value and must not be caught as one.

When the embedding API predates logical `Result`, a failure may instead be surfaced as a RustScript trap; that mapping is a host capability decision and does not create a catchable guest error.

## Type arguments

Some host functions may accept explicit type arguments. If a host function does not declare generic arity, type arguments are rejected. If it declares generic arity, the call must provide the required number unless the host contract defines inference.

Typed JSON is the reference case. `json::decode::<T>(text)` requires an explicit concrete type argument: without one the call fails at compile time, and missing type arguments are never invented as `unknown`. `json::encode` is lowered from the checked argument schema rather than from an explicit type argument. The untyped `json::decode` and `json::encode` entry points belong to the internal VM and to other frontends; they are not part of the RustScript guest boundary.

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

A reported category should make clear whether the outcome was a guest `Result::Err`, a fatal VM/trap failure, or a capability refusal.

Sensitive host details should be redacted according to embedding policy.
