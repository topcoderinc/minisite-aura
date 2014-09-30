var express = require('express');
var exphbs  = require('express-handlebars');
var http = require('http');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var debug = require('debug')('my-application');
var _ = require("lodash");
var request = require('request');
var moment = require('moment');
var RSS = require('rss');

// config settings for the minisite
var challengesEndpoint = process.env.CHALLENGES_ENDPOINT ||  "http://tc-search.herokuapp.com/challenges/v2/search?q=challengeName:IDOL";
var leaderboardEndpoint = process.env.LEADERBOARD_ENDPOINT || "http://tc-leaderboard.herokuapp.com/demo";
var communityName = process.env.COMMUNITY_NAME || "Community Template";
// don't show challenges with the follow statuses
var challengeFilter = ['Completed','Cancelled - Zero Submissions'];

var port = process.env.PORT || 3000;
var app = express();

// register handlebars & some helpers for the views
var hbs = exphbs.create({
  defaultLayout: 'main',
  helpers: {
    ordinal: function (rank) {
      var s=["th","st","nd","rd"];
      var v=rank%100;
      return rank+(s[(v-20)%10]||s[v]||s[0]);
    },
    arrayToList: function (array) {
      return array.join(', ');
    },
    dateFormatUTC: function(d) {
      return moment.utc(d).format('MMMM Do YYYY, h:mm:ss a');
    }
  }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('port', port);

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

// fetches a list of challenges as json and exposes it to the ejs
var challenges = function(req, res, next) {
  request(challengesEndpoint, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var challenges = [];
      _(JSON.parse(body)).forEach(function(c) {
        // filter out challenges by types we don't want
        if (challengeFilter.indexOf(c._source.status) == -1) {
          challenges.push(c);
        }
      });
      req.challenges = challenges;
    } else {
      req.challenges = [];
    }
    return next();
  });
};

// fetches a leaderboard as json and exposes it to the ejs
var leaderboard = function(req, res, next) {
  request(leaderboardEndpoint, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var leaderboard = JSON.parse(body);
      // create an array with left and right columns
      var leaders = [];
      for (i=0; i <= leaderboard.length-1; i += 2){
        var left = leaderboard[i];
        var right = leaderboard[i+1];
        leaders.push({left: left, right: right});
      }
      req.leaderboard = leaders;
    } else {
      req.leaderboard = [];
    }
    return next();
  });
};

app.get('/', challenges, leaderboard, function(req, res){
  res.render('index', {
    communityName: communityName,
    challenges: req.challenges,
    leaderboard: req.leaderboard
  });
});

app.get('/challenges/rss', challenges, leaderboard, function(req, res){

  var feed = new RSS({
      title: communityName + ' Community Challenges',
      description: 'Open challenges for the ' + communityName + ' community.',
      feed_url: 'http://' + req.headers.host + '/challenges/rss',
      site_url: 'http://' + req.headers.host,
      image_url: 'http://www.topcoder.com/i/logo.png',
      author: '[topcoder]',
      copyright: '2014 Appirio',
      ttl: '60'
  });

  var challenges = [];
  request(challengesEndpoint, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      challenges = JSON.parse(body);
      _(challenges).forEach(function(c) {

        feed.item({
            title:  c._source.challengeName,
            description: communityName + ' community '+c._type+' challenge: ' + c._source.challengeName,
            url:  "http://www.topcoder.com/challenge-details/"+c._source.challengeId+"?type="+c._type,
            date: c._source.postingDate
        });

      });
    }
    res.set('Content-Type', 'text/xml');
    res.send(feed.xml());
  });

});

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.render('error', {
        message: err.message,
        error: {}
    });
});

var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});
