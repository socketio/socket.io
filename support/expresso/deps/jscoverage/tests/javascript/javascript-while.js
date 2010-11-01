while (x) {
  x();
}

while (x) {
  ;
}

while (x)
  x();

while (x)
  ;

while (x) {
  if (x) {
    continue;
  }
}

label:
while (x) {
  if (x) {
    continue label;
  }
}

label2: {
  f();
  while (x) {
    if (x) {
      break label2;
    }
  }
}
