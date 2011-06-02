module("equiv");


test("Primitive types and constants", function () {
    equals(QUnit.equiv(null, null), true, "null");
    equals(QUnit.equiv(null, {}), false, "null");
    equals(QUnit.equiv(null, undefined), false, "null");
    equals(QUnit.equiv(null, 0), false, "null");
    equals(QUnit.equiv(null, false), false, "null");
    equals(QUnit.equiv(null, ''), false, "null");
    equals(QUnit.equiv(null, []), false, "null");

    equals(QUnit.equiv(undefined, undefined), true, "undefined");
    equals(QUnit.equiv(undefined, null), false, "undefined");
    equals(QUnit.equiv(undefined, 0), false, "undefined");
    equals(QUnit.equiv(undefined, false), false, "undefined");
    equals(QUnit.equiv(undefined, {}), false, "undefined");
    equals(QUnit.equiv(undefined, []), false, "undefined");
    equals(QUnit.equiv(undefined, ""), false, "undefined");

    // Nan usually doest not equal to Nan using the '==' operator.
    // Only isNaN() is able to do it.
    equals(QUnit.equiv(0/0, 0/0), true, "NaN"); // NaN VS NaN
    equals(QUnit.equiv(1/0, 2/0), true, "Infinity"); // Infinity VS Infinity
    equals(QUnit.equiv(-1/0, 2/0), false, "-Infinity, Infinity"); // -Infinity VS Infinity
    equals(QUnit.equiv(-1/0, -2/0), true, "-Infinity, -Infinity"); // -Infinity VS -Infinity
    equals(QUnit.equiv(0/0, 1/0), false, "NaN, Infinity"); // Nan VS Infinity
    equals(QUnit.equiv(1/0, 0/0), false, "NaN, Infinity"); // Nan VS Infinity
    equals(QUnit.equiv(0/0, null), false, "NaN");
    equals(QUnit.equiv(0/0, undefined), false, "NaN");
    equals(QUnit.equiv(0/0, 0), false, "NaN");
    equals(QUnit.equiv(0/0, false), false, "NaN");
    equals(QUnit.equiv(0/0, function () {}), false, "NaN");
    equals(QUnit.equiv(1/0, null), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, undefined), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, 0), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, 1), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, false), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, true), false, "NaN, Infinity");
    equals(QUnit.equiv(1/0, function () {}), false, "NaN, Infinity");

    equals(QUnit.equiv(0, 0), true, "number");
    equals(QUnit.equiv(0, 1), false, "number");
    equals(QUnit.equiv(1, 0), false, "number");
    equals(QUnit.equiv(1, 1), true, "number");
    equals(QUnit.equiv(1.1, 1.1), true, "number");
    equals(QUnit.equiv(0.0000005, 0.0000005), true, "number");
    equals(QUnit.equiv(0, ''), false, "number");
    equals(QUnit.equiv(0, '0'), false, "number");
    equals(QUnit.equiv(1, '1'), false, "number");
    equals(QUnit.equiv(0, false), false, "number");
    equals(QUnit.equiv(1, true), false, "number");

    equals(QUnit.equiv(true, true), true, "boolean");
    equals(QUnit.equiv(true, false), false, "boolean");
    equals(QUnit.equiv(false, true), false, "boolean");
    equals(QUnit.equiv(false, 0), false, "boolean");
    equals(QUnit.equiv(false, null), false, "boolean");
    equals(QUnit.equiv(false, undefined), false, "boolean");
    equals(QUnit.equiv(true, 1), false, "boolean");
    equals(QUnit.equiv(true, null), false, "boolean");
    equals(QUnit.equiv(true, undefined), false, "boolean");

    equals(QUnit.equiv('', ''), true, "string");
    equals(QUnit.equiv('a', 'a'), true, "string");
    equals(QUnit.equiv("foobar", "foobar"), true, "string");
    equals(QUnit.equiv("foobar", "foo"), false, "string");
    equals(QUnit.equiv('', 0), false, "string");
    equals(QUnit.equiv('', false), false, "string");
    equals(QUnit.equiv('', null), false, "string");
    equals(QUnit.equiv('', undefined), false, "string");
    
    // Short annotation VS new annotation
    equals(QUnit.equiv(0, new Number()), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Number(), 0), true, "short annotation VS new annotation");
    equals(QUnit.equiv(1, new Number(1)), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Number(1), 1), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Number(0), 1), false, "short annotation VS new annotation");
    equals(QUnit.equiv(0, new Number(1)), false, "short annotation VS new annotation");

    equals(QUnit.equiv(new String(), ""), true, "short annotation VS new annotation");
    equals(QUnit.equiv("", new String()), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new String("My String"), "My String"), true, "short annotation VS new annotation");
    equals(QUnit.equiv("My String", new String("My String")), true, "short annotation VS new annotation");
    equals(QUnit.equiv("Bad String", new String("My String")), false, "short annotation VS new annotation");
    equals(QUnit.equiv(new String("Bad String"), "My String"), false, "short annotation VS new annotation");

    equals(QUnit.equiv(false, new Boolean()), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Boolean(), false), true, "short annotation VS new annotation");
    equals(QUnit.equiv(true, new Boolean(true)), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Boolean(true), true), true, "short annotation VS new annotation");
    equals(QUnit.equiv(true, new Boolean(1)), true, "short annotation VS new annotation");
    equals(QUnit.equiv(false, new Boolean(false)), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Boolean(false), false), true, "short annotation VS new annotation");
    equals(QUnit.equiv(false, new Boolean(0)), true, "short annotation VS new annotation");
    equals(QUnit.equiv(true, new Boolean(false)), false, "short annotation VS new annotation");
    equals(QUnit.equiv(new Boolean(false), true), false, "short annotation VS new annotation");

    equals(QUnit.equiv(new Object(), {}), true, "short annotation VS new annotation");
    equals(QUnit.equiv({}, new Object()), true, "short annotation VS new annotation");
    equals(QUnit.equiv(new Object(), {a:1}), false, "short annotation VS new annotation");
    equals(QUnit.equiv({a:1}, new Object()), false, "short annotation VS new annotation");
    equals(QUnit.equiv({a:undefined}, new Object()), false, "short annotation VS new annotation");
    equals(QUnit.equiv(new Object(), {a:undefined}), false, "short annotation VS new annotation");
});

test("Objects Basics.", function() {
    equals(QUnit.equiv({}, {}), true);
    equals(QUnit.equiv({}, null), false);
    equals(QUnit.equiv({}, undefined), false);
    equals(QUnit.equiv({}, 0), false);
    equals(QUnit.equiv({}, false), false);

    // This test is a hard one, it is very important
    // REASONS:
    //      1) They are of the same type "object"
    //      2) [] instanceof Object is true
    //      3) Their properties are the same (doesn't exists)
    equals(QUnit.equiv({}, []), false);

    equals(QUnit.equiv({a:1}, {a:1}), true);
    equals(QUnit.equiv({a:1}, {a:"1"}), false);
    equals(QUnit.equiv({a:[]}, {a:[]}), true);
    equals(QUnit.equiv({a:{}}, {a:null}), false);
    equals(QUnit.equiv({a:1}, {}), false);
    equals(QUnit.equiv({}, {a:1}), false);

    // Hard ones
    equals(QUnit.equiv({a:undefined}, {}), false);
    equals(QUnit.equiv({}, {a:undefined}), false);
    equals(QUnit.equiv(
        {
            a: [{ bar: undefined }]
        },
        {
            a: [{ bat: undefined }]
        }
    ), false);
});


test("Arrays Basics.", function() {

    equals(QUnit.equiv([], []), true);

    // May be a hard one, can invoke a crash at execution.
    // because their types are both "object" but null isn't
    // like a true object, it doesn't have any property at all.
    equals(QUnit.equiv([], null), false);

    equals(QUnit.equiv([], undefined), false);
    equals(QUnit.equiv([], false), false);
    equals(QUnit.equiv([], 0), false);
    equals(QUnit.equiv([], ""), false);

    // May be a hard one, but less hard
    // than {} with [] (note the order)
    equals(QUnit.equiv([], {}), false);

    equals(QUnit.equiv([null],[]), false);
    equals(QUnit.equiv([undefined],[]), false);
    equals(QUnit.equiv([],[null]), false);
    equals(QUnit.equiv([],[undefined]), false);
    equals(QUnit.equiv([null],[undefined]), false);
    equals(QUnit.equiv([[]],[[]]), true);
    equals(QUnit.equiv([[],[],[]],[[],[],[]]), true);
    equals(QUnit.equiv(
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]],
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]),
                            true);
    equals(QUnit.equiv(
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]],
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]), // shorter
                            false);
    equals(QUnit.equiv(
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[{}]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]],
                            [[],[],[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]), // deepest element not an array
                            false);

    // same multidimensional
    equals(QUnit.equiv(
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,4,[
                                                        1,2,[
                                                            1,2,3,4,[
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]],
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,4,[
                                                        1,2,[
                                                            1,2,3,4,[
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]]),
                            true, "Multidimensional");

    // different multidimensional
    equals(QUnit.equiv(
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,4,[
                                                        1,2,[
                                                            1,2,3,4,[
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]],
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,4,[
                                                        1,2,[
                                                            '1',2,3,4,[                 // string instead of number
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]]),
                            false, "Multidimensional");

    // different multidimensional
    equals(QUnit.equiv(
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,4,[
                                                        1,2,[
                                                            1,2,3,4,[
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]],
                            [1,2,3,4,5,6,7,8,9, [
                                1,2,3,4,5,6,7,8,9, [
                                    1,2,3,4,5,[
                                        [6,7,8,9, [
                                            [
                                                1,2,3,4,[
                                                    2,3,[                   // missing an element (4)
                                                        1,2,[
                                                            1,2,3,4,[
                                                                1,2,3,4,5,6,7,8,9,[
                                                                    0
                                                                ],1,2,3,4,5,6,7,8,9
                                                            ],5,6,7,8,9
                                                        ],4,5,6,7,8,9
                                                    ],5,6,7,8,9
                                                ],5,6,7
                                            ]
                                        ]
                                    ]
                                ]
                            ]]]),
                            false, "Multidimensional");
});

test("Functions.", function() {
    var f0 = function () {};
    var f1 = function () {};

    // f2 and f3 have the same code, formatted differently
    var f2 = function () {var i = 0;};
    var f3 = function () {
        var i = 0 // this comment and no semicoma as difference
    };

    equals(QUnit.equiv(function() {}, function() {}), false, "Anonymous functions"); // exact source code
    equals(QUnit.equiv(function() {}, function() {return true;}), false, "Anonymous functions");

    equals(QUnit.equiv(f0, f0), true, "Function references"); // same references
    equals(QUnit.equiv(f0, f1), false, "Function references"); // exact source code, different references
    equals(QUnit.equiv(f2, f3), false, "Function references"); // equivalent source code, different references
    equals(QUnit.equiv(f1, f2), false, "Function references"); // different source code, different references
    equals(QUnit.equiv(function() {}, true), false);
    equals(QUnit.equiv(function() {}, undefined), false);
    equals(QUnit.equiv(function() {}, null), false);
    equals(QUnit.equiv(function() {}, {}), false);
});


test("Date instances.", function() {
    // Date, we don't need to test Date.parse() because it returns a number.
    // Only test the Date instances by setting them a fix date.
    // The date use is midnight January 1, 1970
    
    var d1 = new Date();
    d1.setTime(0); // fix the date

    var d2 = new Date();
    d2.setTime(0); // fix the date

    var d3 = new Date(); // The very now

    // Anyway their types differs, just in case the code fails in the order in which it deals with date
    equals(QUnit.equiv(d1, 0), false); // d1.valueOf() returns 0, but d1 and 0 are different
    // test same values date and different instances equality
    equals(QUnit.equiv(d1, d2), true);
    // test different date and different instances difference
    equals(QUnit.equiv(d1, d3), false);
});


test("RegExp.", function() {
    // Must test cases that imply those traps:
    // var a = /./;
    // a instanceof Object;        // Oops
    // a instanceof RegExp;        // Oops
    // typeof a === "function";    // Oops, false in IE and Opera, true in FF and Safari ("object")

    // Tests same regex with same modifiers in different order
    var r = /foo/;
    var r5 = /foo/gim;
    var r6 = /foo/gmi;
    var r7 = /foo/igm;
    var r8 = /foo/img;
    var r9 = /foo/mig;
    var r10 = /foo/mgi;
    var ri1 = /foo/i;
    var ri2 = /foo/i;
    var rm1 = /foo/m;
    var rm2 = /foo/m;
    var rg1 = /foo/g;
    var rg2 = /foo/g;

    equals(QUnit.equiv(r5, r6), true, "Modifier order");
    equals(QUnit.equiv(r5, r7), true, "Modifier order");
    equals(QUnit.equiv(r5, r8), true, "Modifier order");
    equals(QUnit.equiv(r5, r9), true, "Modifier order");
    equals(QUnit.equiv(r5, r10), true, "Modifier order");
    equals(QUnit.equiv(r, r5), false, "Modifier");

    equals(QUnit.equiv(ri1, ri2), true, "Modifier");
    equals(QUnit.equiv(r, ri1), false, "Modifier");
    equals(QUnit.equiv(ri1, rm1), false, "Modifier");
    equals(QUnit.equiv(r, rm1), false, "Modifier");
    equals(QUnit.equiv(rm1, ri1), false, "Modifier");
    equals(QUnit.equiv(rm1, rm2), true, "Modifier");
    equals(QUnit.equiv(rg1, rm1), false, "Modifier");
    equals(QUnit.equiv(rm1, rg1), false, "Modifier");
    equals(QUnit.equiv(rg1, rg2), true, "Modifier");

    // Different regex, same modifiers
    var r11 = /[a-z]/gi;
    var r13 = /[0-9]/gi; // oops! different
    equals(QUnit.equiv(r11, r13), false, "Regex pattern");

    var r14 = /0/ig;
    var r15 = /"0"/ig; // oops! different
    equals(QUnit.equiv(r14, r15), false, "Regex pattern");

    var r1 = /[\n\r\u2028\u2029]/g;
    var r2 = /[\n\r\u2028\u2029]/g;
    var r3 = /[\n\r\u2028\u2028]/g; // differs from r1
    var r4 = /[\n\r\u2028\u2029]/;  // differs from r1

    equals(QUnit.equiv(r1, r2), true, "Regex pattern");
    equals(QUnit.equiv(r1, r3), false, "Regex pattern");
    equals(QUnit.equiv(r1, r4), false, "Regex pattern");

    // More complex regex
    var regex1 = "^[-_.a-z0-9]+@([-_a-z0-9]+\\.)+([A-Za-z][A-Za-z]|[A-Za-z][A-Za-z][A-Za-z])|(([0-9][0-9]?|[0-1][0-9][0-9]|[2][0-4][0-9]|[2][5][0-5]))$";
    var regex2 = "^[-_.a-z0-9]+@([-_a-z0-9]+\\.)+([A-Za-z][A-Za-z]|[A-Za-z][A-Za-z][A-Za-z])|(([0-9][0-9]?|[0-1][0-9][0-9]|[2][0-4][0-9]|[2][5][0-5]))$";
    // regex 3 is different: '.' not escaped
    var regex3 = "^[-_.a-z0-9]+@([-_a-z0-9]+.)+([A-Za-z][A-Za-z]|[A-Za-z][A-Za-z][A-Za-z])|(([0-9][0-9]?|[0-1][0-9][0-9]|[2][0-4][0-9]|[2][5][0-5]))$";

    var r21 = new RegExp(regex1);
    var r22 = new RegExp(regex2);
    var r23 = new RegExp(regex3); // diff from r21, not same pattern
    var r23a = new RegExp(regex3, "gi"); // diff from r23, not same modifier
    var r24a = new RegExp(regex3, "ig"); // same as r23a

    equals(QUnit.equiv(r21, r22), true, "Complex Regex");
    equals(QUnit.equiv(r21, r23), false, "Complex Regex");
    equals(QUnit.equiv(r23, r23a), false, "Complex Regex");
    equals(QUnit.equiv(r23a, r24a), true, "Complex Regex");

    // typeof r1 is "function" in some browsers and "object" in others so we must cover this test
    var re = / /;
    equals(QUnit.equiv(re, function () {}), false, "Regex internal");
    equals(QUnit.equiv(re, {}), false, "Regex internal");
});


test("Complex Objects.", function() {

    function fn1() {
        return "fn1";
    }
    function fn2() {
        return "fn2";
    }
    
    // Try to invert the order of some properties to make sure it is covered.
    // It can failed when properties are compared between unsorted arrays.
    equals(QUnit.equiv(
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                q: [],
                                p: 1/0,
                                o: 99
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    d: 0,
                    i: true,
                    h: "false"
                }
            },
            e: undefined,
            g: "",
            h: "h",
            f: {},
            i: []
        },
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                b: false,
                a: 3.14159,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    t: undefined,
                                    u: 0,
                                    s: [1,2,3],
                                    v: {
                                        w: {
                                            x: {
                                                z: null,
                                                y: "Yahoo!"
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    i: true,
                    h: "false"
                }
            },
            e: undefined,
            g: "",
            f: {},
            h: "h",
            i: []
        }
    ), true);

    equals(QUnit.equiv(
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    //r: "r",   // different: missing a property
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        },
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        }
    ), false);

    equals(QUnit.equiv(
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        },
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    //t: undefined,                 // different: missing a property with an undefined value
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        }
    ), false);

    equals(QUnit.equiv(
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        },
        {
            a: 1,
            b: null,
            c: [{}],
            d: {
                a: 3.14159,
                b: false,
                c: {
                    d: 0,
                    e: fn1,
                    f: [[[]]],
                    g: {
                        j: {
                            k: {
                                n: {
                                    r: "r",
                                    s: [1,2,3],
                                    t: undefined,
                                    u: 0,
                                    v: {
                                        w: {
                                            x: {
                                                y: "Yahoo!",
                                                z: null
                                            }
                                        }
                                    }
                                },
                                o: 99,
                                p: 1/0,
                                q: {}           // different was []
                            },
                            l: undefined,
                            m: null
                        }
                    },
                    h: "false",
                    i: true
                }
            },
            e: undefined,
            f: {},
            g: "",
            h: "h",
            i: []
        }
    ), false);

    var same1 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3]],
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var same2 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3]],
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var diff1 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3,4]], // different: 4 was add to the array
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var diff2 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3]],
                newprop: undefined, // different: newprop was added
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var diff3 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3]],
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ α" // different: missing last char
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var diff4 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,undefined,{}, [], [1,2,3]], // different: undefined instead of null
                bar: undefined
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    var diff5 = {
        a: [
            "string", null, 0, "1", 1, {
                prop: null,
                foo: [1,2,null,{}, [], [1,2,3]],
                bat: undefined // different: property name not "bar"
            }, 3, "Hey!", "Κάνε πάντα γνωρίζουμε ας των, μηχανής επιδιόρθωσης επιδιορθώσεις ώς μια. Κλπ ας"
        ],
        unicode: "老 汉语中存在 港澳和海外的华人圈中 贵州 我去了书店 现在尚有争",
        b: "b",
        c: fn1
    };

    equals(QUnit.equiv(same1, same2), true);
    equals(QUnit.equiv(same2, same1), true);
    equals(QUnit.equiv(same2, diff1), false);
    equals(QUnit.equiv(diff1, same2), false);

    equals(QUnit.equiv(same1, diff1), false);
    equals(QUnit.equiv(same1, diff2), false);
    equals(QUnit.equiv(same1, diff3), false);
    equals(QUnit.equiv(same1, diff3), false);
    equals(QUnit.equiv(same1, diff4), false);
    equals(QUnit.equiv(same1, diff5), false);
    equals(QUnit.equiv(diff5, diff1), false);
});


test("Complex Arrays.", function() {

    function fn() {
    }

    equals(QUnit.equiv(
                [1, 2, 3, true, {}, null, [
                    {
                        a: ["", '1', 0]
                    },
                    5, 6, 7
                ], "foo"],
                [1, 2, 3, true, {}, null, [
                    {
                        a: ["", '1', 0]
                    },
                    5, 6, 7
                ], "foo"]),
            true);

    equals(QUnit.equiv(
                [1, 2, 3, true, {}, null, [
                    {
                        a: ["", '1', 0]
                    },
                    5, 6, 7
                ], "foo"],
                [1, 2, 3, true, {}, null, [
                    {
                        b: ["", '1', 0]         // not same property name
                    },
                    5, 6, 7
                ], "foo"]),
            false);

    var a = [{
        b: fn,
        c: false,
        "do": "reserved word",
        "for": {
            ar: [3,5,9,"hey!", [], {
                ar: [1,[
                    3,4,6,9, null, [], []
                ]],
                e: fn,
                f: undefined
            }]
        },
        e: 0.43445
    }, 5, "string", 0, fn, false, null, undefined, 0, [
        4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[3]]]], "3"], {}, 1/0
    ], [], [[[], "foo", null, {
        n: 1/0,
        z: {
            a: [3,4,5,6,"yep!", undefined, undefined],
            b: {}
        }
    }, {}]]];

    equals(QUnit.equiv(a,
            [{
                b: fn,
                c: false,
                "do": "reserved word",
                "for": {
                    ar: [3,5,9,"hey!", [], {
                        ar: [1,[
                            3,4,6,9, null, [], []
                        ]],
                        e: fn,
                        f: undefined
                    }]
                },
                e: 0.43445
            }, 5, "string", 0, fn, false, null, undefined, 0, [
                4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[3]]]], "3"], {}, 1/0
            ], [], [[[], "foo", null, {
                n: 1/0,
                z: {
                    a: [3,4,5,6,"yep!", undefined, undefined],
                    b: {}
                }
            }, {}]]]), true);

    equals(QUnit.equiv(a,
            [{
                b: fn,
                c: false,
                "do": "reserved word",
                "for": {
                    ar: [3,5,9,"hey!", [], {
                        ar: [1,[
                            3,4,6,9, null, [], []
                        ]],
                        e: fn,
                        f: undefined
                    }]
                },
                e: 0.43445
            }, 5, "string", 0, fn, false, null, undefined, 0, [
                4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[2]]]], "3"], {}, 1/0    // different: [[[[[2]]]]] instead of [[[[[3]]]]]
            ], [], [[[], "foo", null, {
                n: 1/0,
                z: {
                    a: [3,4,5,6,"yep!", undefined, undefined],
                    b: {}
                }
            }, {}]]]), false);

    equals(QUnit.equiv(a,
            [{
                b: fn,
                c: false,
                "do": "reserved word",
                "for": {
                    ar: [3,5,9,"hey!", [], {
                        ar: [1,[
                            3,4,6,9, null, [], []
                        ]],
                        e: fn,
                        f: undefined
                    }]
                },
                e: 0.43445
            }, 5, "string", 0, fn, false, null, undefined, 0, [
                4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[3]]]], "3"], {}, 1/0
            ], [], [[[], "foo", null, {
                n: -1/0,                                                                // different, -Infinity instead of Infinity
                z: {
                    a: [3,4,5,6,"yep!", undefined, undefined],
                    b: {}
                }
            }, {}]]]), false);

    equals(QUnit.equiv(a,
            [{
                b: fn,
                c: false,
                "do": "reserved word",
                "for": {
                    ar: [3,5,9,"hey!", [], {
                        ar: [1,[
                            3,4,6,9, null, [], []
                        ]],
                        e: fn,
                        f: undefined
                    }]
                },
                e: 0.43445
            }, 5, "string", 0, fn, false, null, undefined, 0, [
                4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[3]]]], "3"], {}, 1/0
            ], [], [[[], "foo", {                                                       // different: null is missing
                n: 1/0,
                z: {
                    a: [3,4,5,6,"yep!", undefined, undefined],
                    b: {}
                }
            }, {}]]]), false);

    equals(QUnit.equiv(a,
            [{
                b: fn,
                c: false,
                "do": "reserved word",
                "for": {
                    ar: [3,5,9,"hey!", [], {
                        ar: [1,[
                            3,4,6,9, null, [], []
                        ]],
                        e: fn
                                                                                // different: missing property f: undefined
                    }]
                },
                e: 0.43445
            }, 5, "string", 0, fn, false, null, undefined, 0, [
                4,5,6,7,8,9,11,22,33,44,55,"66", null, [], [[[[[3]]]], "3"], {}, 1/0
            ], [], [[[], "foo", null, {
                n: 1/0,
                z: {
                    a: [3,4,5,6,"yep!", undefined, undefined],
                    b: {}
                }
            }, {}]]]), false);
});


test("Prototypal inheritance", function() {
    function Gizmo(id) {
        this.id = id;
    }

    function Hoozit(id) {
        this.id = id;
    }
    Hoozit.prototype = new Gizmo();

    var gizmo = new Gizmo("ok");
    var hoozit = new Hoozit("ok");

    // Try this test many times after test on instances that hold function
    // to make sure that our code does not mess with last object constructor memoization.
    equals(QUnit.equiv(function () {}, function () {}), false);

    // Hoozit inherit from Gizmo
    // hoozit instanceof Hoozit; // true
    // hoozit instanceof Gizmo; // true
    equals(QUnit.equiv(hoozit, gizmo), true);

    Gizmo.prototype.bar = true; // not a function just in case we skip them

    // Hoozit inherit from Gizmo
    // They are equivalent
    equals(QUnit.equiv(hoozit, gizmo), true);

    // Make sure this is still true !important
    // The reason for this is that I forgot to reset the last
    // caller to where it were called from.
    equals(QUnit.equiv(function () {}, function () {}), false);

    // Make sure this is still true !important
    equals(QUnit.equiv(hoozit, gizmo), true);

    Hoozit.prototype.foo = true; // not a function just in case we skip them

    // Gizmo does not inherit from Hoozit
    // gizmo instanceof Gizmo; // true
    // gizmo instanceof Hoozit; // false
    // They are not equivalent
    equals(QUnit.equiv(hoozit, gizmo), false);

    // Make sure this is still true !important
    equals(QUnit.equiv(function () {}, function () {}), false);
});


test("Instances", function() {
    function A() {} 
    var a1 = new A(); 
    var a2 = new A(); 

    function B() {
        this.fn = function () {};
    } 
    var b1 = new B(); 
    var b2 = new B(); 

    equals(QUnit.equiv(a1, a2), true, "Same property, same constructor");

    // b1.fn and b2.fn are functions but they are different references
    // But we decided to skip function for instances.
    equals(QUnit.equiv(b1, b2), true, "Same property, same constructor");
    equals(QUnit.equiv(a1, b1), false, "Same properties but different constructor"); // failed

    function Car(year) {
        var privateVar = 0;
        this.year = year;
        this.isOld = function() {
            return year > 10;
        };
    }

    function Human(year) {
        var privateVar = 1;
        this.year = year;
        this.isOld = function() {
            return year > 80;
        };
    }

    var car = new Car(30);
    var carSame = new Car(30);
    var carDiff = new Car(10);
    var human = new Human(30);

    var diff = {
        year: 30
    };

    var same = {
        year: 30,
        isOld: function () {}
    };

    equals(QUnit.equiv(car, car), true);
    equals(QUnit.equiv(car, carDiff), false);
    equals(QUnit.equiv(car, carSame), true);
    equals(QUnit.equiv(car, human), false);
});


test("Complex Instances Nesting (with function value in literals and/or in nested instances)", function() {
    function A(fn) {
        this.a = {};
        this.fn = fn;
        this.b = {a: []};
        this.o = {};
        this.fn1 = fn;
    }
    function B(fn) {
        this.fn = fn;
        this.fn1 = function () {};
        this.a = new A(function () {});
    }

    function fnOutside() {
    }

    function C(fn) {
        function fnInside() {
        }
        this.x = 10;
        this.fn = fn;
        this.fn1 = function () {};
        this.fn2 = fnInside;
        this.fn3 = {
            a: true,
            b: fnOutside // ok make reference to a function in all instances scope
        };
        this.o1 = {};

        // This function will be ignored.
        // Even if it is not visible for all instances (e.g. locked in a closures),
        // it is from a  property that makes part of an instance (e.g. from the C constructor)
        this.b1 = new B(function () {});
        this.b2 = new B({
            x: {
                b2: new B(function() {})
            }
        });
    }

    function D(fn) {
        function fnInside() {
        }
        this.x = 10;
        this.fn = fn;
        this.fn1 = function () {};
        this.fn2 = fnInside;
        this.fn3 = {
            a: true,
            b: fnOutside, // ok make reference to a function in all instances scope

            // This function won't be ingored.
            // It isn't visible for all C insances
            // and it is not in a property of an instance. (in an Object instances e.g. the object literal)
            c: fnInside
        };
        this.o1 = {};

        // This function will be ignored.
        // Even if it is not visible for all instances (e.g. locked in a closures),
        // it is from a  property that makes part of an instance (e.g. from the C constructor)
        this.b1 = new B(function () {});
        this.b2 = new B({
            x: {
                b2: new B(function() {})
            }
        });
    }

    function E(fn) {
        function fnInside() {
        }
        this.x = 10;
        this.fn = fn;
        this.fn1 = function () {};
        this.fn2 = fnInside;
        this.fn3 = {
            a: true,
            b: fnOutside // ok make reference to a function in all instances scope
        };
        this.o1 = {};

        // This function will be ignored.
        // Even if it is not visible for all instances (e.g. locked in a closures),
        // it is from a  property that makes part of an instance (e.g. from the C constructor)
        this.b1 = new B(function () {});
        this.b2 = new B({
            x: {
                b1: new B({a: function() {}}),
                b2: new B(function() {})
            }
        });
    }


    var a1 = new A(function () {});
    var a2 = new A(function () {});
    equals(QUnit.equiv(a1, a2), true);

    equals(QUnit.equiv(a1, a2), true); // different instances

    var b1 = new B(function () {});
    var b2 = new B(function () {});
    equals(QUnit.equiv(b1, b2), true);

    var c1 = new C(function () {});
    var c2 = new C(function () {});
    equals(QUnit.equiv(c1, c2), true);

    var d1 = new D(function () {});
    var d2 = new D(function () {});
    equals(QUnit.equiv(d1, d2), false);

    var e1 = new E(function () {});
    var e2 = new E(function () {});
    equals(QUnit.equiv(e1, e2), false);

});


test('object with references to self wont loop', function(){
    var circularA = {
        abc:null
    }, circularB = {
        abc:null
    };
    circularA.abc = circularA;
    circularB.abc = circularB;
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on object (ambigous test)");
    
    circularA.def = 1;
    circularB.def = 1;
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on object (ambigous test)");
    
    circularA.def = 1;
    circularB.def = 0;
    equals(QUnit.equiv(circularA, circularB), false, "Should not repeat test on object (unambigous test)");
});

test('array with references to self wont loop', function(){
    var circularA = [], 
        circularB = [];
    circularA.push(circularA);
    circularB.push(circularB);
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on array (ambigous test)");
    
    circularA.push( 'abc' );
    circularB.push( 'abc' );
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on array (ambigous test)");
    
    circularA.push( 'hello' );
    circularB.push( 'goodbye' );
    equals(QUnit.equiv(circularA, circularB), false, "Should not repeat test on array (unambigous test)");
});

test('mixed object/array with references to self wont loop', function(){
    var circularA = [{abc:null}], 
        circularB = [{abc:null}];
    circularA[0].abc = circularA;
    circularB[0].abc = circularB;
    
    circularA.push(circularA);
    circularB.push(circularB);
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on object/array (ambigous test)");
    
    circularA[0].def = 1;
    circularB[0].def = 1;
    equals(QUnit.equiv(circularA, circularB), true, "Should not repeat test on object/array (ambigous test)");
    
    circularA[0].def = 1;
    circularB[0].def = 0;
    equals(QUnit.equiv(circularA, circularB), false, "Should not repeat test on object/array (unambigous test)");
});

test("Test that must be done at the end because they extend some primitive's prototype", function() {
    // Try that a function looks like our regular expression.
    // This tests if we check that a and b are really both instance of RegExp
    Function.prototype.global = true;
    Function.prototype.multiline = true;
    Function.prototype.ignoreCase = false;
    Function.prototype.source = "my regex";
    var re = /my regex/gm;
    equals(QUnit.equiv(re, function () {}), false, "A function that looks that a regex isn't a regex");
    // This test will ensures it works in both ways, and ALSO especially that we can make differences
    // between RegExp and Function constructor because typeof on a RegExpt instance is "function"
    equals(QUnit.equiv(function () {}, re), false, "Same conversely, but ensures that function and regexp are distinct because their constructor are different");
});
