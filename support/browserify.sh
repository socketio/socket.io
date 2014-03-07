#!/usr/bin/env node

require('./browserify')(function(err, out){
  if (err) throw err;
  console.log(out);
});
