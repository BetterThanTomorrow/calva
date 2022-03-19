/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * MIT License
 *
 * Copyright (c) 2015 - present Microsoft Corporation
 *
 * All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

'use strict';

var path = require('path');
var fs = require('fs');
var cson = require('cson-parser');

exports.update = function (contentPath, dest) {
  console.log('Reading from ' + contentPath);
  fs.readFile(contentPath, (_err, content) => {
    var grammar = cson.parse(content);
    const result = {
      information_for_contributors: ['This file is generated from ' + contentPath],
    };

    const keys = ['name', 'scopeName', 'comment', 'injections', 'patterns', 'repository'];
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(grammar, key)) {
        result[key] = grammar[key];
      }
    }

    try {
      fs.writeFileSync(dest, JSON.stringify(result, null, '\t').replace(/\n/g, '\r\n'));
      console.log('Updated ' + path.basename(dest));
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });
};

if (path.basename(process.argv[1]) === 'update-grammar.js') {
  exports.update(process.argv[2], process.argv[3]);
}
