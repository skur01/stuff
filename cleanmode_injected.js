(game => {
	if (!game.map || !game.player) return;

	const CLEAN_MON = "00zw418h";
	const FLOTOM_UID = "flotom";
	const WATERSPRAY_1 = "https://dl.dropboxusercontent.com/scl/fi/ic8z5es3s55p5v7g1w0dk/Waterspray1.ogg?rlkey=hddsmf1779vhmkhx7hhssfo2h&dl=1";
	const WATERSPRAY_2 = "https://dl.dropboxusercontent.com/scl/fi/ljsoxpe4lvr1nxm5j5q71/Waterspray2.ogg?rlkey=hku5lng0h72c515o9lqfqrm87&dl=1";
	const TILE_SIZE = 16;
	const FLOAT_HEIGHT = 16;

	const state = game.player.cleanState || (game.player.cleanState = {
		mode: null,
		flotom: null,
		cleanAlly: null,
		spray1: null,
		spray2: null,
		sprayOn: false,
		floatEngaged: false,
		prevNoJumping: false,
		flotomTileX: null,
		flotomTileY: null,
		flotomDir: null
	});

	const startSpray = () => {
		if (state.sprayOn) return;
		state.sprayOn = true;
		state.spray1 = game.sound.play(WATERSPRAY_1, false, () => {
			state.spray1 = null;
			if (!state.sprayOn) return;
			state.spray2 = game.sound.play(WATERSPRAY_2, false);
			if (state.spray2) state.spray2.loop = true;
		});
	};

	const stopSpray = () => {
		state.sprayOn = false;
		if (state.spray1) { state.spray1.stop(); state.spray1 = null; }
		if (state.spray2) { state.spray2.stop(); state.spray2 = null; }
	};

	// tile one step from (x, y) facing direction (0 down, 1 up, 2 right, 3 left)
	const tileAhead = (x, y, direction) => {
		if (direction === 0) return [x, y + TILE_SIZE];
		if (direction === 1) return [x, y - TILE_SIZE];
		if (direction === 2) return [x + TILE_SIZE, y];
		return [x - TILE_SIZE, y];
	};

	const tileBehind = (x, y, direction) => {
		if (direction === 0) return [x, y - TILE_SIZE];
		if (direction === 1) return [x, y + TILE_SIZE];
		if (direction === 2) return [x - TILE_SIZE, y];
		return [x + TILE_SIZE, y];
	};

	const glueTarget = () => {
		if (state.mode === "floating") return tileBehind(game.player.x, game.player.y, game.player.direction);
		return tileAhead(game.player.x, game.player.y, game.player.direction);
	};

	const getCleanAlly = () => {
		let ally = game.player.ally;
		while (ally) {
			if (ally.skin === CLEAN_MON || (ally.textureName && ally.textureName.includes(CLEAN_MON))) return ally;
			ally = ally.ally;
		}
		return null;
	};

	const spawnFlotom = () => {
		const spot = glueTarget();
		state.flotom = game.objects.add({
			type: "entity",
			uid: FLOTOM_UID,
			texture: CLEAN_MON,
			x: spot[0],
			y: spot[1],
			direction: game.player.direction,
			map: game.map.current,
			addToMap: true,
			solid: false,
			player: true
		});
		state.flotomTileX = null;
		state.flotomTileY = null;

		// splash array layout matches map splash tiles: [.., .., sprite, frames, fps, loop]
		if (state.mode === "cleaning" || state.floatEngaged) state.flotom.createSplash([0, 0, "1995/rippleanim", 3, 100, 1]);

		if (state.floatEngaged) {
			state.flotom.floating = 1;
			state.flotom.floatingHeight = FLOAT_HEIGHT;
		}
	};

	const engageFloat = () => {
		state.floatEngaged = true;
		state.prevNoJumping = game.map.noJumping;
		game.map.noJumping = true;
		game.map.eventVars["cleanmode"] = 1;
		game.player.floating = 1;
		game.player.floatingHeight = FLOAT_HEIGHT;
		game.client.relay([39, FLOAT_HEIGHT]);

		if (state.flotom) {
			state.flotom.floating = 1;
			state.flotom.floatingHeight = FLOAT_HEIGHT;
			state.flotom.createSplash([0, 0, "1995/rippleanim", 3, 100, 1]);
		}

		startSpray();
	};

	const disengageFloat = () => {
		state.floatEngaged = false;
		game.map.noJumping = state.prevNoJumping;
		game.map.eventVars["cleanmode"] = 0;
		game.player.floating = 0;
		game.player.floatingHeight = 0;
		game.client.relay([39, 0]);

		if (state.flotom) {
			state.flotom.floating = 0;
			state.flotom.floatingHeight = 0;
			state.flotom.destroySplash();
		}

		stopSpray();
	};

	const startMode = mode => {
		state.mode = mode;
		state.cleanAlly = getCleanAlly();
		if (state.cleanAlly) state.cleanAlly.setOpacity(0);
		spawnFlotom();

		if (mode === "cleaning") {
			game.map.eventVars["cleanmode"] = 1;
			startSpray();
		}
	};

	const stopMode = () => {
		if (state.floatEngaged) disengageFloat();
		state.mode = null;
		game.map.eventVars["cleanmode"] = 0;
		stopSpray();
		if (state.flotom) {
			state.flotom.destroySplash();
			state.flotom.remove();
			state.flotom = null;
		}
		if (state.cleanAlly) {
			state.cleanAlly.setOpacity(100);
			state.cleanAlly = null;
		}
	};

	const openMenu = () => {
		if (state.mode) {
			const label = state.mode === "cleaning" ? "Stop Cleaning" : "Stop Floating";
			game.textbox.say("What would you like to do?");
			game.textbox.answers([
				[label, () => stopMode()],
				["Nevermind", () => {}]
			]);
			return;
		}

		game.textbox.say("What would you like to do?");
		game.textbox.answers([
			["Cleaning Mode", () => startMode("cleaning")],
			["Floating Mode", () => startMode("floating")],
			["Nevermind", () => {}]
		]);
	};

	if (!game.player.cleanKeysHooked) {
		game.player.cleanKeysHooked = true;

		const originalLocalKeys = game.player.localKeys.bind(game.player);
		game.player.localKeys = function(moving) {
			// float while the jump key is held
			if (state.mode === "floating") {
				const held = game.input.keyHeld("jump");
				if (held && !state.floatEngaged) engageFloat();
				else if (!held && state.floatEngaged) disengageFloat();
			}

			if (game.input.keyPressed("action") && game.textbox.active < 0) {
				const front = tileAhead(game.player.x, game.player.y, game.player.direction);
				const behind = tileBehind(game.player.x, game.player.y, game.player.direction);
				const facing = state.mode ? state.flotom : getCleanAlly();

				const atFront = facing && facing.x === front[0] && facing.y === front[1];
				const atBehind = state.mode === "floating" && facing && facing.x === behind[0] && facing.y === behind[1];

				if (atFront || atBehind) {
					openMenu();
					return;
				}
			}

			originalLocalKeys(moving);
		};
	}

	if (!game.player.cleanUpdateHooked) {
		game.player.cleanUpdateHooked = true;

		const originalUpdate = game.player.update.bind(game.player);
		game.player.update = function() {
			originalUpdate();
			if (!state.mode) return;

			// recalling the mon turns the mode off
			if (game.player.allyId.indexOf(CLEAN_MON) < 0) {
				stopMode();
				return;
			}

			// map reloads null the uid of string-uid objects, respawn right away
			if (!state.flotom || !state.flotom.uid) spawnFlotom();

			const spot = glueTarget();
			state.flotom.x = spot[0];
			state.flotom.y = spot[1];
			state.flotom.setSpritePosition();

			if (state.flotomDir !== game.player.direction) {
				state.flotomDir = game.player.direction;
				state.flotom.setDirection(game.player.direction);
			}

			// only fire ontiles while cleanmode is active
			if (state.mode === "floating" && !state.floatEngaged) return;

			const tileX = Math.round(state.flotom.x / TILE_SIZE) * TILE_SIZE;
			const tileY = Math.round(state.flotom.y / TILE_SIZE) * TILE_SIZE;
			if (tileX !== state.flotomTileX || tileY !== state.flotomTileY) {
				state.flotomTileX = tileX;
				state.flotomTileY = tileY;
				state.flotom.ontiled = false;

				game.map.checkTile(tileX + state.flotom.offset.x - 8, tileY + state.flotom.offset.y - 16, state.flotom);
			}
		};
	}
})(game)
