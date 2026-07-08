# Debugger Conventions

RustScript debugger support is defined as a contract between compiled artifacts, the VM, and a debugger client. The contract is source-oriented even when execution runs from bytecode or an AOT package.

This chapter defines observable debugger behavior. It does not standardize a transport protocol.

## Core concepts

| Concept | Meaning |
|---|---|
| Source unit | A named source document or logical module. |
| Source span | A range within a source unit. |
| Instruction location | A bytecode position or equivalent VM execution address. |
| Frame | One active function or top-level execution context. |
| Local binding | A named value visible in a frame. |
| Breakpoint | A request to pause execution at a source location or function entry. |
| Pause reason | The cause of a stop: breakpoint, step, trap, host callback, or explicit pause. |

## Source maps

Debuggable artifacts should provide mappings from instruction locations to source spans. A mapping may be exact or approximate. The VM should prefer the smallest meaningful source span for current-location display.

When source text is not embedded, the debugger may still display logical names, line numbers, and symbol names if present.

## Breakpoints

Breakpoints are source-level requests. A debugger asks to pause at a source unit and line/column. The VM resolves that request to one or more breakpoint-safe instruction locations.

If the requested location is not executable, the VM should choose the nearest following executable location in the same source unit when possible. If no such location exists, the breakpoint is rejected.

Breakpoint identity should be stable for a loaded artifact. Recompiling may invalidate existing breakpoint locations.

## Stepping

The debugger should support these stepping modes:

| Mode | Behavior |
|---|---|
| Continue | Resume until the next pause reason. |
| Step over | Run the current source-level operation without entering callees. |
| Step into | Enter the next callable operation when one is executed. |
| Step out | Resume until the current frame returns or traps. |
| Pause | Request a pause at the next safe point. |

Stepping is defined over source mappings, not raw instruction count. Multiple instructions may correspond to one source operation.

## Frames and stack traces

A paused VM exposes a stack trace ordered from the current frame outward. Each frame should include:

- function name or top-level marker;
- source span, if known;
- instruction location;
- parameter bindings, if named metadata is present;
- local bindings visible at the current point, where available;
- closure captures, where available and safe to expose.

Optimized or stripped artifacts may omit local names or values. The debugger should distinguish unavailable values from null values.

## Value inspection

Debuggers may inspect primitive values, arrays, maps, objects, closures, and host values. Large or cyclic values may be summarized. Host values may expose only an opaque display string unless the host opts into structured inspection.

Inspection must not mutate program state unless the debugger explicitly performs an evaluation or assignment operation supported by the VM.

## Exceptions and traps

When execution traps, the debugger should receive:

- trap category;
- human-readable message;
- current frame and source span if known;
- stack trace;
- host error metadata when a host call caused the trap and policy allows disclosure.

## Host calls and debugger visibility

A host call may appear as a single source-level operation. A VM may optionally expose host-call entry and return pause points, but normal source stepping should not require entering host implementation internals.

Host callbacks into RustScript create normal RustScript frames.

## Evaluation while paused

A debugger may support evaluating RustScript expressions in the context of a paused frame. Evaluation should be opt-in because it can call functions or host capabilities and therefore may have side effects.

If evaluation is supported, the VM must document whether assignments, host calls, and function calls are allowed.

## Concurrency and async execution

If the VM supports multiple tasks or async execution, each paused execution context should have an identity. Breakpoints may pause one context or all contexts according to debugger policy.
