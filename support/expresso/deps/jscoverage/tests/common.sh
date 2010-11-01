export PATH=.:..:../js/obj:$PATH

json_cmp() {
  echo 'EXPECTED = ' | cat - $1 > EXPECTED
  echo 'ACTUAL = ' | cat - $2 > ACTUAL
  js -f EXPECTED -f ACTUAL -f json-cmp.js
}
