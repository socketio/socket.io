# SuperAgent

  SuperAgent is a small progressive __client-side__ HTTP request library, and __Node.js__ module with the same API, sporting many high-level HTTP client features. View the [docs](http://visionmedia.github.com/superagent/).

![super agent](http://f.cl.ly/items/3d282n3A0h0Z0K2w0q2a/Screenshot.png)

## Motivation

  This library spawned from my frustration with jQuery's weak & inconsistent Ajax support. jQuery's API while having recently added some promise-like support, is largely static, forcing you to build up big objects containing all the header fields and options, not to mention most of the options are awkwardly named "type" instead of "method", etc. Onto examples!

  The following is what you might typically do for a simple __GET__ with jQuery:

```js
$.get('/user/1', function(data, textStatus, xhr){
  
});
```

great, it's ok, but it's kinda lame having 3 arguments just to access something on the `xhr`. Our equivalent would be:

```js
request.get('/user/1', function(res){
  
});
```

the response object is an instanceof `request.Response`, encapsulating all of this information instead of throwing a bunch of arguments at you. For example we can check `res.status`, `res.header` for header fields, `res.text`, `res.body` etc.

An example of a JSON POST with jQuery typically might use `$.post()`, however once you need to start defining header fields you have to then re-write it using `$.ajax()`... so that might look like:

```js
$.ajax({
  url: '/api/pet',
  type: 'POST',
  data: { name: 'Manny', species: 'cat' },
  headers: { 'X-API-Key': 'foobar' }
}).success(function(res){
  
}).error(function(){
  
});
```

 Not only is it ugly it's pretty opinionated, jQuery likes to special-case {4,5}xx, for example you cannot (easily at least) receive a parsed JSON response for say "400 Bad Request". This same request would look like this:

```js
request
  .post('/api/pet')
  .send({ name: 'Manny', species: 'cat' })
  .set('X-API-Key', 'foobar')
  .set('Accept', 'application/json')
  .end(function(res){
    
  });
```

building on the existing API internally we also provide something similar to `$.post()` for those times in life where your interactions are very basic:

```js
request.post('/api/pet', cat, function(res){
  
});
```

## Running node tests

  Install dependencies:
  
     $ npm install -d
  
  Run em!
  
    $ make test

## Running browser tests

 Install the test server deps (nodejs / express):

    $ npm install -d

 Start the test server:

    $ make test-server

 Visit `localhost:3000/` in the browser.

## Wiki

  For superagent extensions such as couchdb and oauth visit the [wiki](https://github.com/visionmedia/superagent/wiki).

## License 

(The MIT License)

Copyright (c) 2011 TJ Holowaychuk &lt;tj@vision-media.ca&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.