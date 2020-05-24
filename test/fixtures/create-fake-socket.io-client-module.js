var fs = require('fs');
var join = require('path').join;
var io = require('../../lib');

var testHadToCreateFakeModule = false
var fakeModuleLocation = '../socket.io-client'
var socketIOClientMainFilePath = fakeModuleLocation + '/dist/socket.io.js'

before(function(){
    // set up at fake socket.io-client module sitting at ../.. (sibling to socket.io folder). Emulates being on the same level inside a node_modules folder
    // http.Server should ignore the fake module, and use the one in socket.io/node_modules/socket.io-client
    try {
        fs.mkdirSync(fakeModuleLocation);
        testHadToCreateFakeModule = true;
    } catch (_) {}

    // load fake package.json
    var fakePackageFixture = fs.readFileSync('./test/fixtures/package.json');
    // place fake package.json, if necessary
    try {
        fs.writeFileSync(fakeModuleLocation + '/package.json', fakePackageFixture, { flag: 'wx' });
        // 'wx' mode fails if the file exists
    } catch (_) {}

    try {
        fs.mkdirSync(fakeModuleLocation + '/dist');
    } catch (_) {}

    // temporarily put away the real main file, if it exists
    try {
        fs.renameSync(socketIOClientMainFilePath, socketIOClientMainFilePath + '.temp')
    } catch (_) {}
    // write in the fake main file
    fs.writeFileSync(socketIOClientMainFilePath, '\'im a fake socket.io-client\'');

    io().clearClientCodeCache();
})

after(function(){
    // put the temp file back into place, if it exists
    try {
        fs.renameSync(socketIOClientMainFilePath + '.temp', socketIOClientMainFilePath)
    } catch (_) {}

    if (testHadToCreateFakeModule) {
        // delete whole folder
        var deleteFolderRecursive = function(path) {
            if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach((file, index) => {
                var curPath = join(path, file);
                if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
                } else { // delete file
                fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(path);
            }
        };
        
        deleteFolderRecursive(fakeModuleLocation);
    }

    io().clearClientCodeCache();
});