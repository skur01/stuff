game => {
	if (game.map.__tagInGamePatched) return;
	game.map.__tagInGamePatched = true;
	const MAPVAR_PARTICIPATING  = "TAG_participating";
	const MAPVAR_HOST           = "TAG_host";
	const MAPVAR_IT             = "TAG_it";
	const MAPVAR_END_TIME       = "TAG_endTime";
	const TAG_DURATION_MS       = 180000;
	const TAG_ICON              = 1;
	const PARTICIPANT_ICON      = 2;
	const TAG_TOUCH_RADIUS      = 16;
	const TAG_FREEZE_MS         = 3000;
	const TAG_PREFIX            = "TAG:";
	const SUB_JOIN              = "join";
	const SUB_LEAVE             = "leave";
	const SUB_INVITE            = "invite";
	const SUB_START             = "start";
	const SUB_PASS              = "pass";
	const SUB_SYNC              = "sync";
	const SUB_END               = "end";
	const IT_LEAVE_DELAY_MS     = 3000;
	const lobbyMembers    = new Set();
	const notifiedPlayers = new Set();
	let   hudElement      = null;
	let   timerElement    = null;
	let   timerInterval   = null;
	let   blackoutGraphic = null;
	let   itLeaveTimer    = null;
	let   hostUid         = "";
	let   tagCooldownUntil = 0;
	const isHost          = () => !!+game.map.getVar(MAPVAR_HOST, 0);
	const isIt            = () => game.map.getVar(MAPVAR_IT, "") === game.player.uid;
	const isActive        = () => !!+game.map.getVar(MAPVAR_END_TIME, 0);
	const isParticipating = () => !!+game.map.getVar(MAPVAR_PARTICIPATING, 0);
	const setVar = (name, value) => game.trigger(name + "=" + value);
	const relayToMap = str      => game.client.relay([24, "map", str]);
	const relayTo    = (u, str) => game.client.relay([24, u, str]);
	const removeHud = () => {
		if (hudElement && hudElement.parentNode) hudElement.parentNode.removeChild(hudElement);
		hudElement = null;
	};
	const removeTimerHud = () => {
		clearInterval(timerInterval);
		timerInterval = null;
		if (timerElement && timerElement.parentNode) timerElement.parentNode.removeChild(timerElement);
		timerElement = null;
	};
	const startTimerHud = endTime => {
		removeTimerHud();
		timerElement = document.createElement("div");
		timerElement.style.cssText = [
			"position:fixed",
			"bottom:32px",
			"left:50%",
			"transform:translateX(-50%)",
			"background:rgba(0,0,0,0.65)",
			"color:#ffffff",
			"font:bold 14pt verdana,sans-serif",
			"padding:6px 14px",
			"border-radius:6px",
			"pointer-events:none",
			"z-index:99999",
			"white-space:nowrap"
		].join(";");
		document.body.appendChild(timerElement);
		const tick = () => {
			const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
			timerElement.textContent = remaining + "s";
			if (remaining === 0) removeTimerHud();
		};
		tick();
		timerInterval = setInterval(tick, 500);
	};
	const removeBlackout = () => {
		if (blackoutGraphic && blackoutGraphic.parent) {
			blackoutGraphic.parent.removeChild(blackoutGraphic);
		}
		blackoutGraphic = null;
	};
	const applyItFreeze = () => {
		game.player.canMove = false;
		game.player.frozen  = true;
		tagCooldownUntil    = Date.now() + TAG_FREEZE_MS;
		const w = game.renderer.width;
		const h = game.renderer.height;
		blackoutGraphic = new PIXI.Graphics();
		blackoutGraphic.beginFill(0x000000, 1);
		blackoutGraphic.drawRect(0, 0, w, h);
		blackoutGraphic.endFill();
		blackoutGraphic.alpha = 1;
		game.containers.overlay.addChild(blackoutGraphic);
		const startTime  = Date.now();
		const fadeTick = setInterval(() => {
			const elapsed  = Date.now() - startTime;
			const progress = Math.min(1, elapsed / TAG_FREEZE_MS);
			blackoutGraphic.alpha = 1 - progress;
			if (progress >= 1) {
				clearInterval(fadeTick);
				removeBlackout();
				game.player.canMove = true;
				game.player.frozen  = false;
			}
		}, 16);
	};
	const showHud = text => {
		if (!hudElement) {
			hudElement = document.createElement("div");
			hudElement.style.cssText = [
				"position:fixed",
				"top:8px",
				"left:50%",
				"transform:translateX(-50%)",
				"background:rgba(0,0,0,0.55)",
				"color:#7fff7f",
				"font:bold 10pt verdana,sans-serif",
				"padding:4px 10px",
				"border-radius:4px",
				"pointer-events:none",
				"z-index:99999",
				"white-space:nowrap"
			].join(";");
			document.body.appendChild(hudElement);
		}
		hudElement.textContent = text;
	};
	const updateLobbyHud = () => {
		if (!isHost()) return;
		const count = lobbyMembers.size + 1;
		showHud("Tag lobby: " + count + " player" + (count !== 1 ? "s" : "") + " - Jump to start!");
	};
	const openLobby = () => {
		setVar(MAPVAR_HOST, 1);
		setVar(MAPVAR_PARTICIPATING, 1);
		lobbyMembers.clear();
		updateLobbyHud();
	};
	const closeLobby = () => {
		setVar(MAPVAR_HOST, 0);
		setVar(MAPVAR_PARTICIPATING, 0);
		lobbyMembers.clear();
		removeHud();
	};
	const joinLobby = hostUsername => {
		setVar(MAPVAR_PARTICIPATING, 1);
		setVar(MAPVAR_HOST, 0);
		game.map.mapVars[MAPVAR_HOST + "_name"] = hostUsername;
		relayTo(hostUsername, TAG_PREFIX + SUB_JOIN + ":" + game.player.uid + ":" + game.player.username);
		showHud("Joined tag lobby! Waiting for host to start...");
	};
	const leaveLobby = () => {
		const hostUsername = game.map.mapVars[MAPVAR_HOST + "_name"] || "";
		setVar(MAPVAR_PARTICIPATING, 0);
		game.map.mapVars[MAPVAR_HOST + "_name"] = "";
		if (hostUsername) relayTo(hostUsername, TAG_PREFIX + SUB_LEAVE + ":" + game.player.uid);
		removeHud();
	};
	const showParticipantIcons = () => {
		for (const name in game.players.list) {
			if (name === "all") continue;
			const other = game.players.list[name];
			if (other && other.nearby) other.createIcon(PARTICIPANT_ICON, true);
		}
	};
	const clearParticipantIcons = () => {
		for (const name in game.players.list) {
			if (name === "all") continue;
			const other = game.players.list[name];
			if (other && other.nearby && other.icon) other.createIcon(0);
		}
	};
	const startGame = () => {
		if (!isHost() || isActive()) return;
		const endTime = Date.now() + TAG_DURATION_MS;
		hostUid = game.player.uid;
		setVar(MAPVAR_IT, game.player.uid);
		setVar(MAPVAR_END_TIME, endTime);
		setVar(MAPVAR_PARTICIPATING, 1);
		game.player.createIcon(TAG_ICON, true);
		showParticipantIcons();
		applyItFreeze();
		startTimerHud(endTime);
		relayToMap(TAG_PREFIX + SUB_START + ":" + game.player.uid + ":" + endTime + ":" + game.player.uid);
		scheduleGameEnd(endTime);
		showHud("You're IT!");
	};
	const receiveStart = (itUid, endTime, hUid) => {
		hostUid = hUid || hostUid;
		setVar(MAPVAR_IT, itUid);
		setVar(MAPVAR_END_TIME, endTime);
		const itObj = game.objects.ids[itUid];
		if (itObj) itObj.createIcon(TAG_ICON, true);
		if (itUid === game.player.uid) {
			showParticipantIcons();
			applyItFreeze();
		}
		startTimerHud(endTime);
		scheduleGameEnd(endTime);
		showHud(itUid === game.player.uid ? "You're IT!" : "Tag started!");
	};
	const passTag = targetObj => {
		if (!isIt() || !isActive()) return;
		if (Date.now() < tagCooldownUntil) return;
		setVar(MAPVAR_IT, targetObj.uid);
		clearParticipantIcons();
		game.player.createIcon(0);
		targetObj.createIcon(TAG_ICON, true);
		relayToMap(TAG_PREFIX + SUB_PASS + ":" + targetObj.uid);
		showHud("You tagged " + targetObj.username + "!");
	};
	const receivePass = newItUid => {
		const wasIt     = isIt();
		const prevItUid = game.map.getVar(MAPVAR_IT, "");
		const prevItObj = game.objects.ids[prevItUid];
		if (prevItObj) prevItObj.createIcon(0);
		setVar(MAPVAR_IT, newItUid);
		const newItObj = game.objects.ids[newItUid];
		if (newItObj) newItObj.createIcon(TAG_ICON, true);
		if (wasIt) clearParticipantIcons();
		if (newItUid === game.player.uid) {
			showParticipantIcons();
			applyItFreeze();
		}
		if (newItUid === game.player.uid) {
			showHud("You're IT!");
		} else if (newItObj) {
			showHud(newItObj.username + " is now IT!");
		}
	};
	const forcePassTag = () => {
		if (!isHost() || !isActive()) return;
		const candidates = [];
		for (const name in game.players.list) {
			if (name === "all") continue;
			const other = game.players.list[name];
			if (other && other.nearby) candidates.push(other);
		}
		candidates.push(game.player);
		if (!candidates.length) { endGame(); return; }
		const newIt = candidates[Math.floor(Math.random() * candidates.length)];
		const prevItUid = game.map.getVar(MAPVAR_IT, "");
		const prevItObj = game.objects.ids[prevItUid];
		if (prevItObj) prevItObj.createIcon(0);
		setVar(MAPVAR_IT, newIt.uid);
		newIt.createIcon(TAG_ICON, true);
		relayToMap(TAG_PREFIX + SUB_PASS + ":" + newIt.uid);
		showHud(newIt === game.player ? "The previous IT left - you're IT!" : newIt.username + " is now IT!");
	};
	const receiveEnd = itUsername => {
		const wasIt = isIt();
		if (wasIt) clearParticipantIcons();
		setVar(MAPVAR_IT, 0);
		setVar(MAPVAR_END_TIME, 0);
		setVar(MAPVAR_PARTICIPATING, 0);
		game.map.mapVars[MAPVAR_HOST + "_name"] = "";
		game.player.createIcon(0);
		removeTimerHud();
		removeHud();
		if (wasIt) {
			game.textbox.say("Time's up! You were IT - you lose!");
		} else if (itUsername) {
			game.textbox.say("Time's up! " + itUsername + " was IT - you win!");
		}
	};
	const endGame = () => {
		const wasIt      = isIt();
		const itUid      = game.map.getVar(MAPVAR_IT, "");
		const itObj      = game.objects.ids[itUid];
		const itUsername = itObj ? itObj.username : "someone";
		clearTimeout(itLeaveTimer);
		itLeaveTimer = null;
		setVar(MAPVAR_IT, 0);
		setVar(MAPVAR_END_TIME, 0);
		setVar(MAPVAR_PARTICIPATING, 0);
		setVar(MAPVAR_HOST, 0);
		game.map.mapVars[MAPVAR_HOST + "_name"] = "";
		lobbyMembers.clear();
		notifiedPlayers.clear();
		if (wasIt) clearParticipantIcons();
		game.player.createIcon(0);
		removeTimerHud();
		removeHud();
		removeBlackout();
		relayToMap(TAG_PREFIX + SUB_END + ":" + itUsername);
		if (wasIt) {
			game.textbox.say("Time's up! You were IT - you lose!");
		} else {
			game.textbox.say("Time's up! " + itUsername + " was IT - you win!");
		}
	};
	const scheduleGameEnd = endTime => {
		const remaining = endTime - Date.now();
		if (remaining <= 0) { endGame(); return; }
		setTimeout(endGame, remaining);
	};
	const pushSyncToPlayer = username => {
		if (!isIt() || !isActive()) return;
		relayTo(username, TAG_PREFIX + SUB_SYNC + ":" + game.player.uid + ":" + game.map.getVar(MAPVAR_END_TIME, 0) + ":" + hostUid);
	};
	const checkProximity = () => {
		if (!isIt() || !isActive()) return;
		if (Date.now() < tagCooldownUntil) return;
		const px = game.player.x;
		const py = game.player.y;
		for (const name in game.players.list) {
			if (name === "all") continue;
			const other = game.players.list[name];
			if (!other || !other.nearby || other === game.player) continue;
			const dx = other.x - px;
			const dy = other.y - py;
			if (Math.sqrt(dx * dx + dy * dy) <= TAG_TOUCH_RADIUS) {
				passTag(other);
				return;
			}
		}
	};
	const handleTagRelay = str => {
		const parts   = str.slice(TAG_PREFIX.length).split(":");
		const subtype = parts[0];
		if (subtype === SUB_INVITE) {
			const hostUsername = parts[1];
			game.map.mapVars[MAPVAR_HOST + "_name"] = hostUsername;
			game.textbox.say(hostUsername + " invited you to a Tag game!\nJoin in?");
			game.textbox.answers([
				["Yes!", () => joinLobby(hostUsername)],
				["No thanks"]
			]);
			return;
		}
		if (subtype === SUB_JOIN && isHost()) {
			lobbyMembers.add(parts[1]);
			updateLobbyHud();
			return;
		}
		if (subtype === SUB_LEAVE && isHost()) {
			lobbyMembers.delete(parts[1]);
			updateLobbyHud();
			return;
		}
		if (subtype === SUB_START) {
			receiveStart(parts[1], +parts[2], parts[3]);
			return;
		}
		if (subtype === SUB_PASS) {
			receivePass(parts[1]);
			return;
		}
		if (subtype === SUB_SYNC && !isActive()) {
			receiveStart(parts[1], +parts[2], parts[3]);
			return;
		}
		if (subtype === SUB_END) {
			receiveEnd(parts[1] || "");
			return;
		}
	};
	const buildTagAnswers = (targetObj, baseAnswers) => {
		const tagActive    = isActive();
		const participating = isParticipating();
		const hosting      = isHost();
		const answers = baseAnswers.slice();
		const cancelIdx = answers.length - 1;
		if (!tagActive) {
			if (hosting) {
				const alreadyIn = lobbyMembers.has(targetObj.uid);
				if (!alreadyIn) {
					answers.splice(cancelIdx, 0, ["Invite to Tag", () => {
						relayTo(targetObj.username, TAG_PREFIX + SUB_INVITE + ":" + game.player.username);
					}]);
				}
			} else if (participating) {
				answers.splice(cancelIdx, 0, ["Leave Tag lobby", () => leaveLobby()]);
			} else {
				answers.splice(cancelIdx, 0, ["Start Tag lobby", () => openLobby()]);
				answers.splice(cancelIdx + 1, 0, ["Join Tag lobby", () => joinLobby(targetObj.username)]);
			}
		}
		return answers;
	};
	const origCheckForInteraction = game.map.checkForInteraction.bind(game.map);
	game.map.checkForInteraction = function(obj, x, y, msg, ontouch, ontile, onlyCheckSolids) {
		const interceptCondition = x === undefined && obj.local && !ontouch && !ontile;
		console.log("[TAG] checkForInteraction called | x:", x, "obj.local:", obj.local, "ontouch:", ontouch, "ontile:", ontile, "=> intercept:", interceptCondition);
		if (interceptCondition) {
			const clickX = obj.x + (obj.direction === 2 ? 16 : obj.direction === 3 ? -16 : 0);
			const clickY = obj.y + (obj.direction === 0 ? 16 : obj.direction === 1 ? -16 : 0);
			const key    = clickX + "," + clickY + "," + obj.z;
			console.log("[TAG] player pos:", obj.x, obj.y, "direction:", obj.direction, "z:", obj.z, "=> entity key:", key);
			console.log("[TAG] entities at key:", game.map.entities[key]);
			const entity = game.map.entities[key] && game.map.entities[key][0];
			console.log("[TAG] entity found:", entity, "entity.player:", entity && entity.player, "entity.uid:", entity && entity.uid);
			if (entity && entity.player && !String(entity.uid).endsWith("-ally")) {
				console.log("[TAG] intercept succeeded, building tag menu for:", entity.username);
				const targetObj = entity;
				game.textbox.say("It's " + targetObj.username + "!");
				let level   = 100;
				let mode    = "single";
				const battleFn = () => {
					game.textbox.say("Current PVP rules: Level -> " + level + ", Mode -> " + mode + "s");
					const battleAnswers = [];
					battleAnswers.push(["Start Battle", () => {
						game.battle.pendingEnemyName = targetObj.username.toLowerCase();
						game.client.relay([79, targetObj.uid, 0, "fixedlevel " + level + (mode === "single" ? "" : ";" + mode) + ";"]);
					}]);
					battleAnswers.push(["Change Level", () => {
						game.textbox.say("Change Level from " + level + " to:");
						const lvlAnswers = [];
						if (level !== 100) lvlAnswers.push(["100", () => { level = 100; battleFn(); }]);
						if (level !== 50)  lvlAnswers.push(["50",  () => { level = 50;  battleFn(); }]);
						if (level !== 5)   lvlAnswers.push(["5",   () => { level = 5;   battleFn(); }]);
						lvlAnswers.push(["Back", () => battleFn()]);
						game.textbox.answers(lvlAnswers);
					}]);
					battleAnswers.push(["Cancel"]);
					game.textbox.answers(battleAnswers);
				};
				let baseAnswers = [];
				baseAnswers.push(["Smile", () => game.trigger("icon=3")]);
				baseAnswers.push(["Trade", () => game.client.relay([100, targetObj.uid, 0])]);
				baseAnswers.push(["Battle", () => battleFn()]);
				if (targetObj.battling) {
					baseAnswers.push(["Spectate", () => {
						game.battle.pendingEnemyName = targetObj.username.toLowerCase();
						game.client.relay([127, targetObj.uid]);
					}]);
				}
				baseAnswers.push(["Cancel"]);
				game.textbox.answers(buildTagAnswers(targetObj, baseAnswers));
				return true;
			}
		}
		return origCheckForInteraction(obj, x, y, msg, ontouch, ontile, onlyCheckSolids);
	};
	const origReceive = game.client.receive.bind(game.client);
	game.client.receive = function(data) {
		origReceive(data);
		if (data[0] === 2 && data.length === 2 && isActive()) {
			const leavingUid = String(data[1]);
			if (leavingUid === hostUid) {
				receiveEnd();
				return;
			}
			if (isHost() && leavingUid === game.map.getVar(MAPVAR_IT, "")) {
				clearTimeout(itLeaveTimer);
				showHud("IT left! New IT in 3 seconds...");
				itLeaveTimer = setTimeout(forcePassTag, IT_LEAVE_DELAY_MS);
			}
		}
		if (data[0] === 4 && data[1] && data[2]) {
			const uid      = String(data[1]);
			const username = data[2];
			if (!notifiedPlayers.has(uid)) {
				notifiedPlayers.add(uid);
				pushSyncToPlayer(username);
			}
			if (isIt() && isActive()) {
				const arrivalObj = game.objects.ids[uid];
				if (arrivalObj) arrivalObj.createIcon(PARTICIPANT_ICON, true);
			}
		}
		if (data[0] === 24 && typeof data[1] === "string" && data[1].startsWith(TAG_PREFIX)) {
			handleTagRelay(data[1]);
		}
	};
	const origJump = game.player.jump.bind(game.player);
	game.player.jump = function(height) {
		origJump(height);
		if (isHost() && !isActive()) startGame();
	};
	const origOverworldUpdate = GameState.overworld.prototype.update;
	GameState.overworld.prototype.update = function() {
		origOverworldUpdate.call(this);
		if (this.game === game) checkProximity();
	};
	const origLoad = game.map.load.bind(game.map);
	game.map.load = function(...args) {
		clearTimeout(itLeaveTimer);
		itLeaveTimer = null;
		notifiedPlayers.clear();
		lobbyMembers.clear();
		removeTimerHud();
		removeBlackout();
		removeHud();
		if (isHost() && isActive()) {
			const itUid  = game.map.getVar(MAPVAR_IT, "");
			const itObj  = game.objects.ids[itUid];
			relayToMap(TAG_PREFIX + SUB_END + ":" + (itObj ? itObj.username : ""));
		}
		game.client.receive                  = origReceive;
		game.map.checkForInteraction         = origCheckForInteraction;
		game.player.jump                     = origJump;
		GameState.overworld.prototype.update = origOverworldUpdate;
		game.map.__tagInGamePatched          = false;
		origLoad(...args);
	};
}
