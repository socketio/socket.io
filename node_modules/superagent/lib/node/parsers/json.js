
module.exports = function(res, fn){
  var buf = '';
  res.setEncoding('utf8');
  res.on('data', function(chunk){ buf += chunk; });
  res.on('end', function(){
    try {
      fn(null, JSON.parse(buf));
    } catch (err) {
      fn(err);
    }
  });
};