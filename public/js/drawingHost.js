var countdownTimer = (function($) {
	function init(element) {
		console.log(element);
		var t = $(element).find('.timerSecs')[0];
		var w = element;
		var s = t.innerText;
		var i = null;
		function start(secs){
			if(secs !== undefined){
				s = parseInt(secs); // start the timer with a new countdown
				t.innerHTML = s;
			}
			w.classList.add("spin");
			interval();
		}

		function stop(){
			w.classList.remove("spin");
			if (i) {
				window.clearInterval(i);
				i= null;
			}	
		}

		interval = function(){
			i = window.setInterval(function() {
				//console.log('fire');
				if(s == 0){
					stop();
					return;
				}else{
					s--;
					t.innerText = s;
				}
			}, 1000); // every second
		}
		return {
			start : start, 
			stop : stop
		}
	}
	return init;
})(jQuery);


var drawingHost = function($, data) {

	var viewModel = {
		players : ko.observableArray(),
		id: ko.observable(''),
		joinUrl : ko.observable(''),
		state : ko.observable('waiting'),
		initialised : ko.observable(false),
		currentPlayer: ko.observable()
	};

	viewModel.startGame = function() {
		data.startGame(viewModel.id());
	};

	var Player = function(data) {
		return {
			name : ko.observable(data.name),
			score : ko.observable(data.score),
			id : ko.observable(data.playerId)
		}
	}

	function initialiseTurn(turn) {
		viewModel.currentPlayer({
			name : ko.observable(turn.player.name)
		});
		viewModel.state('word');
	}

	function changeState(state) {
		console.log(state);
		viewModel.state(state.state);
		_surface.clear();
		if (state.state === 'drawing') {
			timer.start(30);
		} else {
			timer.stop();
		}
	}

	var _surface, timer;

	function setPlayers(players) {
		viewModel.players.removeAll();
		ko.utils.arrayPushAll(viewModel.players(), players.map(function(p) {
					return new Player(p);
				}));
		
		viewModel.players.sort(function(a,b) { return a.score - b.score; });
		viewModel.players.valueHasMutated();
	}	

	function initGame(id, joinUrl) {
		timer = countdownTimer($('#timerWrapper')[0]);

		var socket = io.connect();
		viewModel.id(id);
		viewModel.joinUrl(joinUrl);
		var canvasDiv = $('#canvasWrapper')[0];
		console.log($('#canvasWrapper'));

		_surface= RockDrawing.CreateSurface(canvasDiv);

		data.getPlayers(id).then(function(players) {
			if (players.length > 0) {
				setPlayers(players);
			}

			socket.on('playerJoined', function(data) {
				viewModel.players.push(new Player(data));
			});
		});

		//should update rather than just reloading whole list
		socket.on('scoreUpdate', function(players) {
			setPlayers(players);

		});

		data.getState(id).then(function(state) {
			viewModel.initialised(true);
			socket.emit('host', id);
			changeState(state);
			socket.on('stateChange', changeState);
		}, function(e) {
			alert('Error fetching data');
		});


		var buffer = [];
		var processNext;
		var isDrawing = false;

		processNext = function() {
			if (buffer.length > 0) {
				isDrawing = true;
				//console.log("executing command");
				_surface.redrawCommand(buffer.shift(), processNext);
			} else {
				isDrawing = false;
			}
		}

		function preProcessCommand(data) {
			if (data.command.path) {
				var maxPlayerCanvas = Math.max(data.screenWidth, data.screenHeight);
				
				if (maxPlayerCanvas) {
					var ourCanvasMin = Math.min(drawingDiv.width(), drawingDiv.height());

					var scalar = ourCanvasMin / maxPlayerCanvas;
					console.log("our", ourCanvasMin, "player", maxPlayerCanvas);
					console.log(scalar);
					data.command.toolSize = Math.round(data.command.toolSize * scalar); 
					data.command.path = data.command.path.map(function(p) {
						return [
							Math.round(p[0] * scalar), 
							Math.round(p[1] * scalar)
						];
					});
				}
			}
		}

		var drawingDiv = $('#canvasWrapper');

		socket.on('drawCommand', function(data) {
			preProcessCommand(data);

			buffer.push(data.command);

			if (!isDrawing) {
				processNext();
			}
		});
	}

	return {
		init : function(elem, gameId, joinUrl) {
			ko.applyBindings(viewModel, elem);
			console.log(joinUrl);
			initGame(gameId, joinUrl);			
		}
	}
}(jQuery, drawingData);