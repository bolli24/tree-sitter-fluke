; Keywords
"fn" @keyword.function
"struct" @keyword.type
"enum" @keyword.type
"let" @keyword
(ref_modifier) @keyword.modifier
"return" @keyword.return
"if" @keyword.conditional
"then" @keyword.conditional
"else" @keyword.conditional

; Declarations
(function_declaration name: (identifier) @function)
(struct_declaration name: (identifier) @type.definition)
(enum_declaration name: (identifier) @type.definition)
(enum_variant name: (identifier) @constant)

; Types
(parameter type: (identifier) @type)
(field_declaration type: (identifier) @type)
(function_declaration return_type: (identifier) @type)

; Struct / enum construction and patterns
(struct_init name: (identifier) @type)
(enum_variant_init enum: (identifier) @type)
(enum_variant_init variant: (identifier) @constant)
(variant_pattern enum: (identifier) @type)
(variant_pattern variant: (identifier) @constant)
(binding_list (identifier) @variable)

; Variables and fields
(let_statement name: (identifier) @variable)
(parameter name: (identifier) @variable.parameter)
(field_declaration name: (identifier) @variable.member)
(field_initializer name: (identifier) @variable.member)
(field_expression field: (identifier) @variable.member)

; Calls
(call_expression function: (identifier) @function.call)
(intrinsic_call ":" @function.builtin)
(intrinsic_call name: (identifier) @function.builtin)

; Literals
(integer_literal) @number
(boolean_literal) @boolean
(string_literal) @string

; Comments
(line_comment) @comment
(block_comment) @comment

; Operators
[
  "+"
  "-"
  "*"
  "/"
  "!"
  "=="
  "!="
  "&&"
  "||"
  "="
] @operator

; Punctuation
["(" ")" "{" "}"] @punctuation.bracket
["," "." ";" ":"] @punctuation.delimiter
