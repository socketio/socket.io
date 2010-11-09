var a = 1, b = 1, c = 1, d = 1;

/* TOK_OR */
x = a || b || c;
x = a || b || c || d;

/* TOK_AND */
x = a && b && c;
x = a && b && c && d;

x = a && b || c;

x = a || b && c;

// TOK_BITOR
x = a | b | c;
x = a | b | c | d;

// TOK_BITXOR
x = a ^ b ^ c;
x = a ^ b ^ c ^ d;

// TOK_BITAND
x = a & b & c;
x = a & b & c & d;

// TOK_EQUOP
x = a == b;
x = a != b;
x = a === b;
x = a !== b;

// TOK_RELOP
x = a < b;
x = a <= b;
x = a > b;
x = a >= b;

// TOK_SHOP
x = a << b;
x = a >> b;
x = a >>> b;

/* TOK_PLUS, TOK_MINUS */
x = a + b;
x = a + b + c;
x = a + b + c + d;
x = a - b;

// TOK_STAR, TOK_DIVOP
x = a * b;
x = a * b * c;
x = a * b * c * d;
x = a / b;
x = a % b;
