/**
 * @file Fluke grammar for tree-sitter
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Mirrors the precedence climb in fluke/src/Parser.cs.
const PREC = {
  OR: 1,
  AND: 2,
  EQUALITY: 3,
  ADDITIVE: 4,
  MULTIPLICATIVE: 5,
  UNARY: 6,
  FIELD: 7,
};

/**
 * Zero or more comma-separated items with an optional trailing comma.
 * @param {RuleOrLiteral} rule
 */
function commaSep(rule) {
  return optional(seq(rule, repeat(seq(',', rule)), optional(',')));
}

export default grammar({
  name: 'fluke',

  extras: $ => [/\s/, $.line_comment, $.block_comment],

  word: $ => $.identifier,

  conflicts: $ => [
    // `x { ... }` may be a struct init or an identifier followed by a block
    // (e.g. the scrutinee of `if let ... = x { ... }`).
    [$._expression, $.struct_init],
    // `A.B { ... }` may be an enum variant init or a field access followed by a block.
    [$._expression, $.enum_variant_init],
    // A block-like expression at statement start may end the statement or
    // continue as an operand (`{ 1 } + 2;`), or be the block's tail.
    [$._block_like_statement, $._expression],
  ],

  rules: {
    source_file: $ => repeat($._statement),

    // -------------------------------------------------------------------------
    // Statements
    // -------------------------------------------------------------------------

    _statement: $ => choice(
      $.let_statement,
      $.assignment_statement,
      $.return_statement,
      $.expression_statement,
      $.function_declaration,
      $.struct_declaration,
      $.enum_declaration,
    ),

    // let name = value;
    let_statement: $ => seq(
      'let',
      field('name', $.identifier),
      '=',
      field('value', $._expression),
      ';',
    ),

    // target = value;
    assignment_statement: $ => seq(
      field('target', choice($.identifier, $.field_expression)),
      '=',
      field('value', $._expression),
      ';',
    ),

    return_statement: $ => seq('return', optional($._expression), ';'),

    // Block-like expressions (if, if let, blocks) may omit the trailing semicolon.
    expression_statement: $ => choice(
      seq($._expression, ';'),
      prec.dynamic(-1, $._block_like_statement),
    ),

    _block_like_statement: $ => choice($.if_expression, $.if_let_expression, $.block),

    // fn name(params): ReturnType { body }
    function_declaration: $ => seq(
      'fn',
      field('name', $.identifier),
      field('parameters', $.parameter_list),
      optional(seq(':', field('return_type', $.identifier))),
      field('body', $.block),
    ),

    parameter_list: $ => seq('(', commaSep($.parameter), ')'),

    // name: [ref] Type
    parameter: $ => seq(
      field('name', $.identifier),
      ':',
      optional($.ref_modifier),
      field('type', $.identifier),
    ),

    ref_modifier: _ => 'ref',

    // struct Name { field: Type, ... }
    struct_declaration: $ => seq(
      'struct',
      field('name', $.identifier),
      field('body', $.field_declaration_list),
    ),

    field_declaration_list: $ => seq('{', commaSep($.field_declaration), '}'),

    field_declaration: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $.identifier),
    ),

    // enum Name { Variant, Variant { field: Type }, ... }
    enum_declaration: $ => seq(
      'enum',
      field('name', $.identifier),
      field('body', $.enum_variant_list),
    ),

    enum_variant_list: $ => seq('{', commaSep($.enum_variant), '}'),

    enum_variant: $ => seq(
      field('name', $.identifier),
      optional(field('fields', $.field_declaration_list)),
    ),

    // -------------------------------------------------------------------------
    // Expressions
    // -------------------------------------------------------------------------

    _expression: $ => choice(
      $.integer_literal,
      $.boolean_literal,
      $.string_literal,
      $.identifier,
      $.parenthesized_expression,
      $.call_expression,
      $.intrinsic_call,
      $.struct_init,
      $.enum_variant_init,
      $.field_expression,
      $.unary_expression,
      $.binary_expression,
      $.if_expression,
      $.if_let_expression,
      $.block,
    ),

    parenthesized_expression: $ => seq('(', $._expression, ')'),

    call_expression: $ => seq(
      field('function', $.identifier),
      field('arguments', $.argument_list),
    ),

    // :name(args)
    intrinsic_call: $ => seq(
      ':',
      field('name', $.identifier),
      field('arguments', $.argument_list),
    ),

    argument_list: $ => seq('(', commaSep($._expression), ')'),

    // Name { field: value, ... }
    struct_init: $ => seq(
      field('name', $.identifier),
      field('body', $.field_initializer_list),
    ),

    // Enum.Variant { field: value, ... }
    enum_variant_init: $ => seq(
      field('enum', $.identifier),
      '.',
      field('variant', $.identifier),
      field('body', $.field_initializer_list),
    ),

    field_initializer_list: $ => seq('{', commaSep($.field_initializer), '}'),

    field_initializer: $ => seq(
      field('name', $.identifier),
      ':',
      field('value', $._expression),
    ),

    field_expression: $ => prec(PREC.FIELD, seq(
      field('value', $._expression),
      '.',
      field('field', $.identifier),
    )),

    unary_expression: $ => prec(PREC.UNARY, seq(
      field('operator', choice('-', '!')),
      field('operand', $._expression),
    )),

    binary_expression: $ => {
      const table = [
        [PREC.OR, '||'],
        [PREC.AND, '&&'],
        [PREC.EQUALITY, choice('==', '!=')],
        [PREC.ADDITIVE, choice('+', '-')],
        [PREC.MULTIPLICATIVE, choice('*', '/')],
      ];

      return choice(...table.map(([precedence, operator]) => prec.left(
        /** @type {number} */ (precedence),
        seq(
          field('left', $._expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._expression),
        ),
      )));
    },

    // if cond then { ... } [else { ... } | else if ...]
    if_expression: $ => prec.right(seq(
      'if',
      field('condition', $._expression),
      'then',
      field('consequence', $.block),
      optional(seq(
        'else',
        field('alternative', choice($.block, $.if_expression)),
      )),
    )),

    // if let Enum.Variant { bindings } = value { ... } [else { ... }]
    if_let_expression: $ => prec.right(seq(
      'if',
      'let',
      field('pattern', $.variant_pattern),
      '=',
      field('value', $._expression),
      field('consequence', $.block),
      optional(seq('else', field('alternative', $.block))),
    )),

    variant_pattern: $ => seq(
      field('enum', $.identifier),
      '.',
      field('variant', $.identifier),
      optional(field('bindings', $.binding_list)),
    ),

    binding_list: $ => seq('{', commaSep($.identifier), '}'),

    // { statements... [tail] }
    block: $ => seq(
      '{',
      repeat($._statement),
      optional(field('tail', $._expression)),
      '}',
    ),

    // -------------------------------------------------------------------------
    // Terminals
    // -------------------------------------------------------------------------

    identifier: _ => /[\p{L}_][\p{L}\p{Nd}_]*/,

    integer_literal: _ => /\d+/,

    boolean_literal: _ => choice('true', 'false'),

    string_literal: _ => /"[^"\r\n]*"/,

    line_comment: _ => token(seq('//', /[^\r\n]*/)),

    block_comment: _ => token(seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/')),
  },
});
