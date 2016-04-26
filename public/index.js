var React = require('react');
var connect = require('react-redux').connect;
var Link = require('react-router').Link;

var Index = React.createClass({
	render: function() {
		var netStatusText = this.props.netStatus;
		if(this.props.netStatus == 'online' && this.props.devices.length > 1) {
			netStatusText = this.props.devices.length+' devices online';
		}
		var netStatusLabel = null;
		if(this.props.netStatus != "static") {
			netStatusLabel = <div className={"net-status "+this.props.netStatus}><span className="net-status-indicator">&#9679; </span>{netStatusText}</div>
		}
		return (
		<html>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>React Sync Demo</title>
				<link rel="stylesheet" href="css/base.css" />
				<script dangerouslySetInnerHTML={{__html: this.props.initialState}} />
			</head>
			<body>
				<div id="content">
					{netStatusLabel}
					<em>React Sync Demo</em>:<br /> <em><a href="https://medium.com/@firasd/quick-start-tutorial-universal-react-with-server-side-rendering-76fe5363d6e" target="_blank">Article</a> &middot; <a href="https://github.com/firasd/react-sync-demo/" target="_blank">Github</a></em>
					<ul>
						<li><Link to="/" activeStyle={{fontWeight: 'bold'}} onlyActiveOnIndex>Comments</Link></li>
						<li><Link to="/another-page" activeStyle={{fontWeight: 'bold'}}>Another Page</Link></li>
					</ul>
					{this.props.children}
					<p style={{marginTop: '4em', textAlign: 'center'}}>Made with &hearts; in 2016</p>
				</div>

				<script src="scripts/polyfill.js"></script>
				<script src="scripts/primus.js"></script>
				<script src="scripts/bundle.js"></script>

			</body>
		</html>
		)
	}
});

var IndexState = function(state) {
	delete state.routing;
	var stateJSON = JSON.stringify(state).replace(/<\/script/g, '<\\/script').replace(/<!--/g, '<\\!--');
	return {
		initialState: "window.__INITIAL_STATE__ = "+stateJSON,
		netStatus: state.netStatus,
		devices: state.devices
	}
}

Index = connect(
	IndexState
)(Index)

module.exports = Index
