/**
 * This file provided by Facebook is for non-commercial testing and evaluation
 * purposes only. Facebook reserves all rights not expressly granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * FACEBOOK BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
 * ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

var http = require('http');
var Primus = require('primus');
var PrimusResponder = require('primus-responder');

var Promise = require('bluebird');
var React = require('react');
var ReactDOMServer = require('react-dom/server');
require('babel-register')({
  presets: [ 'react' ]
});

var readFile = Promise.promisify(fs.readFile);
var writeFile = Promise.promisify(fs.writeFile);

var compression = require('compression');

var COMMENTS_FILE = path.join(__dirname, 'comments.json');

app.set('port', (process.env.PORT || 3000));

app.use(compression());
app.use('/', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Additional middleware which will set headers that we need on each request.
app.use(function(req, res, next) {
    // Set permissive CORS header - this allows this server to be used only as
    // an API server in conjunction with something like webpack-dev-server.
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Disable caching so we'll always get the latest comments.
    res.setHeader('Cache-Control', 'no-cache');
    next();
});

app.get('/api/comments', function(req, res) {
  get_comments().
  then(function(comments) {
    if(!comments) { return; }
    res.json(comments);
  }).catch(function(err) {
    console.log("Error", err);
  });
});

app.post('/api/comments', function(req, res) {
  var comment = {author: req.body.author, text: req.body.text}
  add_comments([comment]).then(function(comments) {
    res.redirect('/');
    sync_comments();
  }).catch(function(err) {
    console.log("Error", err);
  });
});

app.post('/api/comments/delete/:commentID', function(req, res) {
  delete_comment(req.params.commentID)
  .then(function(comments) {
    res.redirect('/');
    sync_comments();
  }).catch(function(err) {
    console.log("Error", err);
  });
});

app.get(['/', '/another-page'], function(req, res) {
  var ReactRouter = require('react-router');
  var match = ReactRouter.match;
  var RouterContext = React.createFactory(ReactRouter.RouterContext);
  var Provider = React.createFactory(require('react-redux').Provider);
  var routes = require('./public/routes.js').routes
  var store = require('./public/redux-store');

  fs.readFile(COMMENTS_FILE, function(err, data) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    var comments = JSON.parse(data);

    var initialState = {
      data: comments,
      url: "/api/comments",
    }

    store = store.configureStore(initialState);

    match({routes: routes, location: req.url}, function(error, redirectLocation, renderProps) {
      if (error) {
        res.status(500).send(error.message)
      } else if (redirectLocation) {
        res.redirect(302, redirectLocation.pathname + redirectLocation.search)
      } else if (renderProps) {
        res.send("<!DOCTYPE html>"+
          ReactDOMServer.renderToString(
            Provider({store: store}, RouterContext(renderProps))
          )
        );
      } else {
        res.status(404).send('Not found')
      }
    });

  });
});


get_comments = function() {
  return readFile(COMMENTS_FILE)
  .then(function(data) {
    comments = JSON.parse(data);
    return comments;
  }).catch(function(err) {
    console.log("Error reading file", err);
  });
}

add_comments = function(new_comments) {
  return get_comments().then(function(comments) {
    var add_comments = [];
    new_comments.forEach(function(comment, i) {
      if(!(comment.author.trim() && comment.text.trim())) {
        return;
      }
      var newComment = {
        id: Date.now()+i,
        author: comment.author,
        text: comment.text
      }
      add_comments.push(newComment);
    });
    if(add_comments.length) {
      comments = comments.concat(add_comments);
      return writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 4));
    }
  }).then(function() {
    return get_comments();
  }).catch(function(err) {
    console.log("Error", err)
  });
};

delete_comment = function(commentID) {
  return get_comments().
  then(function(comments) {
    for(i = 0; i < comments.length; i++) {
      if(comments[i].id == commentID) {
        comments.splice(i, 1);
      }
    }
    return writeFile(COMMENTS_FILE, JSON.stringify(comments, null, 4));
  }).then(function() {
    return get_comments();
  }).catch(function(err) {
    console.log("Error", err)
  });
}

var server = http.createServer(app);
var primus = new Primus(server, {transformer: 'engine.io', parser: 'JSON', compression: true});
primus.use('responder', PrimusResponder);
primus.save(path.join(__dirname, 'public', 'scripts', 'primus.js'));

sync_comments = function(opts) {
  if(!primus) { return; }
  var opts = typeof opts !== "undefined" ? opts : {}
  get_comments().then(function(comments) {
    if(!comments) { return; }
    if(opts.skip_id) {
      primus.forEach(function (spark, id, connections) {
        if(id == opts.skip_id) { return; }
        spark.write({type: 'set_comments', data: comments, mode: 'broadcast'})
      });
    } else {
      primus.write({type: 'set_comments', data: comments, mode: 'broadcast'});
    }
  }).catch(function(err) {
    console.log("Error", err);
  });
}

sync_devices = function() {
  if(!primus) { return; }
  var devices = [];
  primus.forEach(function(spark, id, connections) {
    devices.push(spark.address.ip+' ('+spark.headers['user-agent']+')');
  });
  primus.write({type: 'set_devices', devices: devices, mode: 'broadcast'})
};

primus.on('connection', function (spark) {

  spark.on('request', function(data, done) {
    if(data.type == 'add_comment') {
      add_comments([data.comment]).then(function(comments) {
        done({type: 'set_comments', data: comments});
        sync_comments({skip_id: spark.id});
      });
    }
  });

  spark.on('request', function(data, done) {
    if(data.type == 'delete_comment') {
        delete_comment(data.commentID).then(function(comments) {
          done({type: 'set_comments', data: comments});
          sync_comments({skip_id: spark.id});
        });
    }
  });

  spark.on('request', function(data, done) {
    if(data.netStatus && data.netStatus == 'online') {
      if(data.offlinedata && data.offlinedata.length) {
        add_comments(data.offlinedata).then(function(comments) {
          done({type: 'set_comments', data: comments});
          sync_comments({skip_id: spark.id});
        });
      } else {
		get_comments().then(function(comments) {
		  done({type: 'set_comments', data: comments});
		})
	  }
      sync_devices();
    }
  });

  spark.on('data', function (data) {
    var update_id = spark.id
    if(data.type) {
      primus.forEach(function (spark, id, connections) {
        if(id == update_id) { return; }
        data.mode = 'broadcast';
        spark.write(data)
      });
    }
  });

});

primus.on('disconnection', function (spark) {
  sync_devices();
});

server.listen(app.get('port'), function() {
  console.log('Server started: http://localhost:' + app.get('port') + '/');
});
