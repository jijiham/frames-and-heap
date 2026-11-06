/* Course pack 1: JavaScript for small browser apps. Stage 1 (the language) is complete;
   stages 2–5 are listed so the map shows the whole plan. Trace answers are computed by running the
   program, never typed by hand. Hints never contain solution code. */
(function (root) {
  'use strict';
  const T = (id, title, code, hints, tags, ask) => ({ type: 'trace', id, title, code, hints, tags: tags || [], ask });
  const W = (id, title, spec, starter, tests, hints, tags, extra) => Object.assign({ type: 'write', id, title, spec, starter, tests, hints, tags: tags || [] }, extra || {});
  const F = (id, title, spec, starter, tests, hints, tags) => ({ type: 'fill', id, title, spec, starter, tests, hints, tags: tags || [] });

  const stage1 = [
    {
      id: 'u1', title: 'Values, names and operators',
      read: [
        "While a program runs, everything it knows is stored in two places, and the Memory tab draws both. The first is a stack of **frames**. A frame is a table that pairs each name the code has declared with the value that name currently holds. The program's top level has one frame, called the global frame, and every function call adds a new frame on top of the stack. The second place is the **heap**, the region of memory where objects such as arrays live. A value stored in a frame is either a **primitive** or an **address**. A primitive is a number, a string, a boolean (`true` or `false`), `undefined` or `null`, and an address is the location in the heap where an object is stored.",
        "You create a name with `let` or `const`. A name made with `let` can be **reassigned**, meaning a later line can store a different value in it, as `count = count + 1` does. A name made with `const` must keep the value it was first given, and reassigning it throws an error. JavaScript has a single number type that covers both whole numbers and decimals, so `7 / 2` evaluates to `3.5` where Java's integer division would give 3. To get the whole-number part, write `Math.floor(7 / 2)`, which rounds down to `3`.",
        "JavaScript has two equality operators. **Strict equality**, `===`, is true only when both sides have the same type and the same value, so `1 === \"1\"` is false. **Loose equality**, `==`, first converts both sides to a common type and then compares them, which produces surprises such as `\"\" == 0` being true, so the code you write should use `===` and `!==` throughout.",
        "Conditions in `if` and `while` also convert their value. Exactly six values count as false: `false`, `0`, `\"\"` (the empty string), `null`, `undefined` and `NaN`. `NaN` is the number value meaning \"not a number\", which operations such as `0 / 0` produce. These six values are called **falsy**, and every other value is **truthy**, including the string `\"0\"` and the empty array `[]`.",
      ],
      example: 'let count = 0;\nconst name = "Ada";\ncount = count + 1;\nconsole.log(count, name, typeof name);\nconsole.log(7 / 2, Math.floor(7 / 2));\nconsole.log(1 === "1", 1 == "1");',
      items: [
        T('u1t1', 'Copying a primitive', 'let a = 5;\nlet b = a;\na = a + 1;\nconsole.log(a, b);\nconsole.log(typeof a, typeof "5", typeof undefined);',
          ["A name that holds a primitive stores the number itself, so `let b = a` copies 5 into b's own entry in the frame.", "Line 3 reassigns a, which changes a's entry only, and nothing after line 2 touches b's entry.", "a ends at 6 and b stays 5. On the second printed line, `typeof` returns the name of each value's type as a string."], ['reassign']),
        T('u1t2', 'Number traps', 'console.log(7 / 2);\nconsole.log(Math.floor(7 / 2));\nconsole.log(0.1 + 0.2 === 0.3);\nconsole.log("" == 0, "" === 0);',
          ["JavaScript has no separate integer type, and it stores decimals in binary, where most decimal fractions can't be represented exactly.", "In binary, 0.1 + 0.2 comes out as 0.30000000000000004. On the last line, `==` converts the empty string to the number 0 before comparing, while `===` compares the types first.", "Line 1 prints 3.5 and line 2 prints 3. Line 3 prints false. Line 4 prints true for the `==` comparison and false for the `===` comparison, since a string and a number are different types."], ['coerce']),
        T('u1t3', 'Plus, unary plus and =+', 'const s = "3" + 4;\nconst t = +"3" + 4;\nlet x = 5;\nx =+ 1;\nconsole.log(s, t, x);\nconsole.log(`total: ${2 + 3}`);',
          ["When either side of `+` is a string, `+` joins the two sides as text.", "A `+` written directly in front of a value converts it to a number, so `+\"3\"` is the number 3. The line `x =+ 1` reads more clearly with the space moved, as `x = +1`.", "s is the string \"34\", t is the number 7, and x has been reassigned to 1. Inside the template string, `${2 + 3}` is evaluated first, so the last line prints total: 5."], ['coerce']),
        T('u1t4', 'What counts as false', 'const values = [0, "0", "", [], null, "false"];\nfor (const v of values) {\n  console.log(v ? "true" : "false");\n}',
          ["Only six values count as false in a condition: false, 0, the empty string, null, undefined and NaN.", "A non-empty string counts as true whatever text it contains, and every object counts as true, including an empty array.", "Of the six values here, 0, \"\" and null print false, and \"0\", [] and \"false\" print true."], ['truthy']),
        W('u1w1', 'Write clamp', 'Write `clamp(x, lo, hi)`. It returns `lo` when `x` is below `lo`, `hi` when `x` is above `hi`, and `x` itself otherwise.',
          'function clamp(x, lo, hi) {\n  \n}\n',
          [{ name: 'clamp(5, 0, 10) is 5', code: 'eq(clamp(5, 0, 10), 5)' }, { name: 'clamp(-3, 0, 10) is 0', code: 'eq(clamp(-3, 0, 10), 0)' }, { name: 'clamp(12, 0, 10) is 10', code: 'eq(clamp(12, 0, 10), 10)' }, { name: 'clamp(0, 0, 10) is 0', code: 'eq(clamp(0, 0, 10), 0)' }],
          ["Two comparisons decide the answer: whether x is below the range, and whether it is above it.", "Check x < lo first and return lo in that case, then check x > hi and return hi.", "If neither check returned, x already lies inside the range, so the function returns x itself."]),
      ],
    },
    {
      id: 'u2', title: 'Conditions and loops',
      read: [
        "`if`, `else`, `for`, `while`, `break` and `continue` behave exactly as they do in Java, with `let` in place of a declared type such as `int`. JavaScript adds `for…of`, which walks the values of an array in order, so `for (const row of grid)` gives you each row in turn without an index. A similar-looking loop, `for…in`, walks an object's key names as strings, so on an array it gives you `\"0\"`, `\"1\"` and so on, which is rarely what you want.",
        "A `for (let i = …)` loop gives every pass its own copy of the loop variable, holding that pass's value. The Memory tab draws that copy as a small table inside the current frame.",
      ],
      example: 'let total = 0;\nfor (let i = 1; i <= 3; i++) {\n  total += i;\n}\nconsole.log(total);\nfor (const w of ["a", "b"]) console.log(w);',
      items: [
        T('u2t1', 'continue', 'let total = 0;\nfor (let i = 1; i <= 4; i++) {\n  if (i === 3) continue;\n  total += i;\n}\nconsole.log(total);',
          ["`continue` skips the rest of the current pass and jumps to the update step, i++.", "List the values of i that actually reach the line `total += i`.", "i takes the values 1, 2, 3 and 4, and the pass where i is 3 is skipped, so total is 1 + 2 + 4."], ['loop']),
        T('u2t2', 'A while loop', 'let n = 10;\nlet steps = 0;\nwhile (n > 1) {\n  n = n % 2 === 0 ? n / 2 : 3 * n + 1;\n  steps++;\n}\nconsole.log(steps);',
          ["Write down each value n takes and count how many times the loop body runs.", "Even values of n are halved and odd values become 3n + 1, starting from 10.", "n goes 10, 5, 16, 8, 4, 2, 1, and steps counts the changes between those values."], ['loop']),
        T('u2t3', 'Nested loops', 'for (let r = 0; r < 2; r++) {\n  let line = "";\n  for (let c = 0; c < 3; c++) {\n    line += r === c ? "X" : ".";\n  }\n  console.log(line);\n}',
          ["Each pass of the outer loop builds one line of text, and line starts empty again on every pass.", "Each character is an X when the row number equals the column number, and a dot otherwise.", "It prints two lines of three characters each, with the X on the diagonal."], ['loop']),
        T('u2t4', 'break and for…of', 'const words = ["mine", "flag", "safe", "mine"];\nlet firstSafe = -1;\nfor (let i = 0; i < words.length; i++) {\n  if (words[i] === "safe") { firstSafe = i; break; }\n}\nconsole.log(firstSafe);\nfor (const w of words) console.log(w.length);',
          ["`break` leaves the loop at the first match, so later matches are never seen.", "Indexes start at 0. The `for…of` loop gives the words themselves, and `.length` on a string is its number of characters.", "The first \"safe\" is at index 2, and every word in the array has four letters."], ['loop']),
        W('u2w1', 'Write labels', 'Write `labels(n)`. It returns an array of strings for the numbers 1 to n: `"FizzBuzz"` for multiples of both 3 and 5, `"Fizz"` for other multiples of 3, `"Buzz"` for other multiples of 5, and the number as a string otherwise.',
          'function labels(n) {\n  \n}\n',
          [{ name: 'labels(5)', code: 'eq(labels(5), ["1", "2", "Fizz", "4", "Buzz"])' }, { name: 'labels(15) ends with FizzBuzz', code: 'eq(labels(15)[14], "FizzBuzz")' }, { name: 'labels(0) is an empty array', code: 'eq(labels(0), [])' }, { name: 'numbers come back as strings', code: 'eq(typeof labels(1)[0], "string")' }],
          ["Create an empty array and push one string onto it for each number from 1 to n.", "Check for a multiple of both 3 and 5 first, because 15 would otherwise match the multiple-of-3 case and get \"Fizz\".", "For the plain case, `String(i)` or a template string such as `${i}` turns the number into text."]),
      ],
    },
    {
      id: 'u3', title: 'Functions',
      read: [
        "There are two common ways to make a function. A **function declaration**, written `function square(n) { return n * n; }`, is set up before the first line of the program runs, so you can call it on a line above the declaration. This behavior is called **hoisting**. An **arrow function**, written `(n) => n * n`, is an ordinary value that you store in a name with `const`, so it exists only after the line that stores it has run.",
        "Each call creates a new frame on top of the stack and copies each argument's value into the matching parameter. When the argument is a primitive, the parameter receives its own copy of the number or string, so reassigning the parameter inside the function leaves the caller's names unchanged. When the function finishes, its frame is removed. The call then evaluates to the value its `return` statement gave back, or to `undefined` if the function ended without one.",
      ],
      example: 'function addOne(n) {\n  n = n + 1;\n  return n;\n}\nlet x = 5;\nconst y = addOne(x);\nconsole.log(x, y);',
      items: [
        T('u3t1', 'A parameter is a copy', 'function addOne(n) {\n  n = n + 1;\n  return n;\n}\nlet x = 5;\nconst y = addOne(x);\nconsole.log(x, y);',
          ["The call copies the value 5 into the parameter n, which lives in the new frame for addOne.", "Line 2 reassigns n inside addOne's frame only, while x lives in the global frame and is never touched.", "x stays 5, and y receives the returned value 6."], ['call']),
        T('u3t2', 'No return', 'function greet(name) {\n  console.log("hi " + name);\n}\nconst result = greet("Ada");\nconsole.log(result);\nconst double = n => n * 2;\nconsole.log(double(double(3)));',
          ["greet prints a line, and it has no return statement.", "A call that ends without a return gives back undefined. In `double(double(3))`, the inner call runs first.", "It prints three lines: the greeting, then undefined, then the result of double(6)."], ['call']),
        T('u3t3', 'Hoisting', 'console.log(square(4));\nfunction square(n) { return n * n; }\nconst cube = (n) => n * n * n;\nconsole.log(cube(2));',
          ["Function declarations are set up before the first line runs.", "That makes square callable on line 1. cube is an arrow function stored in a const, so it can be used only after line 3 has run, which is the case here.", "It prints 16 and then 8."], ['hoist']),
        W('u3w1', 'Write maxOf', 'Write `maxOf(arr)` without `Math.max`. It returns the largest number in `arr`, or `undefined` for an empty array.',
          'function maxOf(arr) {\n  \n}\n',
          [{ name: 'maxOf([3, 9, 2]) is 9', code: 'eq(maxOf([3, 9, 2]), 9)' }, { name: 'all negative: maxOf([-5, -2, -9]) is -2', code: 'eq(maxOf([-5, -2, -9]), -2)' }, { name: 'one element', code: 'eq(maxOf([7]), 7)' }, { name: 'empty array gives undefined', code: 'eq(maxOf([]), undefined)' }],
          ["Keep the largest value seen so far in a variable and compare each element against it.", "Start that variable at the first element instead of 0, because an array of only negative numbers would otherwise give 0 as its largest value.", "An empty array has no first element, so arr[0] is undefined, which is exactly the value the function should return for it."]),
      ],
    },
    {
      id: 'u4', title: 'Arrays',
      read: [
        "An array is an object in the heap. Its elements are stored under the keys `0`, `1`, `2` and so on, and its `length` is one more than the highest index. `push(x)` adds `x` at the end by changing the existing array in place, and a change made in place like this is called **mutation**. Reading an index past the end gives `undefined` without an error, which is why off-by-one mistakes in JavaScript tend to produce wrong values quietly.",
        "Assigning an array to a second name, as in `const c = a`, copies the address, so `c` and `a` refer to one array and a `push` through either name shows up in both. To get a separate array, call `a.slice()`, which builds a new array holding the same elements; `a.slice(1)` copies everything from index 1 onward.",
        "`sort()` called with no arguments compares the elements as strings, so `[10, 9, 1, 100].sort()` puts 100 before 9. To sort numbers, pass a comparison function: `sort((x, y) => x - y)`.",
      ],
      example: 'const a = [10, 20, 30];\na.push(40);\nconst b = a.slice(1);\nconsole.log(a, b, a[9]);',
      items: [
        T('u4t1', 'Length and missing indexes', 'const a = [10, 20, 30];\na.push(40);\nconsole.log(a.length, a[1], a[4]);\nconsole.log(a.includes(20), a.indexOf(30), a.indexOf(99));',
          ["push adds one element at the end, which increases the length by one.", "Indexes start at 0, and reading a missing index gives undefined. indexOf returns -1 when the value is absent from the array.", "The first line prints 4, 20 and undefined, and the second prints true, 2 and -1."], ['array']),
        T('u4t2', 'slice against sharing', 'const a = [1, 2, 3];\nconst b = a.slice(1);\nconst c = a;\nc.push(4);\nconsole.log(a, b);',
          ["`slice` creates a new array, while `const c = a` copies only the address.", "Since c and a hold the same address, pushing through c changes the array that a refers to. b was copied before the push, so it keeps its two elements.", "a prints with four numbers and b with two."], ['aliasing']),
        T('u4t3', 'sort sorts text', 'const nums = [10, 9, 1, 100];\nconsole.log(nums.sort());\nconsole.log(nums.sort((x, y) => x - y));',
          ["Called with no function, sort converts the values to strings and compares them as text.", "As text, \"100\" comes before \"9\" because its first character, \"1\", comes before \"9\".", "The first line shows the numbers in text order, and the second shows them in numeric order."], ['array']),
        W('u4w1', 'Write countValue', 'Write `countValue(arr, v)`. It returns how many elements of `arr` are `===` to `v`.',
          'function countValue(arr, v) {\n  \n}\n',
          [{ name: 'countValue([1, 2, 1, 1], 1) is 3', code: 'eq(countValue([1, 2, 1, 1], 1), 3)' }, { name: 'no matches gives 0', code: 'eq(countValue([1, 2], 5), 0)' }, { name: 'uses ===, so "1" isn\'t 1', code: 'eq(countValue([1, "1"], 1), 1)' }, { name: 'empty array gives 0', code: 'eq(countValue([], 1), 0)' }],
          ["Keep a counter that starts at 0.", "Walk through every element and add one to the counter whenever the element is === v.", "Return the counter after the loop has finished, since a return inside the loop would stop at the first element."]),
        W('u4w2', 'Write withoutValue', 'Write `withoutValue(arr, v)`. It returns a new array with every element `===` to `v` removed, and leaves `arr` unchanged.',
          'function withoutValue(arr, v) {\n  \n}\n',
          [{ name: 'removes every match', code: 'eq(withoutValue([1, 2, 1, 3], 1), [2, 3])' }, { name: 'leaves the original unchanged', body: 'const a = [1, 2, 1, 3];\nwithoutValue(a, 1);\nreturn eq(a, [1, 2, 1, 3]);' }, { name: 'returns a different array', body: 'const a = [2, 3];\nreturn ok(withoutValue(a, 1) !== a, "the same array", "a new array");' }],
          ["Build a new array and add to it only the values you want to keep.", "Use push on the new array and leave the input alone, because splice would mutate the caller's array.", "Every element that is !== v belongs in the result."]),
      ],
    },
    {
      id: 'u5', title: 'Objects and references',
      read: [
        "An object literal such as `{ hp: 10 }` creates a new object in the heap every time its line runs, and it evaluates to the new object's address. A name holds that address, which the diagram draws as an arrow from the name to the object.",
        "Two kinds of change therefore look similar in code and behave differently. **Reassignment**, written `x = …`, stores a new value in a name's frame entry and affects only that name. **Mutation**, written `obj.k = …` or done by a method such as `push`, changes the object in the heap, so every name holding that object's address sees the change. Passing an object to a function copies its address into the parameter. The function can therefore mutate the caller's object, while reassigning the parameter has no effect on the caller.",
        "`===` applied to two objects compares their addresses, so `{} === {}` is false because each literal made a separate object. Declaring a name with `const` prevents only reassigning that name, so a `const` array can still be pushed onto and a `const` object can still have its keys changed.",
      ],
      example: 'const a = { hp: 10 };\nconst b = a;\nb.hp = 3;\nconsole.log(a.hp, a === b);',
      items: [
        T('u5t1', 'Two names, one object', 'const a = { hp: 10 };\nconst b = a;\nb.hp = 3;\nconsole.log(a.hp);\nconst c = { hp: 3 };\nconsole.log(a === b, b === c);',
          ["`const b = a` copies the address, so that line creates no new object.", "b.hp = 3 mutates the single object that both names point to. c is a separate object that happens to have the same contents.", "The first line prints 3, and the second prints true for a === b and false for b === c."], ['aliasing']),
        T('u5t2', 'Mutate, then reassign', 'function rename(person) {\n  person.name = "Bo";\n  person = { name: "Cy" };\n  return person.name;\n}\nconst p = { name: "Al" };\nconst r = rename(p);\nconsole.log(p.name, r);',
          ["The parameter person starts out holding a copy of p's address.", "Line 2 mutates the caller's object through that address. Line 3 points person at a new object, which changes only the entry in rename's frame.", "p.name is \"Bo\", and r is \"Cy\"."], ['aliasing', 'reassign']),
        T('u5t3', 'const and mutation', 'const cells = [];\ncells.push({ mine: false });\ncells[0].mine = true;\nconsole.log(cells);\ncells = [];',
          ["`const` forbids reassigning the name and allows every kind of mutation.", "push and `.mine = true` are mutations, so they work. The last line is a reassignment.", "It prints the array holding one cell whose mine is true, and then the last line throws a TypeError."], ['const', 'error']),
        T('u5t4', 'Brackets and missing keys', 'const counts = {};\nconst items = ["M", "1", "M", "2", "M"];\nfor (const it of items) {\n  counts[it] = (counts[it] || 0) + 1;\n}\nconsole.log(counts);\nconsole.log(counts.M, counts["1"], counts.x);',
          ["`counts[it]` uses the string stored in it as the key. A missing key reads as undefined, and `undefined || 0` evaluates to 0.", "When an object is printed, keys that look like whole numbers, such as \"1\", come first in numeric order, and the remaining keys follow in the order they were added.", "The object prints with 1, then 2, then M, and the last line prints 3, 1 and undefined."], ['object']),
        W('u5w1', 'Write revealAll', "Write `revealAll(cells)`, where `cells` is an array of objects like `{ revealed: false }`. It sets `revealed` to `true` on every cell by mutating the objects it was given, and it returns nothing.",
          'function revealAll(cells) {\n  \n}\n',
          [{ name: 'every cell is revealed', body: 'const cs = [{ revealed: false }, { revealed: false }];\nrevealAll(cs);\nreturn eq(cs, [{ revealed: true }, { revealed: true }]);' }, { name: 'the same objects are changed', body: 'const c = { revealed: false };\nrevealAll([c]);\nreturn eq(c.revealed, true);' }, { name: 'returns undefined', code: 'eq(revealAll([]), undefined)' }],
          ["Change the objects you were given, since the caller holds the same addresses and will see the changes.", "Loop over the array and set the key on each element.", "Inside a for…of loop, `cell.revealed = true` mutates each object in place."]),
      ],
    },
    {
      id: 'u6', title: 'Grids',
      read: [
        "A grid is an array whose elements are themselves arrays, one per row. `grid[r][c]` reads it in two steps: `grid[r]` follows the grid's address to the row array at index `r`, and `[c]` then reads index `c` inside that row.",
        "Building the rows needs care. `Array.from({ length: rows }, () => [...])` calls the function once per row, so every row is a newly created array. `Array(rows).fill(row)` evaluates `row` once and copies that single address into every slot, which leaves all the rows pointing at one shared array, so changing `grid[0][0]` also changes `grid[1][0]`.",
        "Reading off the edge of the grid fails in two different ways. `grid[-1]` reads a missing index and quietly gives `undefined`, and `grid[-1][0]` then tries to read index 0 of `undefined` and throws a TypeError. The fix is to check that a position is on the board before reading it, and to write that check first in an `&&` chain, because `&&` stops evaluating at the first false part and so never reaches the read.",
      ],
      example: 'const rows = Array.from({ length: 2 }, () => [0, 0]);\nrows[0][0] = 1;\nconsole.log(rows);\nconst shared = Array(2).fill([0, 0]);\nshared[0][0] = 1;\nconsole.log(shared);',
      items: [
        T('u6t1', 'The fill bug', 'const rows = Array(3).fill(Array(3).fill(0));\nrows[0][0] = 1;\nconsole.log(rows[1][0], rows[2][0]);\nconsole.log(rows[0] === rows[1]);',
          ["The argument to the outer fill is evaluated once, before fill starts copying.", "So exactly one row array is created, and fill copies its address into all three slots.", "Every row is the same array, so both reads give 1 and rows[0] === rows[1] is true."], ['aliasing']),
        T('u6t2', 'Program A: building a table', 'function makeTable(rows, cols) {\n  const table = [];\n  for (let r = 0; r < rows; r++) {\n    const row = [];\n    for (let c = 0; c < cols; c++) {\n      row.push((r + 1) * (c + 1));\n    }\n    table.push(row);\n  }\n  return table;\n}\nconst t = makeTable(3, 4);\nconsole.log(t[2][3], t.length, t[0].length);',
          ["`const row = []` runs once per pass of the outer loop, so every row is a new array.", "t[2][3] is the value in the third row and the fourth column, counting from 1.", "The value is 3 × 4, which is 12, and the table has three rows of four."], ['grid']),
        T('u6t3', 'Program C: neighbors with edge checks', 'function countAdjacentTrees(grid, r, c) {\n  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];\n  let count = 0;\n  for (const [dr, dc] of offsets) {\n    const nr = r + dr;\n    const nc = c + dc;\n    const onBoard = nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length;\n    if (onBoard && grid[nr][nc] === "T") {\n      count++;\n    }\n  }\n  return count;\n}\nconst garden = [\n  ["T", "-", "T"],\n  ["-", "-", "-"],\n  ["T", "T", "-"],\n];\nconsole.log(countAdjacentTrees(garden, 1, 1));\nconsole.log(countAdjacentTrees(garden, 0, 1));\nconsole.log(countAdjacentTrees(garden, 2, 2));',
          ["Only the four squares up, down, left and right count here, and diagonals don't.", "For each position, list its four neighbors, drop the ones that fall off the board, and count the \"T\"s among the rest.", "(1, 1) has a tree only below it, (0, 1) has trees to its left and right, and (2, 2) has a tree only to its left."], ['grid']),
        T('u6t4', 'Reading past the edge', 'const grid = [[1, 2], [3, 4]];\nconsole.log(grid[1][0], grid[2]);\nconst r = -1;\nconsole.log(r >= 0 && grid[r][0]);\nconsole.log(grid[r][0]);',
          ["A missing row reads as undefined, and reading an index from undefined throws.", "`&&` stops at the first false part, so on line 4 the read grid[r][0] never runs.", "Line 2 prints 3 and undefined, line 4 prints false, and line 5 throws a TypeError."], ['grid', 'error']),
        T('u6t5', 'Program B: random without duplicates', 'function seatGuests(seats, k) {\n  if (k > seats.length) { console.log("not enough seats"); return; }\n  let seated = 0;\n  while (seated < k) {\n    const i = Math.floor(Math.random() * seats.length);\n    if (seats[i] !== "G") {\n      seats[i] = "G";\n      seated++;\n    }\n  }\n}\nconst seats = ["-", "-", "-", "-", "-", "-"];\nseatGuests(seats, 3);\nconsole.log(seats.filter(s => s === "G").length);\nseatGuests(seats, 7);',
          ["The positions are random, and the number of seated guests is fixed.", "A seat that is already taken is skipped without counting, so the loop runs until exactly k new seats are taken. The function mutates seats through the address it was given.", "It prints 3, and the second call prints \"not enough seats\" because 7 is more than 6."], ['random', 'aliasing']),
        F('u6f1', 'Fill in makeGrid', 'Replace each `___` so `makeGrid(rows, cols, value)` returns a new grid with every cell set to `value`, every row a separate array.',
          'function makeGrid(rows, cols, value) {\n  const grid = [];\n  for (let r = 0; r < rows; r++) {\n    const row = ___;\n    for (let c = 0; c < cols; c++) {\n      ___;\n    }\n    ___;\n  }\n  return ___;\n}\n',
          [{ name: 'makeGrid(2, 3, 0)', code: 'eq(makeGrid(2, 3, 0), [[0, 0, 0], [0, 0, 0]])' }, { name: 'changing g[0][0] changes only one cell', body: 'const g = makeGrid(3, 4, 0);\ng[0][0] = 9;\nreturn eq(g.map(row => row[0]), [9, 0, 0]);' }, { name: 'makeGrid(1, 1, "x")', code: 'eq(makeGrid(1, 1, "x"), [["x"]])' }, { name: 'zero rows gives []', code: 'eq(makeGrid(0, 5, 0), [])' }],
          ["The first blank needs a new empty array on every pass of the outer loop.", "The second blank adds value to the end of row, and the third adds row to the end of grid.", "The last blank returns the grid you built."], ['grid']),
        F('u6f2', 'Fill in placeMines', 'Replace each `___` so `placeMines(grid, n)` puts `"M"` on exactly `n` different random cells and changes nothing else. If `n` is more than the number of cells, it prints a warning and stops.',
          'function placeMines(grid, n) {\n  const rows = grid.length;\n  const cols = ___;\n  if (n > rows * cols) { console.log("too many mines"); return; }\n  let placed = 0;\n  while (___) {\n    const r = Math.floor(Math.random() * rows);\n    const c = ___;\n    if (___) {\n      ___;\n      ___;\n    }\n  }\n}\n',
          [{ name: '10 mines on a 9 × 9 grid, five times', body: 'for (let k = 0; k < 5; k++) {\n  const g = Array.from({ length: 9 }, () => Array(9).fill(0));\n  placeMines(g, 10);\n  const m = g.flat().filter(x => x === "M").length;\n  if (m !== 10) return eq(m, 10);\n}\nreturn eq(10, 10);' }, { name: 'other cells are unchanged', body: 'const g = Array.from({ length: 4 }, () => Array(4).fill(0));\nplaceMines(g, 5);\nreturn eq(g.flat().filter(x => x !== "M" && x !== 0).length, 0);' }, { name: 'a full board: 4 mines on 2 × 2', body: 'const g = [[0, 0], [0, 0]];\nplaceMines(g, 4);\nreturn eq(g, [["M", "M"], ["M", "M"]]);' }, { name: 'too many mines stops instead of looping forever', isolate: true, body: 'const g = [[0, 0], [0, 0]];\nplaceMines(g, 5);\nreturn eq(g.flat().filter(x => x === "M").length <= 4, true);' }],
          ["cols is the length of one row, and the loop keeps running while placed is less than n.", "Pick a random column the same way the row is picked. The if checks that the chosen cell isn't already \"M\".", "Inside the if, put \"M\" in the cell and then count it. A cell that is already taken is skipped without counting."], ['grid', 'random']),
        W('u6w1', 'Write countNeighbors', "Write `countNeighbors(grid, r, c)`. It returns the number of cells around `(r, c)` that hold `\"M\"`. A cell in the middle of the grid has 8 neighbors, a cell on an edge has 5, and a corner cell has 3.",
          'function countNeighbors(grid, r, c) {\n  \n}\n',
          [{ name: 'mine in the center: every other cell sees 1', body: 'const g = [[0, 0, 0], [0, "M", 0], [0, 0, 0]];\nconst got = [];\nfor (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!(r === 1 && c === 1)) got.push(countNeighbors(g, r, c));\nreturn eq(got, [1, 1, 1, 1, 1, 1, 1, 1]);' }, { name: 'the cell itself isn\'t counted', code: 'eq(countNeighbors([[0, 0, 0], [0, "M", 0], [0, 0, 0]], 1, 1), 0)' }, { name: 'corner mine: far corner sees 0', code: 'eq(countNeighbors([["M", 0, 0], [0, 0, 0], [0, 0, 0]], 2, 2), 0)' }, { name: 'corner mine: (0, 1) sees 1', code: 'eq(countNeighbors([["M", 0, 0], [0, 0, 0], [0, 0, 0]], 0, 1), 1)' }, { name: 'edges and corners don\'t throw', body: 'const g = [["M", "M"], ["M", 0]];\nreturn eq([countNeighbors(g, 0, 0), countNeighbors(g, 1, 1)], [2, 3]);' }],
          ["Use two loops: a row offset dr from -1 to 1 and a column offset dc from -1 to 1.", "Skip the case where both offsets are 0, because that is the cell itself.", "Check that the neighbor's row and column are inside the grid before reading it, as Program C does."], ['grid']),
        W('u6w2', 'Write fillCounts', "Write `fillCounts(grid)`. It replaces the value of every non-mine cell with that cell's `countNeighbors` result, and it leaves the `\"M\"` cells as they are. Put your `countNeighbors` in the same editor so that `fillCounts` can call it.",
          '// paste your countNeighbors here too\n\nfunction fillCounts(grid) {\n  \n}\n',
          [{ name: 'a 3 × 3 board', body: 'const g = [["M", 0, 0], [0, 0, 0], [0, 0, "M"]];\nfillCounts(g);\nreturn eq(g, [["M", 1, 0], [1, 2, 1], [0, 1, "M"]]);' }, { name: 'a board with no mines stays all 0', body: 'const g = [[5, 5], [5, 5]];\nfillCounts(g);\nreturn eq(g, [[0, 0], [0, 0]]);' }, { name: 'mines stay "M"', body: 'const g = [["M", "M"], ["M", "M"]];\nfillCounts(g);\nreturn eq(g, [["M", "M"], ["M", "M"]]);' }],
          ["Use two loops that visit every cell.", "Leave a cell alone when it holds \"M\", and replace its value otherwise.", "The new value of a cell is countNeighbors(grid, r, c) for that cell."], ['grid']),
      ],
    },
    {
      id: 'u7', title: 'Array methods that take a function',
      read: [
        "Arrays have methods that take a function, called a **callback**, and call it once for each element with the arguments `(value, index, array)`. `forEach` calls it and returns `undefined`. `map` returns a new array made of the callback's results, and `filter` returns a new array of the elements for which the callback returned a truthy value. `some` returns true if the callback is truthy for at least one element, and `every` returns true if it is truthy for all of them. `reduce((acc, value) => …, start)` carries a running result, called the **accumulator**, from one element to the next and returns its final value.",
        "These methods leave the original array unchanged, unless the callback you pass mutates it.",
      ],
      example: 'const nums = [1, 2, 3];\nconst doubled = nums.map(n => n * 2);\nconsole.log(doubled, nums);',
      items: [
        T('u7t1', 'map and filter', 'const nums = [1, 2, 3, 4];\nconst doubled = nums.map(n => n * 2);\nconst evens = nums.filter(n => n % 2 === 0);\nconsole.log(doubled, evens, nums);',
          ["map and filter each build a new array.", "filter keeps a value when the callback returns true for it, and nums itself never changes.", "It prints the doubled values, then the even values, then the original array."], ['callback']),
        T('u7t2', 'some, every, reduce', 'const cells = [{ mine: false }, { mine: true }, { mine: false }];\nconsole.log(cells.some(c => c.mine), cells.every(c => c.mine));\nconsole.log(cells.filter(c => !c.mine).length);\nconst total = [5, 1, 4].reduce((sum, n) => sum + n, 0);\nconsole.log(total);',
          ["some needs at least one element to pass, and every needs all of them to pass.", "filter with `!c.mine` keeps the safe cells. reduce starts sum at 0 and adds each n to it.", "The lines are true and false, then 2, then 10."], ['callback']),
        T('u7t3', 'forEach returns nothing', 'const r = [1, 2, 3].forEach(n => n * 2);\nconsole.log(r);\nconsole.log(["a", "b"].map((s, i) => s + i));',
          ["forEach calls the function on each element and discards whatever it returns.", "map passes the index as the callback's second argument.", "It prints undefined, then an array holding the strings a0 and b1."], ['callback']),
        W('u7w1', 'Write countMines', "Write `countMines(grid)`. It returns the number of cells in the grid that hold `\"M\"`. Loops pass the tests, and the array methods from this unit make it shorter.",
          'function countMines(grid) {\n  \n}\n',
          [{ name: 'two mines', code: 'eq(countMines([["M", 1], [1, "M"]]), 2)' }, { name: 'no mines', code: 'eq(countMines([[0, 0]]), 0)' }, { name: 'empty grid', code: 'eq(countMines([]), 0)' }],
          ["You need a single total across every row of the grid.", "For each row, count its \"M\" cells, then add the row counts together.", "One way is reduce over the rows with filter(...).length inside, and another is flat() followed by filter."]),
      ],
    },
    {
      id: 'u8', title: 'Recursion',
      read: [
        "A **recursive** function is one that calls itself. Each call gets its own frame with its own copies of the parameters, so the Memory tab shows the frames stacking up as the calls go deeper. Every recursive function needs a **base case**, a condition under which it returns without calling itself again. Without one, frames keep piling up until the engine stops the program with `RangeError: Maximum call stack size exceeded`.",
        "When a call returns, its frame is removed and the caller resumes at the point where it made the call. Any code written after the recursive call therefore runs on the way back out, in the reverse order of the calls.",
      ],
      example: 'function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nconsole.log(fact(4));',
      items: [
        T('u8t1', 'Factorial', 'function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nconsole.log(fact(4));',
          ["Each call waits for the call it makes to return before it can finish.", "fact(1) returns 1, and on the way back each frame multiplies the returned value by its own n.", "The result is 4 × 3 × 2 × 1."], ['recursion']),
        T('u8t2', 'Summing by slicing', 'function sum(arr) {\n  if (arr.length === 0) return 0;\n  return arr[0] + sum(arr.slice(1));\n}\nconsole.log(sum([4, 5, 6]));',
          ["Each call takes the first element and recurses on the rest of the array.", "slice(1) makes a new, shorter array for the next call, and the base case is the empty array.", "The result is 4 + 5 + 6 + 0."], ['recursion']),
        T('u8t3', 'On the way back', 'function countdown(n) {\n  if (n === 0) return;\n  console.log(n);\n  countdown(n - 1);\n  console.log("back in " + n);\n}\ncountdown(2);',
          ["The second log in each call runs only after that call's recursive call has returned.", "Trace the frames: countdown(2) calls countdown(1), which calls countdown(0), which returns at once.", "It prints 2, 1, back in 1 and back in 2."], ['recursion']),
        W('u8w1', 'Write floodFill (stretch)', "Write `floodFill(grid, revealed, r, c)`, which is what Minesweeper does when you click an empty cell. `grid` holds the numbers, and `revealed` is a grid of the same size holding `true` or `false`. The function reveals `(r, c)`, and if that cell's number is 0 it reveals all 8 neighbors in the same way. It stops at cells off the board and at cells that are already revealed.",
          'function floodFill(grid, revealed, r, c) {\n  \n}\n',
          [{ name: 'a 0 region opens up to its border numbers', body: 'const g = [[0, 0, 1], [0, 0, 1], [1, 1, 1]];\nconst rev = g.map(row => row.map(() => false));\nfloodFill(g, rev, 0, 0);\nreturn eq(rev, [[true, true, true], [true, true, true], [true, true, true]]);' }, { name: 'a number opens only itself', body: 'const g = [[1, 0], [0, 0]];\nconst rev = [[false, false], [false, false]];\nfloodFill(g, rev, 0, 0);\nreturn eq(rev, [[true, false], [false, false]]);' }, { name: 'stops at the border numbers', body: 'const g = [[0, 1, 0], [1, 1, 0], [0, 0, 0]];\nconst rev = g.map(row => row.map(() => false));\nfloodFill(g, rev, 0, 0);\nreturn eq(rev, [[true, true, false], [true, true, false], [false, false, false]]);' }],
          ["Start with two checks that return early: one for a cell off the board, and one for a cell that is already revealed.", "Mark the cell revealed before recursing, because two neighboring zero cells would otherwise call each other forever.", "Only a 0 cell recurses into its 8 neighbors, while a cell holding a number is revealed and stops there."], ['recursion', 'grid']),
      ],
    },
    {
      id: 'u9', title: 'Closures',
      read: [
        "A function value keeps a link to the frame it was created in, and a function together with that link is called a **closure**. A frame normally disappears when its call returns. If a function created inside it is still reachable, for example because it was returned, the frame stays alive so that the function can keep reading and changing its variables. The Memory tab draws such a frame next to the objects, with a dashed border, after its call has ended.",
        "Loops show the difference between `let` and `var`. Each pass of a `for (let i = …)` loop has its own `i`, so functions created in different passes each see their own pass's value. A `var` declaration creates one variable shared by the whole function, so functions created in a `var` loop all read that one variable and see its final value.",
      ],
      example: 'function makeCounter() {\n  let count = 0;\n  return () => {\n    count += 1;\n    return count;\n  };\n}\nconst next = makeCounter();\nnext();\nconsole.log(next());',
      items: [
        T('u9t1', 'A counter', 'function makeCounter() {\n  let count = 0;\n  return () => {\n    count += 1;\n    return count;\n  };\n}\nconst next = makeCounter();\nnext();\nnext();\nconsole.log(next());',
          ["makeCounter's frame survives the end of its call because the returned arrow function links to it.", "Every call to next changes the same saved count.", "next is called three times, and the third call returns 3."], ['closure']),
        T('u9t2', 'let and var in loops', 'const fns = [];\nfor (let i = 0; i < 3; i++) {\n  fns.push(() => i);\n}\nconsole.log(fns[0](), fns[2]());\nvar g = [];\nfor (var j = 0; j < 3; j++) { g.push(() => j); }\nconsole.log(g[0](), g[2]());',
          ["With let, each pass of the loop has its own i, while with var there is one j shared by every pass.", "The var loop ends when j reaches 3, and every function in g reads that one j.", "The first line prints 0 and 2, and the second prints 3 and 3."], ['closure']),
        T('u9t3', 'Function factories', 'function makeAdder(k) {\n  return n => n + k;\n}\nconst add2 = makeAdder(2);\nconst add10 = makeAdder(10);\nconsole.log(add2(1), add10(1), add2(add10(0)));',
          ["Each call to makeAdder has its own frame with its own k.", "add2 keeps k = 2 and add10 keeps k = 10. Work the nested call from the inside out.", "It prints 3, 11, and then the value of add2(10)."], ['closure']),
        W('u9w1', 'Write makeCounter', 'Write `makeCounter()`. It returns an object with two functions: `inc()` adds 1 and returns the new count, and `value()` returns the current count. Two counters must not share a count.',
          'function makeCounter() {\n  \n}\n',
          [{ name: 'inc counts up', body: 'const c = makeCounter();\nc.inc();\nreturn eq(c.inc(), 2);' }, { name: 'value reads without changing', body: 'const c = makeCounter();\nc.inc();\nc.value();\nreturn eq(c.value(), 1);' }, { name: 'two counters are independent', body: 'const a = makeCounter(), b = makeCounter();\na.inc(); a.inc(); b.inc();\nreturn eq([a.value(), b.value()], [2, 1]);' }],
          ["Store the count in makeCounter's frame with let.", "Return an object whose two properties are arrow functions that use that count.", "inc changes the count and returns it, and value only returns it."]),
      ],
    },
    {
      id: 'u10', title: 'Error messages',
      read: [
        "When a line throws, the console prints the error's type followed by a message describing what went wrong. The messages below cover most of what you will see.",
        "`ReferenceError: x is not defined` means no frame on the stack has a name `x`, which is usually a typo. `ReferenceError: Cannot access 'x' before initialization` means the name exists but the line declaring it hasn't run yet. A `let` or `const` name is created when its block starts and becomes usable only once its declaring line runs, and the stretch in between is called the **temporal dead zone**.",
        "`TypeError: Cannot read properties of undefined (reading '0')` means the code read index `0` of something that turned out to be `undefined`, which with grids usually means a missing bounds check. `TypeError: Assignment to constant variable.` means a line reassigned a `const` name. `TypeError: x is not a function` means the code called a value that isn't a function, which most often comes from a misspelled method name.",
        "`RangeError: Maximum call stack size exceeded` means a recursive function kept calling itself without reaching a base case.",
      ],
      example: 'const grid = [[0]];\nconsole.log(grid[0][0]);\nconsole.log(grid[1][0]);',
      items: [
        T('u10t1', 'Before initialization', 'console.log(typeof later);\nconsole.log(early());\nfunction early() { return "ok"; }\nconsole.log(value);\nlet value = 1;',
          ["typeof applied to a name that exists nowhere gives \"undefined\" without throwing.", "early is a function declaration, so it is hoisted. value exists from the start of the program but stays uninitialized until line 5 runs.", "It prints undefined and ok, and then line 4 throws a ReferenceError."], ['tdz', 'error'], 'What does this print? If a line throws, write the error type for that line.'),
        T('u10t2', 'A typo in a method', 'const grid = [[0, 0], [0, 0]];\nconsole.log(grid.length);\ngrid.lenght();',
          ["Reading a key that doesn't exist gives undefined, and calling undefined as a function throws.", "Look closely at how lenght is spelled.", "It prints 2, and then the last line throws a TypeError."], ['error'], 'What does this print? If a line throws, write the error type for that line.'),
        T('u10t3', 'No base case', 'function loop(n) {\n  return loop(n + 1);\n}\nloop(0);',
          ["Every call makes another call before it can return.", "The frames keep stacking up until the engine refuses to add more.", "The program throws a RangeError."], ['recursion', 'error'], 'What does this print? If a line throws, write the error type for that line.'),
        T('u10t4', 'A misspelled name', 'let total = 0;\nfor (let i = 0; i < 3; i++) {\n  totl += i;\n}\nconsole.log(total);',
          ["Compare the names on lines 1 and 3.", "totl is declared nowhere, so reading it fails before += can run.", "Line 3 throws a ReferenceError, so the last line never runs and nothing is printed."], ['error'], 'What does this print? If a line throws, write the error type for that line.'),
      ],
    },
  ];

  // Blank-page versions of the two fill-in grid functions, with the same tests as the fill-in items.
  {
    const u6 = stage1.find(u => u.id === 'u6');
    const f1 = u6.items.find(i => i.id === 'u6f1'), f2 = u6.items.find(i => i.id === 'u6f2');
    u6.items.push(
      W('u6w3', 'Write makeGrid', 'Write `makeGrid(rows, cols, value)` with no starter code. It returns a new grid with `rows` rows and `cols` columns, every cell set to `value`, and every row a separate array.',
        'function makeGrid(rows, cols, value) {\n  \n}\n', f1.tests,
        ['Start with an empty array for the grid, and build one row on each pass of a loop that runs rows times.', 'Create each row as a new empty array inside that loop, push value onto it cols times, and then push the row onto the grid.', 'Creating the row inside the outer loop matters, because a row created once and pushed on every pass would make every row the same array.'], ['grid']),
      W('u6w4', 'Write placeMines', 'Write `placeMines(grid, n)` with no starter code. It puts `"M"` on exactly `n` different cells chosen at random and changes nothing else. If `n` is more than the number of cells, it prints `too many mines` and returns without placing any.',
        'function placeMines(grid, n) {\n  \n}\n', f2.tests,
        ['First compare n with the number of cells, which is the number of rows times the length of one row, and return early when n is too large.', 'Keep a count of the mines placed and loop until it reaches n, picking a random row and a random column on each pass with Math.floor(Math.random() * size).', 'Place a mine and add to the count only when the chosen cell isn\'t already "M", so a repeated pick is skipped without counting.'], ['grid', 'random']));
  }

  // ---------- Stage 2: the browser ----------
  // Your Stage 1 grid functions, defined out of sight for the Unit 14 and 15 items so they can build on them.
  const PRELUDE = [
    'function makeGrid(rows, cols, value) { const grid = []; for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) row.push(value); grid.push(row); } return grid; }',
    'function placeMines(grid, n) { const rows = grid.length, cols = grid[0].length; if (n > rows * cols) { console.log("too many mines"); return; } let placed = 0; while (placed < n) { const r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols); if (grid[r][c] !== "M") { grid[r][c] = "M"; placed++; } } }',
    'function countNeighbors(grid, r, c) { let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue; const nr = r + dr, nc = c + dc; if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && grid[nr][nc] === "M") n++; } return n; }',
    'function fillCounts(grid) { for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) if (grid[r][c] !== "M") grid[r][c] = countNeighbors(grid, r, c); }',
    'function floodFill(grid, revealed, r, c) { if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length || revealed[r][c]) return; revealed[r][c] = true; if (grid[r][c] !== 0) return; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr !== 0 || dc !== 0) floodFill(grid, revealed, r + dr, c + dc); }',
  ].join('\n');
  const D = { dom: true };
  const DP = { dom: true, page: true };
  const DPre = { dom: true, prelude: PRELUDE };
  const BOARD23 = 'const b = document.createElement("div");\nfor (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const d = document.createElement("div"); d.className = "cell"; d.dataset.r = r; d.dataset.c = c; b.appendChild(d); }\nconst got = [];\n';
  const STATE23 = 'const S0 = () => ({ rows: 2, cols: 3, grid: [["M", 1, 0], [1, 1, 0]], revealed: [[false, false, false], [false, false, false]], flagged: [[false, false, false], [false, false, false]], over: false, won: false });\n';

  const stage2 = [
    {
      id: 'u11', title: 'Elements, HTML and CSS', dom: true,
      read: [
        'A web page is a tree of **elements**. In HTML, the text format pages are written in, an element is an opening tag, its contents and a closing tag, as in `<div class="cell">3</div>`. Elements nest inside one another, so a board can be a `div` whose children are the cell `div`s. **Attributes** such as `id` and `class` sit inside the opening tag. An `id` names one element on the page, and a `class` is a label that any number of elements can share.',
        '**CSS** is the language that styles elements. A rule such as `.cell { width: 28px; }` applies to every element with the class `cell`. A board is easiest to lay out with CSS grid: giving the board `display: grid` and `grid-template-columns: repeat(9, 28px)` arranges its children into rows of nine 28-pixel columns, starting a new row after every ninth child.',
        'On this site the page\'s stylesheet is already written. `.board` is a grid, `.cell` is a square, and the classes `revealed`, `mine` and `flag` change how a cell looks. Your code builds the elements, and the preview under the tests shows the page it produced.',
      ],
      example: 'const board = document.createElement("div");\nboard.className = "board";\nfor (let i = 0; i < 3; i++) {\n  const cell = document.createElement("div");\n  cell.className = "cell";\n  board.appendChild(cell);\n}\ndocument.body.appendChild(board);',
      items: [
        W('u11w1', 'Write makeRow', 'Write `makeRow(n)`. It creates a `div` with the class `row`, gives it `n` child `div`s that each have the class `cell`, and returns the row without putting it on the page.',
          'function makeRow(n) {\n  \n}\n',
          [{ name: 'makeRow(3) is a div with the class row', body: 'const r = makeRow(3);\nreturn eq([r.tagName, r.className], ["DIV", "row"]);' }, { name: 'it has three cell children', body: 'return eq(Array.from(makeRow(3).children).map(c => c.className), ["cell", "cell", "cell"]);' }, { name: 'makeRow(0) has no children', code: 'eq(makeRow(0).children.length, 0)' }, { name: 'the row stays off the page', body: 'makeRow(2);\nreturn eq(document.body.children.length, 0);' }],
          ['document.createElement("div") creates a new div element in the heap and returns its address.', 'Set the row\'s className, then use a loop that creates n cells, sets each one\'s className, and appends each to the row with appendChild.', 'Return the row at the end, and leave out anything that touches document.body, since the caller decides where the row goes.'], ['dom'], D),
        W('u11w2', 'Write buildBoard', 'Write `buildBoard(rows, cols)`. It creates a `div` with the id `board` and the class `board`, sets its `style.gridTemplateColumns` to `repeat(cols, 28px)` with the actual number in place of `cols`, and fills it with `rows × cols` cells. Each cell is a `div` with the class `cell` whose `dataset.r` and `dataset.c` hold its row and column. The function appends the board to `document.body` and returns it. The starter\'s last line calls it, so the preview shows the result.',
          'function buildBoard(rows, cols) {\n  \n}\n\nbuildBoard(9, 9);\n',
          [{ name: 'the board is on the page with its id and class', body: 'document.body.replaceChildren();\nconst b = buildBoard(2, 3);\nreturn eq([document.getElementById("board") === b, b.className], [true, "board"]);' }, { name: 'a 2 × 3 board has 6 cells', body: 'document.body.replaceChildren();\nreturn eq(buildBoard(2, 3).children.length, 6);' }, { name: 'the grid has the right number of columns', body: 'document.body.replaceChildren();\nreturn eq(buildBoard(2, 3).style.gridTemplateColumns, "repeat(3, 28px)");' }, { name: 'cells know their row and column', body: 'document.body.replaceChildren();\nconst c = buildBoard(3, 4).children[6];\nreturn eq([c.className, c.dataset.r, c.dataset.c], ["cell", "1", "2"]);' }],
          ['Build the board element first, set its id, className and style.gridTemplateColumns, and then add the cells.', 'Two loops, rows outside and columns inside, create each cell, set cell.dataset.r and cell.dataset.c, and append it to the board in reading order.', 'dataset values are stored as strings, so cell.dataset.r = r stores "1" for row 1. Finish with document.body.appendChild(board) and return the board.'], ['dom'], DP),
      ],
    },
    {
      id: 'u12', title: 'The DOM: elements as objects', dom: true,
      read: [
        'The browser turns the page into a tree of objects called the **DOM** (Document Object Model), and `document` is the name through which your code reaches it. `document.createElement("div")` creates a new element object in the heap and returns its address, exactly as an object literal does. The element appears on the page only once it is attached to an element that is already there, for example with `document.body.appendChild(el)`, which stores the element\'s address in the body\'s list of children.',
        'Since a name holds an element\'s address, a change made through any name changes the one element on the page. `el.textContent = "3"` replaces the text inside it, `el.classList.add("revealed")` adds a class and `classList.remove` takes one away, and `el.dataset.r` reads the attribute `data-r`, always as a string. To find elements again later, `document.getElementById("board")` returns the element with that id, and `board.children[i]` returns the board\'s child at index `i`.',
        'For a board stored row by row, the cell at row `r` and column `c` is child number `r * cols + c`. Going the other way, child number `i` sits in row `Math.floor(i / cols)` and column `i % cols`.',
      ],
      example: 'const cols = 9;\nconst i = 40;\nconsole.log(Math.floor(i / cols), i % cols);\nconsole.log(4 * cols + 4);',
      items: [
        T('u12t1', 'From index to row and column', 'const cols = 9;\nfor (const i of [0, 8, 9, 40, 80]) {\n  console.log(i, Math.floor(i / cols), i % cols);\n}',
          ['Each row holds 9 cells, so dividing an index by 9 and rounding down gives its row.', '`%` gives the remainder after dividing, which is the position within the row.', 'Index 9 is the first cell of row 1, and index 80 is the last cell of row 8.'], ['grid']),
        T('u12t2', 'From row and column to index', 'const cols = 4;\nconst pairs = [[0, 0], [0, 3], [1, 0], [2, 1]];\nfor (const [r, c] of pairs) {\n  console.log(r * cols + c);\n}',
          ['Every full row before row r contributes cols cells.', 'With 4 columns, row 1 starts at index 4 and row 2 at index 8.', 'The four indexes are 0, 3, 4 and 9.'], ['grid']),
        W('u12w1', 'Write showCell', 'Write `showCell(cell, value)`. It marks a cell as revealed: it adds the class `revealed` and sets the text to `value`. When `value` is `"M"`, it also adds the class `mine` and shows `*` as the text, and a value of 0 shows as empty text.',
          'function showCell(cell, value) {\n  \n}\n',
          [{ name: 'a number shows as text', body: 'const c = document.createElement("div"); c.className = "cell";\nshowCell(c, 3);\nreturn eq([c.textContent, c.classList.contains("revealed")], ["3", true]);' }, { name: '0 shows as empty text', body: 'const c = document.createElement("div");\nshowCell(c, 0);\nreturn eq(c.textContent, "");' }, { name: 'a mine', body: 'const c = document.createElement("div");\nshowCell(c, "M");\nreturn eq([c.textContent, c.classList.contains("mine"), c.classList.contains("revealed")], ["*", true, true]);' }, { name: 'the cell class stays', body: 'const c = document.createElement("div"); c.className = "cell";\nshowCell(c, 1);\nreturn eq(c.classList.contains("cell"), true);' }],
          ['classList.add("revealed") adds the class and keeps the ones already there.', 'Handle the mine case first, then the 0 case, and otherwise set textContent to the value.', 'Assigning a number to textContent stores it as text, so 3 becomes "3", and the 0 case needs textContent = "".'], ['dom'], D),
        W('u12w2', 'Write cellAt', 'Write `cellAt(board, r, c, cols)`. It returns the cell element at row `r` and column `c` of a board whose cells are stored row by row, with `cols` cells in each row.',
          'function cellAt(board, r, c, cols) {\n  \n}\n',
          [{ name: 'row 1, column 2 of a 4-wide board', body: 'const b = document.createElement("div");\nfor (let i = 0; i < 12; i++) { const d = document.createElement("div"); d.dataset.i = i; b.appendChild(d); }\nreturn eq(cellAt(b, 1, 2, 4).dataset.i, "6");' }, { name: 'the first and last cells', body: 'const b = document.createElement("div");\nfor (let i = 0; i < 12; i++) { const d = document.createElement("div"); d.dataset.i = i; b.appendChild(d); }\nreturn eq([cellAt(b, 0, 0, 4).dataset.i, cellAt(b, 2, 3, 4).dataset.i], ["0", "11"]);' }],
          ['The board\'s children form one list in reading order.', 'Row r starts at index r * cols.', 'Add c to the row\'s starting index and read that child from board.children.'], ['dom'], D),
      ],
    },
    {
      id: 'u13', title: 'Events and one listener on the board', dom: true,
      read: [
        '`el.addEventListener("click", handler)` stores the function `handler` in the element\'s list of listeners and returns at once. The browser calls `handler` later, each time the user clicks, and passes it an **event** object describing the click. Your code therefore runs in two phases: the first run builds the page and registers listeners, and after that the listeners run one at a time, whenever the user acts.',
        'A click on a cell is delivered first to the cell and then to each of its ancestors in turn, up to the page itself, which is called **bubbling**. So a single listener on the board hears clicks on every cell, and inside it `event.target` is the element that was actually clicked. Checking `event.target.classList.contains("cell")` skips clicks that land on the board\'s gaps, and `Number(event.target.dataset.r)` turns the stored row back into a number.',
        'A right-click fires a `contextmenu` event. Calling `event.preventDefault()` in its listener stops the browser from opening its own menu, which Minesweeper needs for placing flags.',
      ],
      example: 'const button = document.createElement("button");\nbutton.textContent = "Click me";\nbutton.addEventListener("click", (event) => {\n  event.target.textContent = "Clicked";\n});\ndocument.body.appendChild(button);',
      items: [
        W('u13w1', 'Write attachCounter', 'Write `attachCounter(button)`. It adds a click listener to `button` that counts the clicks and sets the button\'s text to `Clicked 1 time`, `Clicked 2 times` and so on. Each button keeps its own count.',
          'function attachCounter(button) {\n  \n}\n\nconst b = document.createElement("button");\nb.textContent = "Click me";\ndocument.body.appendChild(b);\nattachCounter(b);\n',
          [{ name: 'one click', body: 'const b = document.createElement("button");\nattachCounter(b);\nclick(b);\nreturn eq(b.textContent, "Clicked 1 time");' }, { name: 'three clicks', body: 'const b = document.createElement("button");\nattachCounter(b);\nclick(b); click(b); click(b);\nreturn eq(b.textContent, "Clicked 3 times");' }, { name: 'two buttons count separately', body: 'const a = document.createElement("button"), b = document.createElement("button");\nattachCounter(a); attachCounter(b);\nclick(a); click(a); click(b);\nreturn eq([a.textContent, b.textContent], ["Clicked 2 times", "Clicked 1 time"]);' }, { name: 'nothing changes before a click', body: 'const b = document.createElement("button"); b.textContent = "Go";\nattachCounter(b);\nreturn eq(b.textContent, "Go");' }],
          ['Keep the count in a let inside attachCounter, so each call gets its own count, as with makeCounter in Unit 9.', 'The listener adds one to the count and then sets button.textContent.', 'Choose between "time" and "times" with a condition on the count.'], ['dom', 'closure'], DP),
        W('u13w2', 'Write listenToBoard', 'Write `listenToBoard(board, onCell)`. It adds one click listener to `board`. When a click lands on an element with the class `cell`, the listener calls `onCell(r, c)` with that cell\'s row and column as numbers, taken from its `dataset`, and it ignores clicks anywhere else.',
          'function listenToBoard(board, onCell) {\n  \n}\n',
          [{ name: 'a click on a cell', body: BOARD23 + 'listenToBoard(b, (r, c) => got.push([r, c]));\nclick(b.children[4]);\nreturn eq(got, [[1, 1]]);' }, { name: 'the row and column are numbers', body: BOARD23 + 'listenToBoard(b, (r, c) => got.push([r, c]));\nclick(b.children[5]);\nreturn eq(typeof got[0][0], "number");' }, { name: 'a click on the board itself is ignored', body: BOARD23 + 'listenToBoard(b, (r, c) => got.push([r, c]));\nclick(b);\nreturn eq(got, []);' }, { name: 'one listener, on the board only', body: BOARD23 + 'listenToBoard(b, (r, c) => got.push([r, c]));\nreturn eq([listenerCount(b, "click"), Array.from(b.children).every(c => listenerCount(c, "click") === 0)], [1, true]);' }],
          ['Call board.addEventListener once, and read the clicked element from the event\'s target inside the listener.', 'Return early when event.target doesn\'t have the class cell.', 'Number(event.target.dataset.r) and Number(event.target.dataset.c) give the row and column to pass to onCell.'], ['dom'], D),
        W('u13w3', 'Write listenForFlags', 'Write `listenForFlags(board, onFlag)`. It adds one `contextmenu` listener to `board` that stops the browser\'s menu with `preventDefault` and, when the right-click lands on a cell, calls `onFlag(r, c)` with the cell\'s row and column as numbers.',
          'function listenForFlags(board, onFlag) {\n  \n}\n',
          [{ name: 'a right-click calls onFlag', body: BOARD23 + 'listenForFlags(b, (r, c) => got.push([r, c]));\nrightClick(b.children[2]);\nreturn eq(got, [[0, 2]]);' }, { name: 'the browser\'s menu is stopped', body: BOARD23 + 'listenForFlags(b, (r, c) => got.push([r, c]));\nreturn eq(rightClick(b.children[0]).defaultPrevented, true);' }, { name: 'a plain click does nothing', body: BOARD23 + 'listenForFlags(b, (r, c) => got.push([r, c]));\nclick(b.children[0]);\nreturn eq(got, []);' }],
          ['The event name for a right-click is "contextmenu".', 'Call event.preventDefault() first, then check the target\'s class as in listenToBoard.', 'Pass Number(event.target.dataset.r) and Number(event.target.dataset.c) to onFlag.'], ['dom'], D),
      ],
    },
    {
      id: 'u14', title: 'State in one object, redrawn from it', dom: true,
      read: [
        'Once listeners are involved, the safest design keeps everything the game knows in one plain object, called the **state**, and treats the page as a picture of that object. A Minesweeper state can hold the board size, the grid of numbers and mines, a grid of `true` and `false` for revealed cells, another for flags, and whether the game is over.',
        'Each listener then does two things: it changes the state through a function such as `reveal(state, r, c)`, and it calls one `render` function that rebuilds the board\'s cells from the state. Because the page is always redrawn from the state, the two can never disagree, and the game\'s rules can be tested without any page at all.',
        'In this unit, `makeGrid`, `placeMines`, `countNeighbors`, `fillCounts` and `floodFill` are already defined, and they behave like the Stage 1 items of the same names.',
      ],
      example: 'const state = { count: 0 };\nconst label = document.createElement("p");\nconst button = document.createElement("button");\nbutton.textContent = "Add one";\nfunction render() {\n  label.textContent = "Count: " + state.count;\n}\nbutton.addEventListener("click", () => {\n  state.count += 1;\n  render();\n});\ndocument.body.append(label, button);\nrender();',
      items: [
        W('u14w1', 'Write newGame', 'Write `newGame(rows, cols, mines)`. It returns a state object with the keys `rows`, `cols`, `grid`, `revealed`, `flagged`, `over` and `won`. `grid` is a new grid with `mines` mines placed and every other cell holding its neighbor count. `revealed` and `flagged` are grids of the same size filled with `false`, and `over` and `won` both start as `false`.',
          'function newGame(rows, cols, mines) {\n  \n}\n',
          [{ name: 'the seven keys', body: 'return eq(Object.keys(newGame(3, 4, 2)).sort(), ["cols", "flagged", "grid", "over", "revealed", "rows", "won"]);' }, { name: '10 mines on a 9 × 9 board', body: 'return eq(newGame(9, 9, 10).grid.flat().filter(x => x === "M").length, 10);' }, { name: 'every other cell holds its count', body: 'const s = newGame(5, 5, 4);\nlet right = true;\nfor (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (s.grid[r][c] !== "M" && s.grid[r][c] !== countNeighbors(s.grid, r, c)) right = false;\nreturn eq(right, true);' }, { name: 'nothing is revealed or flagged yet', body: 'const s = newGame(2, 3, 1);\nconst F = [[false, false, false], [false, false, false]];\nreturn eq([s.revealed, s.flagged, s.over, s.won], [F, F, false, false]);' }, { name: 'revealed rows are separate arrays', body: 'const s = newGame(2, 2, 0);\ns.revealed[0][0] = true;\nreturn eq(s.revealed[1][0], false);' }],
          ['Start from makeGrid(rows, cols, 0), then call placeMines and fillCounts on it.', 'Build revealed and flagged with makeGrid as well, so each row is a separate array.', 'Return one object literal holding all seven keys.'], ['state'], DPre),
        W('u14w2', 'Write reveal', 'Write `reveal(state, r, c)`. It does nothing when the game is over or the cell is flagged. Revealing a mine marks that cell revealed and sets `over` to `true`. Revealing any other cell uses `floodFill`, so a 0 opens the area around it. After revealing a cell that isn\'t a mine, if every non-mine cell is revealed, it sets both `won` and `over` to `true`.',
          'function reveal(state, r, c) {\n  \n}\n',
          [{ name: 'a 0 opens its area', body: STATE23 + 'const s = S0();\nreveal(s, 0, 2);\nreturn eq(s.revealed, [[false, true, true], [false, true, true]]);' }, { name: 'a mine ends the game', body: STATE23 + 'const s = S0();\nreveal(s, 0, 0);\nreturn eq([s.revealed[0][0], s.over, s.won], [true, true, false]);' }, { name: 'a flagged cell stays hidden', body: STATE23 + 'const s = S0(); s.flagged[0][2] = true;\nreveal(s, 0, 2);\nreturn eq(s.revealed[0][2], false);' }, { name: 'revealing every safe cell wins', body: STATE23 + 'const s = S0();\nreveal(s, 0, 2); reveal(s, 1, 0);\nreturn eq([s.won, s.over], [true, true]);' }, { name: 'nothing happens after the game ends', body: STATE23 + 'const s = S0(); s.over = true;\nreveal(s, 1, 0);\nreturn eq(s.revealed[1][0], false);' }],
          ['Return early when state.over is true or the cell is flagged.', 'For a mine, set the cell\'s revealed entry and state.over and return. For anything else, call floodFill(state.grid, state.revealed, r, c).', 'To check for a win, loop over every cell looking for a non-mine cell that is still hidden, and set won and over only when there is none.'], ['state'], DPre),
        W('u14w3', 'Write toggleFlag', 'Write `toggleFlag(state, r, c)`. On a hidden cell it switches the flag on or off. It does nothing on a revealed cell or after the game is over.',
          'function toggleFlag(state, r, c) {\n  \n}\n',
          [{ name: 'on, then off again', body: 'const s = { over: false, revealed: [[false]], flagged: [[false]] };\ntoggleFlag(s, 0, 0); const first = s.flagged[0][0];\ntoggleFlag(s, 0, 0);\nreturn eq([first, s.flagged[0][0]], [true, false]);' }, { name: 'a revealed cell can\'t be flagged', body: 'const s = { over: false, revealed: [[true]], flagged: [[false]] };\ntoggleFlag(s, 0, 0);\nreturn eq(s.flagged[0][0], false);' }, { name: 'no flags after the game ends', body: 'const s = { over: true, revealed: [[false]], flagged: [[false]] };\ntoggleFlag(s, 0, 0);\nreturn eq(s.flagged[0][0], false);' }],
          ['Return early when the game is over or the cell is already revealed.', 'The ! operator turns true into false and false into true.', 'Assign the flipped value back into state.flagged[r][c].'], ['state'], DPre),
        W('u14w4', 'Write render', 'Write `render(state, board)`. It removes the board\'s old cells and creates one `div` with the class `cell` for every position, in reading order, with `dataset.r` and `dataset.c` set. A revealed cell also gets the class `revealed` and shows its number, with 0 as empty text, and a revealed mine gets the class `mine` and shows `*`. A flagged hidden cell gets the class `flag` and shows `F`.',
          'function render(state, board) {\n  \n}\n',
          [{ name: 'one cell per position', body: 'const s = { rows: 2, cols: 3, grid: [["M", 1, 0], [1, 1, 0]], revealed: [[true, true, true], [false, false, false]], flagged: [[false, false, false], [true, false, false]] };\nconst b = document.createElement("div");\nrender(s, b);\nreturn eq(b.children.length, 6);' }, { name: 'the text of each cell', body: 'const s = { rows: 2, cols: 3, grid: [["M", 1, 0], [1, 1, 0]], revealed: [[true, true, true], [false, false, false]], flagged: [[false, false, false], [true, false, false]] };\nconst b = document.createElement("div");\nrender(s, b);\nreturn eq(Array.from(b.children).map(c => c.textContent), ["*", "1", "", "F", "", ""]);' }, { name: 'the classes of each cell', body: 'const s = { rows: 2, cols: 3, grid: [["M", 1, 0], [1, 1, 0]], revealed: [[true, true, true], [false, false, false]], flagged: [[false, false, false], [true, false, false]] };\nconst b = document.createElement("div");\nrender(s, b);\nreturn eq(Array.from(b.children).map(c => Array.from(c.classList).sort().join(" ")), ["cell mine revealed", "cell revealed", "cell revealed", "cell flag", "cell", "cell"]);' }, { name: 'rendering twice replaces the old cells', body: 'const s = { rows: 1, cols: 2, grid: [[0, 0]], revealed: [[false, false]], flagged: [[false, false]] };\nconst b = document.createElement("div");\nrender(s, b); render(s, b);\nreturn eq(b.children.length, 2);' }, { name: 'cells store their row and column', body: 'const s = { rows: 2, cols: 3, grid: [["M", 1, 0], [1, 1, 0]], revealed: [[false, false, false], [false, false, false]], flagged: [[false, false, false], [false, false, false]] };\nconst b = document.createElement("div");\nrender(s, b);\nreturn eq([b.children[4].dataset.r, b.children[4].dataset.c], ["1", "1"]);' }],
          ['board.replaceChildren() with no arguments removes every child.', 'Two loops create the cells in reading order; set the className and the dataset first.', 'Then check revealed before flagged, and for a revealed cell check for a mine before setting the number.'], ['state', 'dom'], D),
      ],
    },
    {
      id: 'u15', title: 'Full Minesweeper', dom: true,
      read: [
        'This unit puts Stage 2 together into a playable game. Your code builds the state with `newGame`, draws it with `render`, and registers one click listener and one `contextmenu` listener on the board, each of which updates the state and then draws it again. A paragraph with the id `status` tells the player whether the game is still going, won or lost.',
        'The Stage 1 grid functions are defined here too. The preview under the tests is the real game, so you can play it once the tests pass.',
      ],
      example: '// The order of a click, from the user to the page:\n// 1. the browser calls your click listener with the event\n// 2. the listener reads the row and column from event.target.dataset\n// 3. reveal(state, r, c) changes the state\n// 4. render(state, board) redraws every cell from the state',
      items: [
        W('u15w1', 'Write Minesweeper', 'Write the whole game in this editor, reusing your `newGame`, `reveal`, `toggleFlag` and `render` from Unit 14. When the code runs, it puts a `div` with the id `board` and the class `board` on the page, 9 by 9 with 10 mines, followed by a `p` with the id `status`. A left click reveals a cell and a right click toggles a flag. The status reads `Playing` during the game, `You won` after a win, and `Game over` after a mine.',
          '// Paste newGame, reveal, toggleFlag and render from Unit 14 here.\n\n',
          [{ name: 'the board and status are on the page', body: 'const b = document.getElementById("board"), s = document.getElementById("status");\nreturn eq([!!b && b.classList.contains("board"), !!s && s.tagName, s && s.textContent], [true, "P", "Playing"]);' }, { name: '81 cells', code: 'eq(document.getElementById("board").children.length, 81)' }, { name: 'one click listener on the board', code: 'eq(listenerCount(document.getElementById("board"), "click"), 1)' }, { name: 'a right-click flags a cell, and a second removes it', body: 'rightClick(document.getElementById("board").children[0]);\nconst on = document.getElementById("board").children[0].classList.contains("flag");\nrightClick(document.getElementById("board").children[0]);\nreturn eq([on, document.getElementById("board").children[0].classList.contains("flag")], [true, false]);' }, { name: 'a click reveals a cell', body: 'click(document.getElementById("board").children[40]);\nreturn eq(document.getElementById("board").children[40].classList.contains("revealed"), true);' }, { name: 'clicking cells in order ends the game', body: 'for (let i = 0; i < 81; i++) {\n  const cell = document.getElementById("board").children[i];\n  if (!cell.classList.contains("revealed")) click(cell);\n  if (document.getElementById("status").textContent !== "Playing") break;\n}\nreturn eq(["Game over", "You won"].includes(document.getElementById("status").textContent), true);' }],
          ['Create the state with newGame(9, 9, 10), create the board and status elements, append both to document.body, and call render once.', 'The click listener calls reveal with the clicked cell\'s row and column and then redraws; the contextmenu listener calls preventDefault, then toggleFlag, then redraws.', 'A small draw function that calls render and then sets the status text from state.won and state.over keeps the two listeners short.'], ['state', 'dom'], { dom: true, page: true, prelude: PRELUDE }),
      ],
    },
  ];

  // ---------- Stage 3: things that happen later ----------
  // Traces whose output depends on timers or promises carry their expected output, checked against Chrome's
  // engine by the test suite, since the Memory tracer doesn't model the event loop.
  const TX = (id, title, code, expect, hints, tags) => ({ type: 'trace', id, title, code, expect, hints, tags: tags || [], noTrace: true });
  const NEXTGEN = 'function nextGeneration(grid) { return grid.map((row, r) => row.map((v, c) => { let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < grid.length && cc >= 0 && cc < row.length) n += grid[rr][cc]; } return n === 3 || (n === 2 && v === 1) ? 1 : 0; })); }';
  const DIRFOR = 'function directionFor(key) { const m = { ArrowUp: { dr: -1, dc: 0 }, w: { dr: -1, dc: 0 }, ArrowDown: { dr: 1, dc: 0 }, s: { dr: 1, dc: 0 }, ArrowLeft: { dr: 0, dc: -1 }, a: { dr: 0, dc: -1 }, ArrowRight: { dr: 0, dc: 1 }, d: { dr: 0, dc: 1 } }; return m[key] || null; }';
  const LIFE = 'const alive = () => Array.from(document.getElementById("life").children).map((c, i) => c.classList.contains("alive") ? i : -1).filter(i => i >= 0).join(",");\n';
  const BOARD = 'const cells = () => document.getElementById("board").children;\nconst status = () => document.getElementById("status").textContent;\n';

  const stage3 = [
    {
      id: 'u16', title: 'Timers and the Game of Life', dom: true,
      read: [
        '`setTimeout(fn, ms)` asks the browser to call `fn` once, at least `ms` milliseconds from now, and returns at once with a number that identifies the timer. `setInterval(fn, ms)` calls `fn` again and again, every `ms` milliseconds, until you pass its number to `clearInterval`. In both cases the function is stored for later and the code after the call keeps running.',
        'The browser runs one piece of code at a time. A timer\'s function can run only once the code currently running has finished, which is why `setTimeout(fn, 0)` still runs `fn` after every line that follows it. The mechanism that picks the next waiting function to run is called the **event loop**, and click listeners wait in the same line as timers.',
        'An animation or a game built on a timer follows the pattern from Unit 14: each tick updates the state and then redraws the page from it. On this site the tests control the clock directly, so a test can move time forward by exactly 200 milliseconds and check what happened, while the preview runs in real time.',
      ],
      example: 'const label = document.createElement("p");\ndocument.body.appendChild(label);\nlet seconds = 0;\nlabel.textContent = "0 seconds";\nconst id = setInterval(() => {\n  seconds += 1;\n  label.textContent = seconds + " seconds";\n  if (seconds === 5) clearInterval(id);\n}, 1000);',
      items: [
        TX('u16t1', 'setTimeout waits its turn', 'console.log("A");\nsetTimeout(() => console.log("B"), 0);\nconsole.log("C");\nsetTimeout(() => console.log("D"), 100);\nsetTimeout(() => console.log("E"), 50);', ['A', 'C', 'B', 'E', 'D'],
          ['A timer\'s function runs only after all the code that is currently running has finished.', 'Among the timers, the one due soonest runs first, whatever order they were created in.', 'A and C print first, then the timers in the order of their delays: 0, then 50, then 100 milliseconds.'], ['timers']),
        TX('u16t2', 'An interval that stops itself', 'let n = 0;\nconst id = setInterval(() => {\n  n += 1;\n  console.log("tick " + n);\n  if (n === 3) clearInterval(id);\n}, 100);\nconsole.log("started");', ['started', 'tick 1', 'tick 2', 'tick 3'],
          ['setInterval returns right away, so the line after it runs before any tick.', 'Each tick adds one to n, and the third tick clears the interval.', 'It prints started, then tick 1, tick 2 and tick 3.'], ['timers']),
        W('u16w1', 'Write nextGeneration', 'Write `nextGeneration(grid)` for Conway\'s Game of Life, where `grid` is an array of rows holding 1 for a live cell and 0 for a dead one. It returns a new grid of the same size and leaves `grid` unchanged. A live cell with two or three live neighbors stays alive, a dead cell with exactly three live neighbors comes alive, and every other cell is dead in the new grid. Neighbors are the up to eight surrounding cells, and cells past the edge count as dead.',
          'function nextGeneration(grid) {\n  \n}\n',
          [{ name: 'a blinker turns from a row into a column', code: 'eq(nextGeneration([[0, 0, 0], [1, 1, 1], [0, 0, 0]]), [[0, 1, 0], [0, 1, 0], [0, 1, 0]])' }, { name: 'a block stays the same', code: 'eq(nextGeneration([[1, 1], [1, 1]]), [[1, 1], [1, 1]])' }, { name: 'a lonely cell dies', code: 'eq(nextGeneration([[0, 0, 0], [0, 1, 0], [0, 0, 0]]), [[0, 0, 0], [0, 0, 0], [0, 0, 0]])' }, { name: 'the input grid is unchanged', body: 'const g = [[0, 0, 0], [1, 1, 1], [0, 0, 0]];\nnextGeneration(g);\nreturn eq(g, [[0, 0, 0], [1, 1, 1], [0, 0, 0]]);' }, { name: 'it returns a new grid', body: 'const g = [[1, 1], [1, 1]];\nreturn ok(nextGeneration(g) !== g, "the same grid", "a new grid");' }],
          ['Count each cell\'s live neighbors the way countNeighbors counted mines, adding the 1 or 0 held by each neighbor.', 'Build the result as a separate grid, because changing cells in place would change the counts of cells checked after them.', 'For each cell, the new value is 1 when the count is 3, or when the count is 2 and the cell is alive now, and 0 otherwise.'], ['grid']),
        W('u16w2', 'Animate the Game of Life', 'Write a page that animates the Game of Life, using the `nextGeneration` function that is already defined here. Start from `start`, the 12 × 12 grid in the starter, and draw it inside a `div` with the id `life` and the class `grid`, whose `style.gridTemplateColumns` is `repeat(12, 28px)`, as one `div` with the class `cell` per position, adding the class `alive` to live cells. A button with the id `toggle` and the text `Start` begins a timer that moves to the next generation and redraws every 200 milliseconds, and its text changes to `Stop`. Clicking it again stops the timer and changes the text back.',
          '// A glider in the top-left corner of a 12 × 12 grid.\nconst start = Array.from({ length: 12 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r === 0 && c === 1) || (r === 1 && c === 2) || (r === 2 && c < 3) ? 1 : 0));\n\n',
          [{ name: 'the grid is drawn', body: 'const g = document.getElementById("life");\nreturn eq([g.children.length, Array.from(g.children).filter(c => c.classList.contains("alive")).length, document.getElementById("toggle").textContent], [144, 5, "Start"]);' }, { name: 'Start begins the animation', body: LIFE + 'const before = alive();\nclick(document.getElementById("toggle"));\ntick(200);\nreturn eq([alive() !== before, document.getElementById("toggle").textContent], [true, "Stop"]);' }, { name: 'after four generations the glider has moved one cell diagonally', body: LIFE + 'tick(600);\nreturn eq(alive(), "14,27,37,38,39");' }, { name: 'Stop stops it', body: LIFE + 'click(document.getElementById("toggle"));\nconst a = alive();\ntick(1000);\nreturn eq([alive() === a, document.getElementById("toggle").textContent], [true, "Start"]);' }],
          ['Keep the current grid in a let, write a draw function that rebuilds the cells from it, and call draw once at the start.', 'The button\'s click listener checks whether a timer is running: if not, it calls setInterval and stores the id it returns, and if so, it calls clearInterval with that id and forgets it.', 'Inside the interval\'s function, replace the current grid with nextGeneration of it and then call draw.'], ['timers', 'dom'], { dom: true, page: true, prelude: NEXTGEN }),
      ],
    },
    {
      id: 'u17', title: 'Keyboard events and Snake', dom: true,
      read: [
        'Key presses arrive as `keydown` events. A listener added with `document.addEventListener("keydown", handler)` hears every key pressed while the page has focus, and `event.key` names the key as a string, such as `"ArrowUp"`, `"a"`, or `" "` for the space bar. Calling `event.preventDefault()` for the arrow keys stops the browser from also scrolling the page.',
        'A game that moves on a timer, such as Snake, should only record the key in the state, for example by setting the direction, and let the next tick do the moving. Keeping all the movement in one place means a key pressed twice between ticks can\'t move the snake twice, and it is where the rule against turning straight back into yourself belongs.',
        'On this site, click the preview once so that it has focus, and the arrow keys then go to your page.',
      ],
      example: 'const label = document.createElement("p");\nlabel.textContent = "Click here, then press any key";\ndocument.body.appendChild(label);\ndocument.addEventListener("keydown", (event) => {\n  label.textContent = "You pressed " + event.key;\n});',
      items: [
        W('u17w1', 'Write directionFor', 'Write `directionFor(key)`. It returns `{ dr, dc }`, the change in row and column for a key: `"ArrowUp"` and `"w"` give `{ dr: -1, dc: 0 }`, `"ArrowDown"` and `"s"` give `{ dr: 1, dc: 0 }`, `"ArrowLeft"` and `"a"` give `{ dr: 0, dc: -1 }`, and `"ArrowRight"` and `"d"` give `{ dr: 0, dc: 1 }`. Any other key gives `null`.',
          'function directionFor(key) {\n  \n}\n',
          [{ name: 'the arrow keys', code: 'eq(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map(directionFor), [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }])' }, { name: 'w, a, s and d', code: 'eq(["w", "a", "s", "d"].map(directionFor), [{ dr: -1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 1, dc: 0 }, { dr: 0, dc: 1 }])' }, { name: 'any other key gives null', code: 'eq([directionFor("x"), directionFor("Enter"), directionFor(" ")], [null, null, null])' }],
          ['An object literal can map each key name to its direction, which saves a long chain of if statements.', 'Look the key up in that object and return what you find.', 'Looking up a key the object doesn\'t have gives undefined, so check for that and return null in its place.'], ['object']),
        W('u17w2', 'Move a square with the keys', 'Write a page with a `div` with the id `board` and the class `board`, 9 by 9 cells with the class `cell`, where one cell also has the class `player`. The player starts at row 4, column 4, and the arrow keys move it one cell, stopping at the edges. A `p` with the id `pos` shows the position as `row 4, column 4`. `directionFor` from the last item is already defined here.',
          '// directionFor is already defined here.\n\n',
          [{ name: 'the board and the player', body: 'const b = document.getElementById("board");\nreturn eq([b.children.length, Array.from(b.children).findIndex(c => c.classList.contains("player")), document.getElementById("pos").textContent], [81, 40, "row 4, column 4"]);' }, { name: 'ArrowRight moves right', body: 'press("ArrowRight");\nreturn eq(document.getElementById("pos").textContent, "row 4, column 5");' }, { name: 'it stops at the top edge', body: 'for (let i = 0; i < 10; i++) press("ArrowUp");\nreturn eq(document.getElementById("pos").textContent, "row 0, column 5");' }, { name: 'exactly one player cell', body: 'return eq(Array.from(document.getElementById("board").children).filter(c => c.classList.contains("player")).length, 1);' }],
          ['Keep the player\'s row and column in a state object and write a draw function that rebuilds the board and the position text from it.', 'In a keydown listener on document, get the direction with directionFor(event.key) and return early when it is null.', 'Keep the new row and column within 0 to 8 before storing them, then redraw.'], ['dom', 'state'], { dom: true, page: true, prelude: DIRFOR }),
        W('u17w3', 'Write Snake', 'Write Snake on a 15 by 15 board. Keep the game in a `const` named `state` with the keys `snake`, an array of `[row, column]` pairs with the head first, `dir`, an object `{ dr, dc }`, `food`, a `[row, column]` pair, and `over`. The snake starts as `[[7, 7], [7, 6], [7, 5]]` moving right, and every 150 milliseconds it moves one cell in its direction. The arrow keys change the direction, and a key pointing straight back is ignored. Moving onto the food makes the snake one cell longer and places new food on a random empty cell. Moving into a wall or into the snake itself sets `over` to `true` and stops the game. Draw the board in a `div` with the id `board` and the class `board`, whose `style.gridTemplateColumns` is `repeat(15, 28px)`: every snake cell has the class `snake`, the head also has `head`, and the food has `food`. A `p` with the id `status` shows `Length 3` and so on while playing, and `Game over` at the end. `directionFor` is already defined here.',
          '// directionFor is already defined here.\n\n',
          [{ name: 'the starting snake', body: 'return eq([state.snake, state.dir, state.over], [[[7, 7], [7, 6], [7, 5]], { dr: 0, dc: 1 }, false]);' }, { name: 'it moves right every 150 milliseconds', body: 'state.food = [0, 0];\ntick(150);\nreturn eq(state.snake, [[7, 8], [7, 7], [7, 6]]);' }, { name: 'a key turns it on the next tick', body: 'state.food = [0, 0];\npress("ArrowDown");\ntick(150);\nreturn eq(state.snake[0], [8, 8]);' }, { name: 'a key pointing straight back is ignored', body: 'state.food = [0, 0];\npress("ArrowUp");\ntick(150);\nreturn eq(state.snake[0], [9, 8]);' }, { name: 'eating grows the snake and moves the food', body: 'const head = state.snake[0];\nstate.food = [head[0] + state.dir.dr, head[1] + state.dir.dc];\nconst len = state.snake.length;\ntick(150);\nreturn eq([state.snake.length, state.snake.some(p => p[0] === state.food[0] && p[1] === state.food[1])], [len + 1, false]);' }, { name: 'the board and status show it', body: BOARD + 'return eq([cells().length, Array.from(cells()).filter(c => c.classList.contains("snake")).length, Array.from(cells()).filter(c => c.classList.contains("head")).length, Array.from(cells()).filter(c => c.classList.contains("food")).length, status()], [225, state.snake.length, 1, 1, "Length " + state.snake.length]);' }, { name: 'a wall ends the game', body: 'state.food = [0, 0];\nfor (let i = 0; i < 20 && !state.over; i++) tick(150);\nreturn eq([state.over, document.getElementById("status").textContent], [true, "Game over"]);' }, { name: 'nothing moves after the game ends', body: 'const s = JSON.stringify(state.snake);\ntick(600);\nreturn eq(JSON.stringify(state.snake), s);' }],
          ['Each tick computes the new head from the current head and state.dir, checks it against the walls and the snake\'s body, and then either ends the game or adds the new head to the front of state.snake.', 'When the new head is on the food, keep the tail and place new food; otherwise remove the last pair with pop so the length stays the same.', 'To ignore a key pointing straight back, compare the new direction with the current one: when its dr and dc are both the negatives of the current ones, leave the direction as it is.'], ['timers', 'dom', 'state'], { dom: true, page: true, prelude: DIRFOR }),
      ],
    },
    {
      id: 'u18', title: 'localStorage', dom: true,
      read: [
        '`localStorage` is a small store of text that belongs to the site and survives reloads, so a page can remember a best score or a list between visits. `localStorage.setItem("best", "42")` saves the text `"42"` under the key `"best"`, and `localStorage.getItem("best")` returns it later, or `null` when nothing was saved under that key.',
        'Only strings are stored. Saving a number turns it into text, so `Number(localStorage.getItem("best"))` turns it back, and `Number(null)` is 0. To store an object or an array, convert it to **JSON**, a text format for data, with `JSON.stringify(value)`, and convert it back with `JSON.parse(text)`, which builds a new object with the same contents.',
        'On this site each page item has its own storage. "Reload the page" above a preview restarts your code and keeps the storage, and "Clear its storage" empties it.',
      ],
      example: 'const visits = Number(localStorage.getItem("visits")) + 1;\nlocalStorage.setItem("visits", visits);\nconst p = document.createElement("p");\np.textContent = "You have opened this page " + visits + " times.";\ndocument.body.appendChild(p);',
      items: [
        W('u18w1', 'Write loadBest and saveBest', 'Write `loadBest()`, which returns the best score saved under the key `"best"` as a number, or 0 when none is saved, and `saveBest(score)`, which saves `score` under that key only when it is higher than the saved best. `saveBest` returns `true` when it saved and `false` otherwise.',
          'function loadBest() {\n  \n}\n\nfunction saveBest(score) {\n  \n}\n',
          [{ name: 'nothing saved yet gives 0', body: 'localStorage.clear();\nreturn eq(loadBest(), 0);' }, { name: 'a first score is saved', body: 'localStorage.clear();\nconst saved = saveBest(10);\nreturn eq([saved, loadBest()], [true, 10]);' }, { name: 'a lower score is not saved', body: 'localStorage.clear();\nsaveBest(10);\nconst saved = saveBest(5);\nreturn eq([saved, loadBest()], [false, 10]);' }, { name: 'it is stored as text and read back as a number', body: 'localStorage.clear();\nsaveBest(7);\nreturn eq([localStorage.getItem("best"), typeof loadBest()], ["7", "number"]);' }],
          ['localStorage.getItem returns a string or null, and Number turns either into a number, with null becoming 0.', 'In saveBest, compare score with loadBest() and return false early when it isn\'t higher.', 'Otherwise call localStorage.setItem with the key and the score, and return true.'], ['storage'], D),
        W('u18w2', 'Write saveGame and loadGame', 'Write `saveGame(state)`, which saves the whole `state` object under the key `"minesweeper"` as JSON, and `loadGame()`, which returns the saved object, or `null` when nothing is saved.',
          'function saveGame(state) {\n  \n}\n\nfunction loadGame() {\n  \n}\n',
          [{ name: 'a game comes back the same', body: 'localStorage.clear();\nconst s = { rows: 2, grid: [["M", 1], [1, 1]], over: false };\nsaveGame(s);\nreturn eq(loadGame(), s);' }, { name: 'nothing saved gives null', body: 'localStorage.clear();\nreturn eq(loadGame(), null);' }, { name: 'it is stored as JSON text', body: 'localStorage.clear();\nsaveGame({ a: 1 });\nreturn eq(localStorage.getItem("minesweeper"), "{\\"a\\":1}");' }, { name: 'changes after saving are not saved', body: 'localStorage.clear();\nconst s = { grid: [[1]] };\nsaveGame(s);\ns.grid[0][0] = 9;\nreturn eq(loadGame().grid[0][0], 1);' }],
          ['JSON.stringify(state) turns the object into a single string that setItem can store.', 'In loadGame, read the string first and return null when getItem gave null.', 'JSON.parse turns the string back into an object, a new one with the same contents.'], ['storage'], D),
        W('u18w3', 'A count that survives a reload', 'Write a page with a button with the id `add` and a `p` with the id `count`. The paragraph shows `Count: 0` when nothing is saved, each click adds one, and the count is saved in localStorage under the key `"count"`, so after "Reload the page" it continues from where it was.',
          '',
          [{ name: 'it starts from the saved count', code: 'eq(document.getElementById("count").textContent, "Count: 5")' }, { name: 'a click adds one', body: 'click(document.getElementById("add"));\nreturn eq(document.getElementById("count").textContent, "Count: 6");' }, { name: 'the new count is saved', code: 'eq(localStorage.getItem("count"), "6")' }],
          ['Read the saved count once at the start with Number(localStorage.getItem("count")), which gives 0 when nothing is saved.', 'The click listener adds one, saves the new count with setItem, and updates the paragraph.', 'A small render function that sets the paragraph\'s text keeps the first draw and every later one the same.'], ['storage', 'dom'], { dom: true, page: true, testStorage: { count: '5' } }),
      ],
    },
    {
      id: 'u19', title: 'fetch, async and JSON', dom: true,
      read: [
        '`fetch(url)` asks a server for the data at `url`. The answer takes time to arrive, so `fetch` returns at once with a **promise**, an object standing for a value that will be ready later. Inside a function declared with `async`, writing `await` in front of a promise pauses that function until the value is ready, while the rest of the page keeps running, and an `async` function itself always returns a promise.',
        'Getting data takes two awaits: `const response = await fetch(url)` gives the response, and `const data = await response.json()` reads its body and parses it from JSON. `response.ok` is `false` when the server answered with an error, such as a 404 for a missing page. Errors thrown while awaiting, including a failed `json()`, can be caught with `try` and `catch`.',
        'On this site, `fetch` answers from four fixed endpoints: `/api/words` gives an array of eight words, `/api/scores` an array of `{ name, score }` objects, `/api/board` a small Minesweeper layout, and `/api/todos` a short to-do list. Any other URL answers with a 404.',
      ],
      example: 'async function show() {\n  const response = await fetch("/api/words");\n  const words = await response.json();\n  const p = document.createElement("p");\n  p.textContent = words.join(", ");\n  document.body.appendChild(p);\n}\nshow();',
      items: [
        TX('u19t1', 'await and the order of lines', 'async function main() {\n  console.log("1");\n  const response = await fetch("/api/words");\n  console.log("2");\n  const words = await response.json();\n  console.log(words.length);\n}\nmain();\nconsole.log("3");', ['1', '3', '2', '8'],
          ['main runs normally until its first await, then pauses and hands control back to the line after the call.', 'The last line runs while main is paused, and main resumes once the response is ready.', 'It prints 1, then 3, then 2, then the number of words, which is 8.'], ['async']),
        TX('u19t2', 'An async function returns a promise', 'async function double(n) {\n  return n * 2;\n}\nconst result = double(4);\nconsole.log(typeof result, result instanceof Promise);\nresult.then((value) => console.log(value));\nconsole.log("end");', ['object true', 'end', '8'],
          ['Calling an async function always gives back a promise, even when the function returns a plain number.', 'then stores a function to call with the value once the promise is ready, which happens after the current code finishes.', 'It prints object true, then end, then 8.'], ['async']),
        W('u19w1', 'Write loadWords', 'Write an async function `loadWords()` that fetches `/api/words` and returns the words in capital letters, as an array.',
          'async function loadWords() {\n  \n}\n',
          [{ name: 'the first three words', body: 'const w = await loadWords();\nreturn eq(w.slice(0, 3), ["APPLE", "BRICK", "CRANE"]);' }, { name: 'all eight words', body: 'return eq((await loadWords()).length, 8);' }, { name: 'it returns a promise', code: 'eq(loadWords() instanceof Promise, true)' }],
          ['Declaring the function with async lets you use await inside it.', 'await fetch("/api/words") gives the response, and await on the response\'s json() gives the array.', 'map with a function that calls toUpperCase on each word gives the result to return.'], ['async'], D),
        W('u19w2', 'Write topScorer', 'Write an async function `topScorer()` that fetches `/api/scores` and returns the name of the player with the highest score.',
          'async function topScorer() {\n  \n}\n',
          [{ name: 'the top scorer', body: 'return eq(await topScorer(), "Cy");' }, { name: 'it returns the name, as a string', body: 'return eq(typeof (await topScorer()), "string");' }],
          ['Fetch the scores and parse them with json(), as in loadWords.', 'Keep the best entry seen so far while looping over the array, comparing scores.', 'Return the best entry\'s name.'], ['async'], D),
        W('u19w3', 'Write safeLoad', 'Write an async function `safeLoad(url)` that returns the parsed JSON at `url`, or `null` when the response\'s `ok` is `false`.',
          'async function safeLoad(url) {\n  \n}\n',
          [{ name: 'an endpoint that exists', body: 'return eq((await safeLoad("/api/board")).rows, 5);' }, { name: 'a missing page gives null', body: 'return eq(await safeLoad("/api/nothing"), null);' }],
          ['Check response.ok before calling json(), since a 404 page isn\'t valid JSON.', 'Return null early when ok is false.', 'Otherwise return the result of awaiting response.json().'], ['async'], D),
      ],
    },
    {
      id: 'u20', title: 'Forms: a to-do list', dom: true,
      read: [
        'An `input` element is a text box, and its `value` property holds whatever is typed in it right now. Each keystroke fires an `input` event on it. A `form` element groups inputs with a button, and pressing Enter in one of its text boxes, or clicking a button inside it, fires a `submit` event on the form. The browser\'s own response to `submit` is to reload the page, so a submit listener almost always begins with `event.preventDefault()`.',
        'A checkbox is an `input` whose `type` is `"checkbox"`, and its `checked` property is `true` or `false`. Clicking it flips `checked` and fires a `change` event.',
        'A to-do list brings Stages 2 and 3 together. The list is an array of `{ text, done }` objects in the state, the submit and change listeners update that array, a render function rebuilds the list from it, and every change saves the array to localStorage as JSON.',
      ],
      example: 'const form = document.createElement("form");\nconst input = document.createElement("input");\nconst button = document.createElement("button");\nbutton.textContent = "Say hi";\nconst out = document.createElement("p");\nform.append(input, button);\ndocument.body.append(form, out);\nform.addEventListener("submit", (event) => {\n  event.preventDefault();\n  out.textContent = "Hi, " + input.value;\n});',
      items: [
        W('u20w1', 'Write the to-do list', 'Write a to-do list. The page has a `form` with the id `add`, containing an `input` with the id `text` and a button, followed by a `ul` with the id `list`. Submitting the form adds `{ text, done: false }` to the end of the list, using the input\'s text with spaces trimmed from both ends, and then empties the input; an empty text adds nothing. Each item is an `li` holding a checkbox and a `span` with the text, and the `li` has the class `done` when the item is done. Clicking a checkbox switches that item\'s `done`. The list is saved under the key `"todos"` as JSON after every change, and loaded from there when the page starts.',
          '',
          [{ name: 'the form and the list are on the page', code: 'eq([!!document.getElementById("add"), !!document.getElementById("text"), !!document.getElementById("list")], [true, true, true])' }, { name: 'submitting adds an item and empties the input', body: 'type(document.getElementById("text"), "  buy milk  ");\nsubmit(document.getElementById("add"));\nconst li = document.querySelectorAll("#list li");\nreturn eq([li.length, li[0] && li[0].querySelector("span").textContent, document.getElementById("text").value], [1, "buy milk", ""]);' }, { name: 'an empty text adds nothing', body: 'type(document.getElementById("text"), "   ");\nsubmit(document.getElementById("add"));\nreturn eq(document.querySelectorAll("#list li").length, 1);' }, { name: 'the checkbox marks the item done', body: 'click(document.querySelector("#list li input"));\nreturn eq(document.querySelector("#list li").classList.contains("done"), true);' }, { name: 'the list is saved as JSON', body: 'return eq(JSON.parse(localStorage.getItem("todos")), [{ text: "buy milk", done: true }]);' }, { name: 'submit stops the browser\'s reload', body: 'type(document.getElementById("text"), "x");\nreturn eq(submit(document.getElementById("add")).defaultPrevented, true);' }],
          ['Load the array once at the start with JSON.parse on the saved text, using an empty array when nothing is saved, and write a render function that rebuilds the ul from it.', 'In the submit listener, call preventDefault, trim the input\'s value, push a new object when the text isn\'t empty, clear the input, save and render.', 'Give each checkbox a change listener that flips its own item\'s done, then saves and renders; the item is in scope when the listener is created inside the loop that builds the li.'], ['dom', 'storage', 'state'], DP),
      ],
    },
  ];

  // ---------- Stage 4: mock live rounds ----------
  const stage4 = [
    {
      id: 'u21', title: 'Unseen apps', dom: true,
      read: [
        'Each item here is a small app of the kind a live round asks for, built from an empty editor. To practice under real conditions, start one from the Practice tests tab with "One unseen app", which picks one at random, gives you 45 minutes, and turns hints and Memory off. Opening an item here works like any other item, with hints and tests as you go.',
        'A good order of work in a live round is to set up the state object first, then a render function that draws the page from it, then one listener at a time, checking the page after each step.',
      ],
      example: '// The shape most of these apps take:\nconst state = { /* everything the app knows */ };\nfunction render() { /* rebuild the page from state */ }\n// listeners change state, then call render()\nrender();',
      noRun: true,
      items: [
        W('u21w1', 'Tic-tac-toe', 'Build tic-tac-toe. A `div` with the id `board` and the class `board` holds 9 cells with the class `cell`, and its `style.gridTemplateColumns` is `repeat(3, 28px)`. Clicking an empty cell puts `X` or `O` in it, starting with `X` and alternating, and clicking a full cell does nothing. A `p` with the id `status` reads `X to move` or `O to move`, then `X wins`, `O wins` or `Draw`, and once the game has ended clicks on cells do nothing. A button with the id `reset` starts a new game.',
          '',
          [{ name: 'nine empty cells', body: BOARD + 'return eq([cells().length, Array.from(cells()).every(c => c.textContent === ""), status()], [9, true, "X to move"]);' }, { name: 'X moves first', body: BOARD + 'click(cells()[0]);\nreturn eq([cells()[0].textContent, status()], ["X", "O to move"]);' }, { name: 'a full cell is ignored', body: BOARD + 'click(cells()[0]);\nreturn eq([cells()[0].textContent, status()], ["X", "O to move"]);' }, { name: 'X wins with the top row', body: BOARD + 'click(cells()[3]); click(cells()[1]); click(cells()[4]); click(cells()[2]);\nreturn eq(status(), "X wins");' }, { name: 'clicks after a win do nothing', body: BOARD + 'click(cells()[8]);\nreturn eq(cells()[8].textContent, "");' }, { name: 'reset starts over', body: BOARD + 'click(document.getElementById("reset"));\nreturn eq([Array.from(cells()).every(c => c.textContent === ""), status()], [true, "X to move"]);' }, { name: 'a full board with no line is a draw', body: BOARD + 'click(document.getElementById("reset"));\nfor (const i of [0, 1, 2, 4, 3, 5, 7, 6, 8]) click(cells()[i]);\nreturn eq(status(), "Draw");' }],
          ['Keep the nine marks in an array of strings in a state object, along with whose turn it is and whether the game is over, and redraw the board and the status from it after every click.', 'The eight winning lines are three rows, three columns and two diagonals, which you can list as arrays of three indexes.', 'After each move, check every line for three equal marks that aren\'t empty, and call it a draw when no cell is empty.'], ['dom', 'state'], DP),
        W('u21w2', 'Lights Out', 'Build Lights Out on a 5 by 5 board. A `div` with the id `board` and the class `board` holds 25 cells with the class `cell`, and its `style.gridTemplateColumns` is `repeat(5, 28px)`. A lit cell has the class `on`. The game starts with the cells at indexes 2, 6, 7, 8, 16, 17, 18 and 22 lit. Clicking a cell flips it and the up to four cells directly above, below, left and right of it. A `p` with the id `status` shows `Moves: 0` and counts each click, and shows `Solved in 2 moves` and so on once every light is off. A button with the id `reset` returns to the start.',
          '',
          [{ name: 'the starting lights', body: BOARD + 'return eq([cells().length, Array.from(cells()).map((c, i) => c.classList.contains("on") ? i : -1).filter(i => i >= 0), status()], [25, [2, 6, 7, 8, 16, 17, 18, 22], "Moves: 0"]);' }, { name: 'a click flips a plus shape', body: BOARD + 'click(cells()[12]);\nreturn eq([Array.from(cells()).map((c, i) => c.classList.contains("on") ? i : -1).filter(i => i >= 0), status()], [[2, 6, 8, 11, 12, 13, 16, 18, 22], "Moves: 1"]);' }, { name: 'flips don\'t wrap around the edges', body: BOARD + 'click(document.getElementById("reset"));\nclick(cells()[5]);\nreturn eq(Array.from(cells()).map((c, i) => c.classList.contains("on") ? i : -1).filter(i => i >= 0), [0, 2, 5, 7, 8, 10, 16, 17, 18, 22]);' }, { name: 'solving it', body: BOARD + 'click(document.getElementById("reset"));\nclick(cells()[7]); click(cells()[17]);\nreturn eq([Array.from(cells()).some(c => c.classList.contains("on")), status()], [false, "Solved in 2 moves"]);' }],
          ['Keep the 25 lights in an array of true and false values, with a move counter, and redraw from that state after each click.', 'For a click at index i, the row is Math.floor(i / 5) and the column is i % 5, and each of the four neighbors must be checked against the edges before it is flipped.', 'After flipping, every light is off when no element of the array is true, and that is when the status changes to the solved message.'], ['dom', 'state', 'grid'], DP),
        W('u21w3', 'A stopwatch', 'Build a stopwatch. A `p` with the id `time` shows the elapsed seconds with one decimal place, starting at `0.0`, and three buttons with the ids `start`, `stop` and `reset` control it. Start counts up in steps of 100 milliseconds, and pressing it while it is already running changes nothing. Stop pauses it, and Reset stops it and returns the display to `0.0`.',
          '',
          [{ name: 'it starts at 0.0', code: 'eq(document.getElementById("time").textContent, "0.0")' }, { name: 'one second after Start', body: 'click(document.getElementById("start"));\ntick(1000);\nreturn eq(document.getElementById("time").textContent, "1.0");' }, { name: 'pressing Start again doesn\'t double the speed', body: 'click(document.getElementById("start"));\ntick(500);\nreturn eq(document.getElementById("time").textContent, "1.5");' }, { name: 'Stop pauses it', body: 'click(document.getElementById("stop"));\ntick(1000);\nreturn eq(document.getElementById("time").textContent, "1.5");' }, { name: 'Reset returns to 0.0 and stays there', body: 'click(document.getElementById("start"));\ntick(200);\nclick(document.getElementById("reset"));\ntick(500);\nreturn eq(document.getElementById("time").textContent, "0.0");' }],
          ['Count tenths of a second in a number and show it with toFixed(1) on the number of seconds, which always gives one decimal place.', 'Store the interval\'s id when starting, and return early from the start listener when an id is already stored, so two intervals never run at once.', 'Stop calls clearInterval and forgets the id, and Reset does the same and also sets the count back to 0 before redrawing.'], ['timers', 'dom'], DP),
      ],
    },
  ];

  // ---------- Stage 5: reading level for the take-home ----------
  const stage5 = [
    {
      id: 'u22', title: 'Modules: import and export', noRun: true,
      read: [
        'A real project splits its code into files called **modules**. Each module has its own top-level scope, so a name declared in one file is invisible to every other file unless the file **exports** it. Another file then **imports** the name, and the import gives it access to that same function, object or value.',
        'A named export is written `export function countNeighbors(…)` and imported by its exact name with `import { countNeighbors } from "./grid.js"`, in braces. A file may also have one default export, written `export default function Game(…)`, which is imported without braces and under any name the importing file chooses. A module runs once, the first time anything imports it, and every importer shares the objects it created.',
        'When reading an unfamiliar codebase, the imports at the top of a file tell you where each name comes from, so following them is the quickest way to find the code that actually does the work.',
      ],
      example: '// grid.js\nexport function makeGrid(rows, cols, value) {\n  return Array.from({ length: rows }, () => Array(cols).fill(value));\n}\nexport const SIZE = 9;\n\n// main.js\nimport { makeGrid, SIZE } from "./grid.js";\nconst grid = makeGrid(SIZE, SIZE, 0);',
      items: [],
    },
    {
      id: 'u23', title: 'TypeScript basics', noRun: true,
      read: [
        '**TypeScript** is JavaScript with type annotations added. A type checker reads the annotations before the code runs and reports mismatches, such as passing a string where a number is expected, and a compiler then strips the annotations to produce ordinary JavaScript for the browser or Node.',
        'Annotations go after a colon: `let count: number = 0`, and `function countNeighbors(grid: Cell[][], r: number, c: number): number` describes the parameters and the return value. A `type` or `interface` names the shape of an object, as in `type Cell = { mine: boolean; count: number }`, and a **union type** such as `"X" | "O" | ""` allows exactly those three strings.',
        'For reading a take-home codebase, the types are documentation you can trust, because the checker enforces them. When a function\'s parameters say `Task` and `Grader`, finding where those types are declared tells you what every field of the objects passed around is.',
      ],
      example: 'type Mark = "X" | "O" | "";\ntype State = { cells: Mark[]; turn: "X" | "O"; over: boolean };\n\nfunction winner(state: State): Mark {\n  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];\n  for (const [a, b, c] of lines) {\n    if (state.cells[a] && state.cells[a] === state.cells[b] && state.cells[b] === state.cells[c]) return state.cells[a];\n  }\n  return "";\n}',
      items: [],
    },
    {
      id: 'u24', title: 'React basics', noRun: true,
      read: [
        '**React** is a library for building pages out of **components**, functions that return a description of part of the page. The description is written in JSX, which looks like HTML inside JavaScript: `return <button onClick={reveal}>{count}</button>` describes a button whose text is the value of `count`, with curly braces marking JavaScript inside the markup.',
        'A component keeps its state with `const [count, setCount] = useState(0)`. Calling `setCount(5)` stores the new value and makes React call the component again and update the page to match its new description. This is the pattern from Unit 14, render from state, with React doing the rebuilding: listeners change state, and the page follows.',
        'Values passed into a component, as in `<Cell value={3} />`, arrive as its **props**, an object of named arguments. When a component draws a list with `items.map(...)`, each element gets a `key` prop that identifies it, so React can tell which elements were added, moved or removed.',
      ],
      example: 'import { useState } from "react";\n\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Clicked {count} times\n    </button>\n  );\n}',
      items: [],
    },
    {
      id: 'u25', title: 'npm and Node', noRun: true,
      read: [
        '**Node** runs JavaScript outside the browser, on your computer or a server, with access to files and the network in place of the page and the DOM. **npm** is the package manager that comes with it: it downloads libraries other people published, called packages, into a folder named `node_modules`.',
        'A project\'s `package.json` file lists the packages it depends on and its **scripts**, named shell commands. `npm install` downloads every dependency, and `npm run dev` or `npm test` runs the script with that name. Reading `package.json` first tells you how a project starts, builds and tests itself, which is the quickest way into an unfamiliar repository.',
      ],
      example: '{\n  "name": "minesweeper",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "test": "vitest"\n  },\n  "dependencies": {\n    "react": "^19.0.0"\n  },\n  "devDependencies": {\n    "typescript": "^5.6.0",\n    "vite": "^6.0.0",\n    "vitest": "^2.1.0"\n  }\n}',
      items: [],
    },
  ];

  const later = (id, title, units) => ({ id, title, comingSoon: true, units: units.map((t, i) => ({ id: id + 'x' + i, title: t, items: [], comingSoon: true })) });

  root.COURSES = [{
    id: 'js-small-apps',
    title: 'JavaScript for small browser apps',
    subtitle: 'idler live-round prep',
    stages: [
      { id: 's1', title: 'Stage 1: The language', units: stage1 },
      { id: 's2', title: 'Stage 2: The browser', units: stage2 },
      { id: 's3', title: 'Stage 3: Things that happen later', units: stage3 },
      { id: 's4', title: 'Stage 4: Mock live rounds', units: stage4 },
      { id: 's5', title: 'Stage 5: Reading level for the take-home', units: stage5 },
    ],
  }];
})(typeof globalThis !== 'undefined' ? globalThis : this);
