[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

# React Sync Demo

This is a modified version of the React comment box example from [the React tutorial](http://facebook.github.io/react/docs/tutorial.html). The example app has been modified to demonstrate syncing updates and offline activity across devices.


## To use

Start the server with:

```sh
npm install
node server.js
```

And visit <http://localhost:3000/>. Try opening multiple tabs!

You can change the port number by setting the `$PORT` environment variable before invoking the script, e.g.,

```sh
PORT=3001 node server.js
```

## Development

Primus is set to create a new `public/scripts/primus.js` file when the server starts. If you're using nodemon to restart on file changes:

```sh
nodemon --ignore public --ignore comments.json
```

Webpack config in `webpack.config.js` runs DefinePlugin to set NODE_ENV to production, and UglifyJS to minify files. Comment out the plugins, then run webpack:

```sh
webpack ---watch
```