# Lexical Structure

RustScript source files conventionally use the `.rss` extension.

## Characters and whitespace

Source text is Unicode. Whitespace is skipped between tokens. Newlines are tracked for diagnostics but are not statement separators by themselves in the normal file compiler path.

## Comments

RustScript supports two comment forms:

```rustscript
// line comment

/* block comment */
```

Block comments are not nested. An unterminated block comment is a lexical error.

## Identifiers

Identifiers are ASCII-only:

```ebnf
IdentifierStart ::= ASCII_ALPHA | "_"
IdentifierContinue ::= ASCII_ALNUM | "_"
Identifier ::= IdentifierStart IdentifierContinue*
```

## Keywords

The lexer recognizes these reserved words for RustScript:

```text
as break continue else false fn for if let match pub struct true use while
```

The identifier `mut` is context-sensitive after `let` and `&`; it is not a lexer keyword.

`null` is neither a keyword nor a literal. Absence is expressed with the constructor `Option::None`, and "no value produced" is the Unit value `()`. `Option`, `Result`, `Some`, `None`, `Ok`, and `Err` are built-in type and constructor names, not reserved words, so the lexer still treats them as ordinary identifiers and paths.

## Punctuators and operators

```text
! != + ++ += - * / % & && | || ( ) [ ] { } , : ? ?. . ... ; = == => < <= > >=
```

The `++` and `+=` tokens are enabled for RustScript. `...` is only used by variadic array type schemas.

`?` and `?.` are distinct operators. `?` is expression-level error or absence propagation and follows its operand with no intervening token. `?.` is fallible projection; the `?` and `.` form one operator, and a projection is written as `receiver?.field` or `receiver?.[index]`. An empty `(` `)` pair spell both the Unit type and the Unit value.

## Literals

### Booleans and unit

```rustscript
true
false
()
```

`()` in value position is the Unit value. Unit is a logical type whose physical carrier is the VM's internal Null value, so a Unit value is not a source-level `null`: RustScript has no `null` literal, and an explicit `null` in source is rejected rather than silently producing Unit or `Option::None`.

### Integers

Integers are signed 64-bit values after unary `-` is applied. Decimal and hexadecimal forms are accepted:

```rustscript
0
42
0xff
-9223372036854775808
```

The lexer accepts the magnitude `9223372036854775808` only so unary `-` can form `i64::MIN`; using it without unary `-` is rejected later.

### Floats

Floats use decimal syntax with a fractional part:

```rustscript
1.0
0.25
42.5
```

Exponent notation is not implemented by the current lexer.

### Strings

Strings may use double or single quotes:

```rustscript
"hello"
'hello'
```

Supported escapes:

```text
\n \r \t \\ \" \' \0 \xHH
```

### Bytes

Bytes literals use a `b` prefix and double quotes:

```rustscript
b"RSS\x00"
```

Bytes literal content must be ASCII unless represented with `\xHH`. Supported escapes mirror strings but produce bytes.

## Statement terminators

Most statements require `;`. Function bodies and if-expression branches may end with a trailing expression without `;`; that expression is the block result.
