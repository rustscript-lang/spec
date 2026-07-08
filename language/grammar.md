# Grammar Sketch

This is a compact grammar sketch for the RustScript syntax implemented in `project-d`. It is not a parser generator input.

Notation:

- quoted text is a literal token
- `?` means optional
- `*` means zero or more
- `+` means one or more
- `|` means alternatives

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
ReturnType ::= "->" Type "?"?
FunctionBlock ::= "{" BlockStmt* TrailingExpr "}"

LetStmt ::= "let" "mut"? Identifier (":" Type)? "=" Expr
Assignment ::= Identifier ("=" | "+=") Expr
Increment ::= "++" Identifier | Identifier "++"

IfStmt ::= "if" Expr Block ("else" (IfStmt | Block))?
WhileStmt ::= "while" Expr Block
ForStmt ::= "for" "(" ForInit ";" Expr ";" ForPost ")" Block
ForInit ::= LetStmt | Assignment | Increment | Expr
ForPost ::= Assignment | Increment | Expr
Block ::= "{" Statement* "}"
```

## Types

```ebnf
Type ::=
    PrimitiveType OptionalSuffix? ArrayAlias*
  | NamedType OptionalSuffix? ArrayAlias*
  | ArrayType OptionalSuffix? ArrayAlias*
  | CallableType OptionalSuffix? ArrayAlias*
  | "null" OptionalSuffix? ArrayAlias*

PrimitiveType ::= "unknown" | "int" | "float" | "number" | "bool" | "string" | "bytes"
NamedType ::= Identifier TypeArgs?
TypeArgs ::= "<" Type ("," Type)* ">"
OptionalSuffix ::= "?"
ArrayAlias ::= "[" "]"

ArrayType ::=
    "array" ("<" Type ">")?
  | "[" ArrayTypeItems "]"

ArrayTypeItems ::= Type | Type "," TypeListRest? | Type "..."
TypeListRest ::= Type ("," Type)* ("," Type "...")?

CallableType ::= "fn" "(" TypeList? ")" "->" Type
TypeList ::= Type ("," Type)*
```

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
  | "++"
```

The implementation applies postfix operations inside `PrimaryExpr`; this sketch separates them for readability.

## Literals and collections

```ebnf
Literal ::= "null" | "true" | "false" | IntLiteral | FloatLiteral | StringLiteral | BytesLiteral

ArrayLiteral ::= "[" (Expr ("," Expr)* ","?)? "]"
BraceLiteral ::= "{" (BraceEntry ("," BraceEntry)* ","?)? "}"
BraceEntry ::= Expr | MapEntry
MapEntry ::= MapKey (":" | "=") Expr
MapKey ::= Identifier | StringLiteral | BytesLiteral | IntLiteral | FloatLiteral | "true" | "false" | "null" | "[" Expr "]"
```

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
  | "null"
  | "None"
  | "Option" "::" "None"
  | "Some" "(" Identifier ")"
  | "Some" "(" MatchTypeName ")"
  | "_"
MatchTypeName ::= "int" | "Int" | "float" | "Float" | "number" | "Number" | "bool" | "Bool" | "string" | "String" | "bytes" | "Bytes" | "array" | "Array" | "map" | "Map"
```

## Closures

```ebnf
ClosureExpr ::= "||" Expr | "|" ClosureParams? "|" Expr
ClosureParams ::= Identifier ("," Identifier)*
```

The RustScript dialect does not enable JavaScript-style arrow closures; those are parser infrastructure for other frontends.
