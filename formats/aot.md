# AOT Format

The AOT format is a distribution artifact for RustScript programs that have been prepared ahead of time. It packages bytecode and the metadata needed to load, validate, link, and run the program without re-reading source text.

This chapter defines the high-level contract only. It does not mandate archive layout, compression, or serialization format.

## Goals

An AOT artifact should:

- bundle all execution material needed by the VM;
- declare target VM compatibility;
- describe required host capabilities;
- optionally include source-map and symbol metadata for diagnostics;
- support reproducible builds where inputs and options match.

## Logical contents

| Section | Purpose |
|---|---|
| Manifest | Describes package identity, AOT format version, compiler identity, target VM requirements, and enabled features. |
| Main bytecode | Contains the compiled program entry artifact. |
| Module bytecode | Contains compiled dependency modules, if bundled. |
| Link metadata | Describes exported symbols, imported symbols, module names, and host requirements. |
| Resource table | Declares non-code assets, if the runtime supports them. |
| Debug bundle | Optional source maps, line tables, symbol names, and build provenance. |
| Integrity data | Optional hashes/signatures for validation and supply-chain checks. |

## Manifest

The manifest is the entry metadata for loaders. It should include:

- AOT format version;
- bytecode format version range;
- target VM feature requirements;
- package name and optional semantic version;
- entry module and entry function or top-level entry marker;
- required host function namespaces and names;
- debug metadata availability;
- optional integrity metadata.

## Linking model

AOT loading has two phases:

1. Validate package structure and bytecode compatibility.
2. Link imported modules and host functions against the runtime environment.

The loader must fail before program execution if required modules or host functions are missing, ambiguous, or incompatible with declared arity/type contracts.

## Module identity

A bundled module has a logical module name. The AOT artifact may preserve relative module identity, but it should not require original source file paths at runtime.

Two modules with the same logical name in one package must resolve deterministically or be rejected.

## Host capability requirements

Host capabilities are declared by symbolic namespace and function name, with optional arity and type signature metadata. The package does not embed host implementations.

See [Host functions](../runtime/host-functions.md).

## Debug bundle

AOT packages may include debug metadata. Debug metadata can be full, stripped, or externalized.

Recommended modes:

| Mode | Behavior |
|---|---|
| Full | Includes symbol names and source maps. |
| Symbols | Includes names and line tables but omits source text. |
| Stripped | Includes only runtime-required metadata. |
| External | Points to a separate debug artifact by content identity. |

Debug metadata must not affect execution semantics.

## Compatibility

A loader must reject an AOT package when:

- the AOT format major version is unsupported;
- the bytecode format is unsupported;
- required VM features are absent;
- host capability requirements cannot be linked;
- integrity checks fail when policy requires them.

Minor-version format additions should be ignorable unless marked as required by the manifest.
