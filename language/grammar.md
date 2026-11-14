# Grammar Sketch

This is a compact grammar sketch for the RustScript syntax implemented in `project-d`. It is not a parser generator input.

Notation:

- quoted text is a literal token
- `?` means optional
- `*` means zero or more
- `+` means one or more
- `|` means alternatives

The `?` in this notation is always the optionality suffix described above and never the source-level operator. Source `?` appears only as the quoted token `"?"`.

## Program and statements

```ebnf
Program ::= Statement*

Statement ::=
    UseStmt
  | StructDecl
  | FunctionDecl
  | LetStmt ";"
  | Assignment ";"
  | Increment ";"
  | IfStmt
  | WhileStmt
  | ForStmt
  | "break" ";"
  | "continue" ";"
  | Expr ";"

UseStmt ::=
    "use" UsePath ";"
  | "use" UsePath "as" Identifier ";"
  | "use" UsePath "::*" ";"
  | "use" UsePath "::{" "*" "}" ";"
  | "use" UsePath "::{" UseList "}" ";"

UsePath ::= ("self" "::" | "super" "::")* Identifier ("::" Identifier)*
UseList ::= UseItem ("," UseItem)* ","?
UseItem ::= Identifier ("as" Identifier)?

StructDecl ::= "struct" Identifier TypeParams? "{" StructFieldList? "}"
StructFieldList ::= StructField ("," StructField)* ","?
StructField ::= Identifier ":" Type

FunctionDecl ::=
    "pub"? "fn" Identifier TypeParams? "(" ParamList? ")" ReturnType? ";"
  | "pub"? "fn" Identifier TypeParams? "(" ParamList? ")" ReturnType? "=" Expr ";"
  | "pub"? "fn" Identifier TypeParams? "(" ParamList? ")" ReturnType? FunctionBlock ";"?

TypeParams ::= "<" Identifier ("," Identifier)* ">"
ParamList ::= Param ("," Param)*
Param ::= Identifier (":" Type)?
ReturnType ::= "->" Type
FunctionBlock ::= "{" BlockStmt* TrailingExpr "}"

LetStmt ::= "let" "mut"? Identifier (":" Type)? "=" Expr
Assignment ::= Identifier ("=" | "+=") Expr
Increment ::= "++" Identifier | Identifier "++"

IfStmt ::= "if" Expr Block ("else" (IfStmt | Block))?
WhileStmt ::= "while" Expr Block
ForStmt ::= "for" "mut"? Identifier "in" RangeExpr Block
RangeExpr ::= Expr (".." | "..=") Expr
Block ::= "{" Statement* "}"
```

## Types

```ebnf
Type ::=
    PrimitiveType ArrayAlias*
  | NamedType ArrayAlias*
  | ArrayType ArrayAlias*
  | CallableType ArrayAlias*
  | UnitType ArrayAlias*

PrimitiveType ::= "unknown" | "int" | "float" | "number" | "bool" | "string" | "bytes"
NamedType ::= Identifier TypeArgs?
TypeArgs ::= "<" Type ("," Type)* ">"
UnitType ::= "(" ")"
ArrayAlias ::= "[" "]"

ArrayType ::=
    "array" ("<" Type ">")?
  | "[" ArrayTypeItems "]"

ArrayTypeItems ::= Type | Type "," TypeListRest? | Type "..."
TypeListRest ::= Type ("," Type)* ("," Type "...")?

CallableType ::= "fn" "(" TypeList? ")" "->" Type
TypeList ::= Type ("," Type)*
```

There is no optional type suffix. `T?` is not a type, and neither is `null`. An optional value is written `Option<T>` and a fallible value is written `Result<T, E>`; `Option` and `Result` are compiler built-ins with required type arguments, so they also appear as ordinary `NamedType` applications. `()` is the Unit type. A function that declares no return type has the Unit return type.

```ebnf
OptionType ::= "Option" "<" Type ">"
ResultType ::= "Result" "<" Type "," Type ">"
```

Both `Result` parameters are required. `Option::None` has no payload from which to infer its parameter, so it needs an `Option<T>` annotation or another contextual type.

## Expressions

```ebnf
Expr ::= OrExpr
OrExpr ::= AndExpr ("||" AndExpr)*
AndExpr ::= ComparisonExpr ("&&" ComparisonExpr)*
ComparisonExpr ::= AddExpr (("==" | "!=" | "<" | "<=" | ">" | ">=") AddExpr)*
AddExpr ::= MulExpr (("+" | "-") MulExpr)*
MulExpr ::= UnaryExpr (("*" | "/" | "%") UnaryExpr)*
UnaryExpr ::= ("&" "mut"? | "-" | "!" | "++") UnaryExpr | PrimaryExpr

PrimaryExpr ::=
    Literal
  | Identifier CallSuffix?
  | Identifier "::" PathSegments TypeCallArgs? "(" ArgList? ")"
  | OptionNone
  | "(" Expr ")"
  | ArrayLiteral
  | BraceLiteral
  | IfExpr
  | MatchExpr
  | ClosureExpr

CallSuffix ::= TypeCallArgs? "(" ArgList? ")"
TypeCallArgs ::= "::" "<" Type ("," Type)* ">"
PathSegments ::= Identifier ("::" Identifier)*
ArgList ::= Expr ("," Expr)*

PostfixExpr ::= PrimaryExpr PostfixOp*
PostfixOp ::=
    "[" Expr "]"
  | "[" Expr? ":" Expr? "]"
  | "." Identifier
  | "?." Identifier
  | "?." "[" Expr "]"
  | "?"
  | "++"
```

The implementation applies postfix operations inside `PrimaryExpr`; this sketch separates them for readability.

`"?"` is the error and absence propagation operator. It applies to an `Option` operand inside an `Option`-returning function or closure, and to a `Result` operand inside a `Result`-returning function or closure whose error type matches exactly. It is not a type suffix and it is not `?.`; the two-character `?.` projection stays a single postfix operator.

## Literals and collections

```ebnf
Literal ::= "true" | "false" | "(" ")" | IntLiteral | FloatLiteral | StringLiteral | BytesLiteral

ArrayLiteral ::= "[" (Expr ("," Expr)* ","?)? "]"
BraceLiteral ::= "{" (BraceEntry ("," BraceEntry)* ","?)? "}"
BraceEntry ::= Expr | MapEntry
MapEntry ::= MapKey (":" | "=") Expr
MapKey ::= Identifier | StringLiteral | BytesLiteral | IntLiteral | FloatLiteral | "true" | "false" | "[" Expr "]"
```

`"(" ")"` is the Unit literal and is distinct from the parenthesized-expression form `"(" Expr ")"`.

Map keys are never absent: a key is an identifier, string, bytes, integer, float, or boolean literal, or a dynamic `[expr]` key. `null` is not a key form, and an explicit `null` key is rejected.

## Option, Result, and Unit values

```ebnf
OptionSome ::= "Option" "::" "Some" "(" Expr ")"
OptionNone ::= "Option" "::" "None"
ResultOk ::= "Result" "::" "Ok" "(" Expr ")"
ResultErr ::= "Result" "::" "Err" "(" Expr ")"
UnitValue ::= "(" ")"
```

`Option::Some`, `Result::Ok`, and `Result::Err` are ordinary namespace-qualified constructor calls, so they are already covered by `PrimaryExpr`'s namespace-call form. `Option::None` carries no argument list, so `PrimaryExpr` admits it explicitly through `OptionNone`. The bare forms `Some(...)`, `Ok(...)`, and `Err(...)` are not constructors: `Some(1)` is an unknown-function error, bare `None` in expression position is an unknown local, and `Ok(...)`/`Err(...)` are not valid match patterns either. Bare `None` and `Some(name)` survive only as legacy optional-slot match patterns, described below.

## If and match expressions

```ebnf
IfExpr ::= "if" Expr "=>" ExprBlock "else" (IfExpr | "=>" ExprBlock)
ExprBlock ::= "{" BlockStmt* TrailingExpr "}"

MatchExpr ::= "match" Expr "{" MatchArm ("," MatchArm)* ","? "}"
MatchArm ::= MatchPattern "=>" Expr
MatchPattern ::=
    IntLiteral
  | StringLiteral
  | BytesLiteral
  | "Option" "::" "None"
  | "Option" "::" "Some" "(" MatchBinding ")"
  | "Result" "::" "Ok" "(" MatchBinding ")"
  | "Result" "::" "Err" "(" MatchBinding ")"
  | LegacyOptionalPattern
  | "_"
MatchBinding ::= Identifier | "_"

LegacyOptionalPattern ::=
    "None"
  | "Some" "(" Identifier ")"
  | "Some" "(" MatchTypeName ")"
MatchTypeName ::= "int" | "Int" | "float" | "Float" | "number" | "Number" | "bool" | "Bool" | "string" | "String" | "bytes" | "Bytes" | "array" | "Array" | "map" | "Map"
```

`MatchBinding` is a binding name or `_`, never a type test: `Option::Some(int)` binds a local named `int`. `Option::None` takes no payload, and `Option::None(x)` is rejected.

`LegacyOptionalPattern` is the retired optional-slot mechanism, kept here because the parser still accepts it. `Some(name)` binds a payload and needs a receiver that is a legacy optional slot, and `None` needs the same; a logical `Option` value is not an optional slot, so both fail with `Some(...) and None match patterns require an optional value`. `Some(TypeName)` is different: it carries no optional-slot precondition and compiles against any receiver, but it compares the receiver's runtime type name rather than a present payload, so the name it tests decides the result. An `Option` carrier is a `Value::Map` whose type name is `map`, so `Some(map)`/`Some(Map)` do match it, while `Some(int)`, `Some(float)`, `Some(bool)`, `Some(string)`, `Some(bytes)`, and `Some(array)` test the top-level value and are false against it; `Some(number)`/`Some(Number)` test two names, `int` or `float`, not one. `Some(_)` is rejected by the parser — `Some(_) is not supported; bind a name with Some(name)` — even though `_` sits in `Identifier` position here; only `Option::Some(_)` accepts a wildcard. All of them still need the trailing `_` arm. Legacy patterns cannot be mixed with constructor arms in one match, and the message names the constructor family: `Option match cannot mix constructor arms with value patterns` for an `Option` match, `Result match cannot mix constructor arms with value patterns` for a `Result` match. `Ok(...)`/`Err(...)` have no bare form at all — such an arm is a parse error.

An `Option` match is exhaustive with `Option::Some(binding)` and `Option::None`, and a `Result` match is exhaustive with `Result::Ok(binding)` and `Result::Err(binding)`. A wildcard may stand in for the absent branch when the present branch is a constructor arm. Nesting one constructor pattern inside another, and mixing `Option` and `Result` arms in the same match, are rejected; match the inner value in a second match instead. Literal matches still require a trailing `_` arm.

## Closures

```ebnf
ClosureExpr ::= "||" Expr | "|" ClosureParams? "|" Expr
ClosureParams ::= Identifier ("," Identifier)*
```

JavaScript-style arrow closures are not part of RustScript.
