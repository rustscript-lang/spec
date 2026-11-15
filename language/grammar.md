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

Both `Result` parameters are required. `None` has no payload from which to infer its parameter, so it needs an `Option<T>` annotation or another contextual type.

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
  | OptionSome
  | OptionNone
  | Identifier CallSuffix?
  | Identifier "::" PathSegments TypeCallArgs? "(" ArgList? ")"
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
OptionSome ::= "Some" "(" Expr ")"
OptionNone ::= "None"
ResultOk ::= "Result" "::" "Ok" "(" Expr ")"
ResultErr ::= "Result" "::" "Err" "(" Expr ")"
UnitValue ::= "(" ")"
```

In RustScript, `Some` and `None` are reserved constructor names in expression and pattern positions. The lexer still recognizes identifier tokens for them; the parser interprets them contextually. Neither may name an ordinary variable. Member names such as `obj.None` and quoted keys such as `{"None": 1}` remain available. `Option::Some` and `Option::None` are removed from RustScript's constructor syntax; other parser dialects retain their own behavior. `Result::Ok` and `Result::Err` remain namespace-qualified constructor calls covered by `PrimaryExpr`'s namespace-call form. Bare `Ok(...)` and `Err(...)` are not constructors or match patterns.

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
  | "None"
  | "Some" "(" MatchBinding ")"
  | "Result" "::" "Ok" "(" MatchBinding ")"
  | "Result" "::" "Err" "(" MatchBinding ")"
  | "_"
MatchBinding ::= Identifier | "_"
```

`MatchBinding` is a binding name or `_`, never a type test: `Some(int)` binds a local named `int`. `None` takes no payload. These bare patterns match the logical `Option` variants, not a legacy optional slot. `Some(TypeName)` has no type-test meaning in RustScript: when the name is allowed as a binding, it binds the payload. For example, `Some(String)` binds a local named `String`.

In other parser dialects, the legacy optional-slot patterns retain their behavior: `Some(name)` binds a present legacy optional-slot payload and `None` matches its absence. Their `Some(TypeName)` form is a runtime type-name test on the receiver, with no optional-slot precondition; it requires a trailing `_` arm. For a logical `Option` carrier, the top-level type is `map`: `Some(map)`/`Some(Map)` test that carrier type, while `Some(int)` and other payload type names test the carrier rather than the nested payload. `Some(number)`/`Some(Number)` test runtime `int` or `float`. This legacy interpretation does not apply in RustScript.

An `Option` match is exhaustive with `Some(binding)` and `None`, and a `Result` match is exhaustive with `Result::Ok(binding)` and `Result::Err(binding)`. A wildcard may stand in for the absent branch when the present branch is a constructor arm. Nesting one constructor pattern inside another, and mixing `Option` and `Result` arms in the same match, are rejected; match the inner value in a second match instead. Literal matches still require a trailing `_` arm.

## Closures

```ebnf
ClosureExpr ::= "||" Expr | "|" ClosureParams? "|" Expr
ClosureParams ::= Identifier ("," Identifier)*
```

JavaScript-style arrow closures are not part of RustScript.
