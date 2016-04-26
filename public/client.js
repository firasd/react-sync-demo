var React = require('react');
var ReactDOM = require('react-dom');

var Provider = require('react-redux').Provider;
var Router = require('react-router').Router;
var browserHistory = require('react-router').browserHistory;
var syncHistoryWithStore = require('react-router-redux').syncHistoryWithStore;

var store = require('./redux-store');
var routes = require('./routes').routes;

var initialState = window.__INITIAL_STATE__;
store = store.configureStore(initialState)
window.store = store;

var history = syncHistoryWithStore(browserHistory, store);

window.primus = new Primus('/primus',{reconnect: {max: 60000, min: 500, retries: Infinity}});

primus.on('open', function() {
  store.dispatch({
    type: 'net_status',
    netStatus: 'online'
  })
});

primus.on('data', function(data) {
  if(data.type) {
    store.dispatch(data);
  }
});

primus.on('close', function () {
  store.dispatch({
    type: 'net_status',
    netStatus: 'offline'
  })
});

ReactDOM.render(
  <Provider store={store}>
    <Router history={history} routes={routes} />
  </Provider>,
  document
)
