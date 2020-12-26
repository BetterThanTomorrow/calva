var fs = require('fs');
var https = require('follow-redirects').https;

var file_name = "./clojure-lsp.jar"

var file = fs.createWriteStream(file_name);

https.get({
    host: 'github.com',
    port: 443,
    path: '/snoe/clojure-lsp/releases/latest/download/clojure-lsp'
}, function (res) {
    res.on('data', function (data) {
        file.write(data);
    }).on('end', function () {
        file.end();
        console.log(file_name + ' downloaded');
    });
});
