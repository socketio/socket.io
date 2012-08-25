
# s.js: minimalistic javascript sprintf().

```js
// standalone
s('http://%s:%d', 'localhost', 40)

// extend String.prototype
s.extend();
'http://%s:%d'.s('localhost', 40);
```

- Node/browser compatible. Published as `s` on npm.
- Opt-in String.prototype extension
- Only supports `%s` and `%d`. Escape `%` as `%%`.
