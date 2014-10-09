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
var wwwhisper = require('connect-wwwhisper');

// config settings for the minisite
var challengesEndpoint = process.env.CHALLENGES_ENDPOINT ||  "http://tc-search.herokuapp.com/challenges/v2/search?q=challengeName:Swiftlang";
var leaderboardEndpoint = process.env.LEADERBOARD_ENDPOINT || "http://tc-leaderboard.herokuapp.com/demo";
var communityName = process.env.COMMUNITY_NAME || "Lightning";
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

// wwwhisper
app.use(wwwhisper());
// app.use(wwwhisper(false));

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

function mockChallenges() {

  function add(name, amount) {

    var platforms = ['Salesforce'];
    var technologies = ['Lightning', 'Apex', 'JavaScript'];
    var today = new Date();

    return {
      _type: 'develop',
      _source: {
        challengeId: 0,
        challengeName: name,
        platforms: platforms,
        technologies: technologies,
        totalPrize: amount,
        numRegistrants: Math.floor((Math.random() * 10) + 1),
        numSubmissions: Math.floor((Math.random() * 3) + 1),
        submissionEndDate: today.setDate(today.getDate() + Math.floor((Math.random() * 10) + 1))
      }
    };

  }

  var challenges = [];
  challenges.push(add('Hello Lightning!! Build Your First Lightning Component', 100));
  challenges.push(add('Lazy Loading Data TreeView App', 1000));
  challenges.push(add('Lead Conversion App', 1000));
  challenges.push(add('Customizable Grid w/search, sorting & pagination', 750));
  challenges.push(add('Org Chart Visualizer App', 1000));
  challenges.push(add('Find Duplicate Records App', 1000));
  challenges.push(add('File Upload App', 1000));
  challenges.push(add('Drag n Drop Record Selector App', 1000));
  challenges.push(add('Month, Week & Day Calendar App', 2000));
  challenges.push(add('Typeahead Input Field', 300));
  challenges.push(add('Combobox with Filtering', 300));
  challenges.push(add('Image List Viewer App', 500));
  challenges.push(add('Range Selection DatePicker', 500));
  challenges.push(add('Share on Social Media', 350));
  challenges.push(add('Drag n Drop Sortable List', 250));
  challenges.push(add('Range Selection DateTimePicker', 500));
  challenges.push(add('Cascading (Dependent) Combobox', 300));
  challenges.push(add('Progress Bar', 250));
  challenges.push(add('MaskedText Input Field', 250));
  challenges.push(add('MultiSelect Input Field with Filtering', 500));
  challenges.push(add('Range Bounded Spinner', 250));
  challenges.push(add('Multiselect Calendar', 250));
  challenges.push(add('Range Bounded Slider', 350));
  challenges.push(add('TabStrip', 250));
  challenges.push(add('Image Coverflow', 250));
  challenges.push(add('Range Bounded Editable Dial', 500));
  challenges.push(add('Growl Notifications', 500));
  challenges.push(add('Tooltip', 250));
  challenges.push(add('Toggle True/False Button', 250));
  challenges.push(add('Captcha', 350));
  challenges.push(add('Analog/Digital Clock Datetime', 350));
  challenges.push(add('Modal', 250));

  return challenges;

}

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
      req.challenges = mockChallenges();
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
