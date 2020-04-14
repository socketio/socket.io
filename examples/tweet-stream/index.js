
const Twitter = require('node-tweet-stream');
const twitter = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  token: process.env.TWITTER_TOKEN,
  token_secret: process.env.TWITTER_TOKEN_SECRET
});

const io = require('socket.io')(process.env.PORT || 3000);

twitter.track('socket.io');
twitter.track('javascript');

let tweets = [];
const MAX_TWEETS = 10;

io.on('connect', socket => {
  socket.emit('buffer', tweets);
});

twitter.on('tweet', tweet => {
  io.emit('tweet', tweet);
  tweets.unshift(tweet);
  tweets = tweets.slice(0, MAX_TWEETS);
});

twitter.on('error', err => {
  console.error(err);
});
