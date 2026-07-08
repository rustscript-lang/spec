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
- A return type may be followed by `?` to make it optional.
- A block body must end in an expression; a final semicolon makes the function return invalid for lint/spec purposes.
- A trailing semicolon after a block function body is tolerated.

## Type syntax

Implemented primitive and structural type schemas:

```rustscript
unknown
null
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
Type?
Type[]
```

Notes:

- `unknown` is accepted but tracked by diagnostics.
- Inline object type schemas are rejected; use `struct` and refer to the struct name.
- `[T]` is an array of `T`.
- `[A, B]` is a fixed tuple-style array schema.
- `[A, B, T...]` is a tuple prefix followed by a variadic rest type.
- `Type?` wraps a type in an optional schema.
- `Type[]` is an array alias and may repeat.

## Let bindings and assignment

```rustscript
let value = 1;
let typed: int = 1;
let mut total = 0;

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

RustScript uses Rust-style range `for` loops:

```rustscript
for i in 0..10 {
    statement;
}

for i in 0..=10 {
    statement;
}
```

`..` is an exclusive integer range, and `..=` is inclusive. Parenthesized C-style loop heads are rejected. Use `while` for custom steps or descending loops.

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
| Logical OR | `||` | left |
| Logical AND | `&&` | left |
| Comparison | `==`, `!=`, `<`, `<=`, `>`, `>=` | left |
| Additive | `+`, `-` | left |
| Multiplicative | `*`, `/`, `%` | left |
| Unary | `&`, `&mut`, `-`, `!`, prefix `++` | right |
| Primary/postfix | calls, indexing, slicing, member access, optional access, postfix `++` | left |

### Primary expressions

```rustscript
null
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

Optional access:

```rustscript
value?.field
value?.[key]
```

### Array and map literals

```rustscript
[]
[1, 2, 3]
{}
{"x": 1, y: 2, [dynamic_key]: 3}
{0: "zero", true: "yes", null: "nil"}
```

If a brace literal contains map entries, bare expression entries are also accepted and receive sequential integer keys starting at `0`. Otherwise a brace literal with only expressions is lowered as an array-style literal.

### If expression

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

### Match expression

```rustscript
let out = match value {
    0 => "zero",
    "x" => "x",
    null => "nil",
    Some(inner) => inner,
    Option::None => "none",
    Some(int) => "integer optional",
    _ => "default",
};
```

Supported patterns:

- integer literals
- string literals
- bytes literals
- `null`
- `None`
- `Option::None`
- `Some(name)` binding
- `Some(TypeName)` type patterns for `int`, `float`, `number`, `bool`, `string`, `bytes`, `array`, `map` and their capitalized names
- `_` wildcard

A wildcard arm is required. Non-wildcard arms cannot appear after the wildcard arm.

### Closures

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
