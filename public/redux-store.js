var createStore = require('redux').createStore;
var combineReducers = require('redux').combineReducers;
var routerReducer = require('react-router-redux').routerReducer;

var dataReducer = function(state, action) {
  if(state === undefined) {
    return [];
  }
  var data = state;
  switch(action.type) {
    case 'add_comment':
      action.comment.status = 'adding';
      var data = data.concat([action.comment]);
      break;
    case 'delete_comment':
      for(i = 0; i < data.length; i++) {
        if(data[i].id == action.commentID) {
          var comment = Object.assign({}, data[i], {status: 'deleting'})
          data = data.slice(0, i).concat([comment], data.slice(i + 1))
        }
      }
      break;
    case 'set_comments':
      data = action.data;
      break;
  }
  return data;
}

var offlineDataReducer = function(state, action) {
  if(state === undefined) {
    return [];
  }
  var data = state;
  switch(action.type) {
    case 'add_offline_comment':
      action.comment.status = 'offline';
      data = data.concat([action.comment]);
      break;
    case 'delete_offline_comment':
      for(i = 0; i < data.length; i++) {
        if(data[i].id == action.commentID) {
          data = data.slice(0, i).concat(data.slice(i + 1))
        }
      }
      break;
    case 'clear_offline_comments':
      data = [];
      break;
  }
  return data;
}

var newCommentReducer = function(state, action) {
  var defaultInput = {author: '', text: ''}
  if(state === undefined) { return defaultInput; }
  var newComment = state;
  switch(action.type) {
    case 'author_change':
      newComment = Object.assign({}, newComment, {author: action.author});
      break;
    case 'text_change':
      newComment = Object.assign({}, newComment, {text: action.text});
      break;
    case 'clear_input':
      newComment = defaultInput;
      break;
  }
  return newComment;
}

var netStatusReducer = function(state, action) {
  if(state === undefined) { return 'static' }
  var netStatus = state;
  switch(action.type) {
    case 'net_status':
      netStatus = action.netStatus
      break;
  }
  return netStatus;
}

var devicesReducer = function(state, action) {
  if(state === undefined) { return [] }
  var devices = state;
  switch(action.type) {
    case 'set_devices':
      devices = action.devices;
      break;
	case 'net_status':
	  if(action.netStatus == 'offline') {
	    devices = [];
	  }
	  break;
  }
  return devices;
}

var genericReducer = function(state, action) {
  if(state === undefined) { return {} }
  return state;
}

var reducers = combineReducers({
  data: dataReducer,
  offlinedata: offlineDataReducer,
  newComment: newCommentReducer,
  url: genericReducer,
  netStatus: netStatusReducer,
  devices: devicesReducer,
  routing: routerReducer
})

var sync = function(store) {
  return function (next) {
    return function (action) {
      if(typeof primus !== "undefined") {
        switch(action.type) {
          case "net_status":
            if(action.netStatus == "online") {
              primus.writeAndWait({netStatus: 'online', offlinedata: store.getState().offlinedata}, function(response) {
                if(response.type == 'set_comments') {
                  store.dispatch({type: 'clear_offline_comments'})
                  store.dispatch(response);
                }
              });
            }
            break;
          case "author_change":
          case "text_change":
          case "clear_input":
          case "@@router/LOCATION_CHANGE":
            if(action.mode != "broadcast") {
              primus.write(action);
            }
            break;
          case "add_comment":
            if(primus.readyState === Primus.OPEN) {
              primus.writeAndWait(action, function(response) {
                if(response.type == 'set_comments') {
                  store.dispatch(response);
                }
              });
            } else {
              store.dispatch({type: 'add_offline_comment', comment: action.comment});
              return;
            }
            break;
          case "delete_comment":
            primus.writeAndWait(action, function(response) {
              if(response.type == 'set_comments') {
                store.dispatch(response);
              }
            });
            break;
        }
      }
      return next(action);
    };
  };
}

module.exports = {
  configureStore: function(initialState) {
    return createStore(reducers, initialState, require('redux').applyMiddleware(sync))
  }
}
