// https://developer.mozilla.org/en/New_in_JavaScript_1.7

// let statement

let (x = x+10, y = 12) {
  print(x+y + "\n");
}

// let expressions

print( let(x = x + 10, y = 12) x+y  + "<br>\n");

// let definitions

if (x > y) {
  let gamma = 12.7 + y;
  i = gamma * x;
}

var list = document.getElementById("list");

for (var i = 1; i <= 5; i++) {
  var item = document.createElement("LI");
  item.appendChild(document.createTextNode("Item " + i));

  let j = i;
  item.onclick = function (ev) {
    alert("Item " + j + " is clicked.");
  };
  list.appendChild(item);
}

function varTest() {
  var x = 31;
  if (true) {
    var x = 71;  // same variable!
    alert(x);  // 71
  }
  alert(x);  // 71
}

function letTest() {
  let x = 31;
  if (true) {
    let x = 71;  // different variable
    alert(x);  // 71
  }
  alert(x);  // 31
}

function letTests() {
  let x = 10;

  // let-statement
  let (x = x + 20) {
    alert(x);  // 30
  }

  // let-expression
  alert(let (x = x + 20) x);  // 30

  // let-definition
  {
    let x = x + 20;  // x here evaluates to undefined
    alert(x);  // undefined + 20 ==> NaN
  }
}

var x = 'global';
let x = 42;
document.write(this.x + "<br>\n");

// let-scoped variables in for loops
var i=0;
for ( let i=i ; i < 10 ; i++ )
  document.write(i + "<br>\n");

for ( let [name,value] in obj )
  document.write("Name: " + name + ", Value: " + value + "<br>\n");
