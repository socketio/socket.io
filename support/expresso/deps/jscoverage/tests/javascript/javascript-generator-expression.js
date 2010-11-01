// https://developer.mozilla.org/en/New_in_JavaScript_1.8

let it = (i + 3 for (i in someObj));
try {
  while (true) {
    document.write(it.next() + "<br>\n");
  }
} catch (err if err instanceof StopIteration) {
  document.write("End of record.<br>\n");
}

function handleResults( results ) {
  for ( let i in results )
    ;
}
handleResults( i for ( i in obj ) if ( i > 3 ) );

it = (1 for(a in x) for(b in y));
