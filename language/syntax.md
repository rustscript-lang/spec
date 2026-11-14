# Syntax

This page describes the RustScript syntax accepted by `project-d`.

## Program

A program is a sequence of statements until end of file.

```ebnf
Program ::= Statement*
```

## Use directives

RustScript uses `use`, not `import`.

For local `.rss` modules, the source loader accepts:

```rustscript
use math;
use self::math;
use super::stdlib::rss::strings::{trim, split as split_string};
use super::stdlib::rss::iter::*;
use super::stdlib::rss::iter::{*};
use super::stdlib::rss::strings as string;
```

Rules:

- `use path;` imports all public symbols from the target module.
- `use path::*;` and `use path::{*};` import all public symbols explicitly.
- `use path::{name, other as alias};` imports selected public symbols.
- `use path as alias;` imports a namespace alias.
- `self` and `super` are supported path qualifiers.
- `crate::` paths are rejected.
- If the path does not end with `.rss`, `.rss` is appended by the loader.

Inside the parser, built-in and host namespaces also use `use`:

```rustscript
use json;
use http;
use runtime as rt;
use http::{request as req};
```

Built-in namespaces must be imported as namespaces and called through that namespace; built-in use-lists are rejected.

## Struct declarations

Struct declarations define named object schemas for type checking.

```rustscript
struct Point {
    x: int,
    y: int,
}

struct Box<T> {
    value: T,
}
```

Struct fields are `name: Type` pairs separated by commas. A trailing comma is allowed.

## Function declarations

Functions may be declared, defined with an expression body, or defined with a block body.

```rustscript
fn declared(x: int) -> int;

fn double(x: int) -> int = x + x;

pub fn id<T>(value: T) -> T {
    value
}
```

Rules:

- `pub fn` marks a function as exported.
- Generic parameters use `<T, U>` after the function name.
- Parameters may omit type annotations.
- Return type syntax is `-> Type`.
- There is no optional return-type suffix. `int?` and `Type?` are rejected; write `Option<int>` or `Result<int, string>`.
- A function or closure with no declared return type has the Unit return type `()`.
- A block body must end in an expression; a final semicolon makes the function return invalid for lint/spec purposes.
- A trailing semicolon after a block function body is tolerated.

## Type syntax

Implemented primitive and structural type schemas:

```rustscript
unknown
int
float
number
bool
string
bytes
array
array<T>
map
map<T>
Name
Name<T, U>
T
[T]
[A, B]
[A, B, T...]
fn(A, B) -> R
()
Option<T>
Result<T, E>
Type[]
```

Notes:

- `unknown` is accepted but tracked by diagnostics.
- Inline object type schemas are rejected; use `struct` and refer to the struct name.
- `[T]` is an array of `T`.
- `[A, B]` is a fixed tuple-style array schema.
- `[A, B, T...]` is a tuple prefix followed by a variadic rest type.
- `Type[]` is an array alias and may repeat.
- `()` is the Unit type. Its physical carrier is the VM's internal Null value, but Unit is a logical type: `null` is not a type and is not assignable to `()`.
- `Option<T>` and `Result<T, E>` are compiler built-ins, not user or host types, and cannot be redeclared. Both `Result` parameters are required and invariant.
- There is no `T?` optional suffix and no `null` type. `Option::None` has no payload to infer from, so it requires an `Option<T>` annotation or another contextual type.
- `Option<T>` and `Result<T, E>` may be nested in arrays, maps, structs, generic types, callables, and each other.

## Let bindings and assignment

```rustscript
let value = 1;
let typed: int = 1;
let mut total = 0;
let unit: () = ();

total = total + 1;
total += 1;
total++;
++total;
```

`mut` is enforced when mutable binding checks are enabled by the compiler pipeline. `+=` and `++` require RustScript dialect support and are available in the RustScript frontend.

## Control flow statements

### If statement

```rustscript
if condition {
    statement;
} else if other_condition {
    statement;
} else {
    statement;
}
```

### While statement

```rustscript
while condition {
    statement;
}
```

### For statement

RustScript supports Rust-style integer ranges and borrowed map entry iteration:

```rustscript
for i in 0..10 {
    statement;
}

for i in 0..=10 {
    statement;
}

for (key, value) in &map_value {
    statement;
}

for (key: string, value: int) in &typed_map {
    statement;
}
```

`..` is an exclusive integer range, and `..=` is inclusive. Borrowed map iteration visits each entry once without creating a `keys` array or performing a second lookup. Its order is unspecified. The map local is immutably borrowed for the loop body and cannot be assigned to or mutated there. Loop bindings are immutable unless a future pattern form explicitly declares otherwise.

Because `map<T>` describes the value type while map keys remain dynamic, strict-typing code should annotate a key binding when its concrete type is required. Parenthesized C-style loop heads are rejected. Use `while` for custom steps or descending loops.

### Loop control

```rustscript
break;
continue;
```

Both are only valid inside loops.

## Expressions

Expression precedence, from low to high:

| Level | Operators/forms | Associativity |
|---|---|---|
| Logical OR | `\|\|` | left |
| Logical AND | `&&` | left |
| Comparison | `==`, `!=`, `<`, `<=`, `>`, `>=` | left |
| Additive | `+`, `-` | left |
| Multiplicative | `*`, `/`, `%` | left |
| Unary | `&`, `&mut`, `-`, `!`, prefix `++` | right |
| Primary/postfix | calls, indexing, slicing, member access, optional access, `?`, postfix `++` | left |

### Primary expressions

```rustscript
()
true
false
123
1.25
"text"
b"bytes"
name
name(args...)
namespace::function(args...)
function::<T>(args...)
(namespace_expr)
[array, values]
{key: value, other = value}
```

`()` is the Unit value. There is no `null` literal: an explicit `null` in expression position is a rejected source form, not Unit and not `Option::None`.

### Calls and type arguments

Named functions, imported functions, built-ins, and host calls use call syntax:

```rustscript
add(1, 2)
json::decode::<Payload>(body)
http::request::get_header("x-id")
```

Explicit type arguments require a direct function call. Local function values do not accept explicit type arguments.

### Member, index, and slice access

```rustscript
value.field
value[0]
value[start:end]
value[:end]
value[start:]
```

Special members:

```rustscript
value.copy()
value.unwrap_or(fallback)
value.length
value.has(key)
value.keys
```

`value.unwrap()` is rejected; use `unwrap_or` or explicit optional handling.

## Unit, Option, and Result

`Option` and `Result` are compiler built-ins. They are constructed with namespace-qualified constructors, never with a bare `Some`, `None`, `Ok`, or `Err` (those bare names survive only as legacy optional-slot patterns, covered under Match expression):

```rustscript
let some: Option<int> = Option::Some(0);
let none: Option<int> = Option::None;
let ok: Result<int, string> = Result::Ok(21);
let err: Result<int, string> = Result::Err("bad input");
```

`Option::Some` may infer its payload type when the payload has a fully known schema; `Option::None` and a bare `Result::Ok(7)` need an annotation or another contextual type. Missing type arguments are rejected rather than invented as `unknown`.

The variant is selected by the carrier's Boolean `tag`, never by payload truthiness. `None`, `Some(0)`, `Some(false)`, `Some("")`, `Some(())`, `Ok(0)`, `Err(0)`, `Ok(false)`, and `Err(false)` are all different values.

`Option<T>` provides `map`, `and_then`, `or_else`, `unwrap_or`, `unwrap_or_else`, `ok_or`, and `ok_or_else`. `Result<T, E>` provides `map`, `map_err`, `and_then`, `or_else`, `unwrap_or`, `unwrap_or_else`, `is_ok`, `is_err`, `ok`, and `err`. `ok()` and `err()` convert a `Result` into an `Option` of the selected channel.

### Optional access (`?.`)

```rustscript
value?.field
value?.[key]
```

`?.` is fallible projection and produces a logical `Option` of the projected value. A missing map key, an index outside a declared array, an out-of-range string index, or a receiver that is `Option::None` becomes `Option::None`; a present value becomes `Option::Some`, including `Some(false)`, `Some(0)`, `Some("")`, `Some(())`, and a nested `Some(Option::None)`.

The admitted receiver set is narrower than "any declared schema", and the two forms do not admit the same shapes. Both accept a declared `struct`/object schema and a declared `map<T>`; the index form additionally accepts a declared array such as `[int]`, `string`, and `bytes`. Everything else is refused by the checker rather than projected: `int`, `number`, a `Result`, an unresolved generic parameter, and an unknown struct name all fail to type-check. The field form is the narrower of the two — its receiver must be a direct local and its key a literal, and its schema must be an object or a `map` — while the index form accepts a computed key. `bytes` is the one shape that passes the checker but not code generation: an int index type-checks, yet the runtime projection dispatches only `map`, `array`, and `string`, so a `bytes` receiver lowers to `Option::None` even for an in-range index. Within that subset the forms compose:

```rustscript
struct Data { name: string, arr: [int], table: map<int> }

let data: Data = {name: "crab", arr: [10, 20], table: {a: 1}};
let name = data?.name;          // Option<string>: Some("crab")
let item = data?.arr?.[1];      // Option<int>: Some(20)
let gone = data?.arr?.[5];      // Option<int>: None
let cell = data?.table?.["a"];  // Option<int>: Some(1)
let text: string = "abc";
let letter = text?.[1];         // Option<string>: Some("b")
let outside = text?.[9];        // Option<string>: None
```

On an `Option` receiver, `?.` consumes exactly one `and_then`-equivalent layer, so an `Option<int>` leaf yields `Option<Option<int>>` rather than an arbitrary flattening. An absent dynamic key and a present key holding explicit `Option::None` remain distinct.

The receiver must have a declared schema: a local with an explicit type annotation — a `struct` type, a declared `map<T>`, a declared array such as `[int]`, `string`, or an `Option<T>` of one of these — or a projection rooted in such a local. A value whose type was never declared is rejected: `?.` on an unannotated map literal and on a call result stored without an annotation both fail with `optional access requires a user-declared schema in RustScript`. Annotating the binding (`let data: Data = make();`) is enough.

### Propagation (`?`)

`?` is expression-level propagation, not a type suffix:

```rustscript
fn relay(flag: bool) -> Option<int> {
    let value: Option<int> = if flag => { Option::Some(1) } else => { Option::None };
    let item = value?;
    Option::Some(item + 1)
}
```

Rules:

- On an `Option` operand, `?` passes the `Some` payload through and exits the current `Option`-returning function or closure on `None`.
- On a `Result` operand, `?` passes the `Ok` payload through and returns the original `Err` from the current `Result`-returning function or closure. The error types must match exactly; use `map_err` or `.ok_or(...)` for an explicit conversion, because no implicit error conversion is inserted.
- Later arguments, statements, and side effects after a propagating `?` do not run. A `?` inside a closure exits that closure, not its caller.
- `?` is rejected in a root script, in a function whose return type is not a matching `Option`/`Result`, on a non-`Option`/`Result` operand, on an optional `Result` operand, and on a mismatched error type.
- `?` and `?.` are different operators. `?.` never propagates out of the function.

## Array and map literals

```rustscript
[]
[1, 2, 3]
{}
{"x": 1, y: 2, [dynamic_key]: 3}
{0: "zero", true: "yes", "k": "v"}
```

If a brace literal contains map entries, bare expression entries are also accepted and receive sequential integer keys starting at `0`. Otherwise a brace literal with only expressions is lowered as an array-style literal.

Map keys are identifiers, string, bytes, integer, float, or boolean literals, or a dynamic `[expr]` key. `null` is not a key form; a null map key is rejected. To model an absent entry, omit the key or store an explicit `Option::None` value — those are different things, and storing `Option::None` does not delete the entry.

## If expression

If expressions use `=>` and require an `else` branch:

```rustscript
let value = if condition => {
    1
} else if other => {
    2
} else => {
    3
};
```

Each branch is a block that must end with an expression.

## Match expression

```rustscript
let label = match flag_value {
    0 => "zero",
    "x" => "x",
    _ => "default",
};

let inner = match optional_value {
    Option::Some(value) => value,
    Option::None => -1,
};

let code = match result_value {
    Result::Ok(value) => value,
    Result::Err(error) => error,
};
```

Supported patterns:

- integer literals
- string literals
- bytes literals
- `Option::None`
- `Option::Some(name)` and `Option::Some(_)` bindings
- `Result::Ok(name)`, `Result::Ok(_)`, `Result::Err(name)`, and `Result::Err(_)` bindings
- `_` wildcard

The identifier inside `Option::Some(...)`, `Result::Ok(...)`, and `Result::Err(...)` is always a binding name; these constructors never filter on a type. `Option::Some(int)` declares a binding named `int` and matches any present payload, so it is not a test for an `int` payload. `Option::None` takes no payload, and `Option::None(x)` is rejected as a payload on `None`.

An `Option` match is exhaustive with `Option::Some(binding)` and `Option::None`; a `Result` match is exhaustive with `Result::Ok(binding)` and `Result::Err(binding)`. A wildcard may stand in for the absent branch when the present branch is a constructor arm. Value matches still require a trailing `_` arm, and non-wildcard arms cannot appear after the wildcard arm.

Nested constructor patterns such as `Option::Some(Option::None)`, duplicate arms, and mixing `Option` and `Result` constructor arms in one match are rejected; match the inner value in a second match.

Bare constructor names belong to a different, retired mechanism and never become `Option::`/`Result::` arms:

- `None` and `Some(name)` are the legacy optional-slot patterns. `None` compares the receiver against the internal Null carrier and `Some(name)` negates that comparison, so both only type-check against a receiver that is a legacy optional slot. A logical `Option::Some`/`Option::None` value is not an optional slot, so a match that writes `Some(value)` or `None` over one fails to compile with `Some(...) and None match patterns require an optional value`. It does not fall back to value matching. `Some(_)` is not a usable form of this arm: `_` reaches the parser in `Identifier` position but is rejected with `Some(_) is not supported; bind a name with Some(name)`. Only the constructor spelling `Option::Some(_)` accepts a wildcard.
- `Some(TypeName)` — for example `Some(int)` or `Some(String)` — is the legacy optional-slot *type* pattern. It has no optional-slot precondition: it compiles on any receiver, requires the trailing `_` arm, and compares the receiver's runtime type name instead of testing for a present payload. Which name it tests decides the result. An `Option` carrier is itself a `Value::Map`, and the type name of a map is `map`, so `Some(map)` and `Some(Map)` do match an `Option` carrier — the arm matches the carrier's carrier type, not the presence of a payload. The payload names never match it: `Some(int)`, `Some(float)`, `Some(bool)`, `Some(string)`, `Some(bytes)`, and `Some(array)` compare the top-level value, and a present payload sits nested inside the carrier. `Some(number)` and `Some(Number)` are not a comparison against one name either: they match a receiver whose type name is `int` or `float`, which an `Option` carrier never is.
- Because constructor arms and these legacy value patterns are different mechanisms, one match cannot mix them. The rejection is reported per constructor family, not by one shared message: an `Option` match that pairs `Some(...)` with `Option::None` is rejected with `Option match cannot mix constructor arms with value patterns`, while a `Result` match that pairs a value pattern with `Result::Ok(...)` or `Result::Err(...)` is rejected with `Result match cannot mix constructor arms with value patterns`. A match that pairs `Option` constructor arms with `Result` constructor arms is a third case, rejected as `Option match cannot mix constructor arms with Result arms`.
- `Ok(...)` and `Err(...)` are not patterns at all; a bare `Ok(value)` or `Err(value)` arm is a parse error.

## Closures

Pipe closures are available in RustScript:

```rustscript
|x| x + 1
|x, y| x + y
|| 42
```

Closures have expression bodies. Block bodies are not supported by the RustScript dialect.

## Built-in language functions

The parser recognizes these language-level calls:

```rustscript
print(value);
println(value);
println("x = {}", x);
type(value);
assert(condition);
```

`print` and `println` support Rust-style format strings when the first argument is a string literal and more arguments follow.
