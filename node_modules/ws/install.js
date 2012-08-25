var spawn = require('child_process').spawn
  , exec = require('child_process').exec
  , tinycolor = require('tinycolor')
  , fs = require('fs')
  , version = JSON.parse(fs.readFileSync(__dirname + '/package.json', 'utf8')).version
  , verbose = process.env['npm_package_config_verbose'] != null ? process.env['npm_package_config_verbose'] === 'true' : false;

console.log('[ws v%s]'.blue + ' Attempting to compile blazing fast native extensions.'.green, version);

var gyp = exec('node-gyp rebuild', {cwd: __dirname});
gyp.stdout.on('data', function(data) {
  if (verbose) process.stdout.write(data);
});
gyp.stderr.on('data', function(data) {
  if (verbose) process.stdout.write(data);
});
gyp.on('exit', function(code) {
  if (code !== 0) {
    console.log('[ws v%s]'.blue + ' Native code compile failed (but the module will still work):'.yellow, version);
    console.log('[ws v%s]'.blue + ' The native extensions are faster, but not required.'.yellow, version);
    console.log('[ws v%s]'.blue + ' On Windows, native extensions require Visual Studio and Python.'.yellow, version);
    console.log('[ws v%s]'.blue + ' On Unix, native extensions require Python, make and a C++ compiler.'.yellow, version);
    console.log('[ws v%s]'.blue + ' Start npm with --ws:verbose to show compilation output (if any).'.yellow, version);
  }
  else {
    console.log('[ws v%s]'.blue + ' Native extension compilation successful!'.green, version);
 }
  process.exit();
});
