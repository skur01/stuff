(game => {
	if (!game.map || !game.player) return;

	const CLEAN_MON = "00zw418h";
	const FLOTOM_UID = "flotom";
	const WATERSPRAY_1 = "https://dl.dropboxusercontent.com/scl/fi/ic8z5es3s55p5v7g1w0dk/Waterspray1.ogg?rlkey=hddsmf1779vhmkhx7hhssfo2h&dl=1";
	const WATERSPRAY_2 = "https://dl.dropboxusercontent.com/scl/fi/ljsoxpe4lvr1nxm5j5q71/Waterspray2.ogg?rlkey=hku5lng0h72c515o9lqfqrm87&dl=1";
	const TILE_SIZE = 16;

	const state = game.player.cleanState || (game.player.cleanState = { cleaning: false, flotom: null, cleanAlly: null, spray1: null, spray2: null });

	const startSpray = () => {
		state.spray1 = game.sound.play(WATERSPRAY_1, false, () => {
			state.spray1 = null;
			if (!state.cleaning) return;
			state.spray2 = game.sound.play(WATERSPRAY_2, false);
			if (state.spray2) state.spray2.loop = true;
		});
	};

	const stopSpray = () => {
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

	const getCleanAlly = () => {
		let ally = game.player.ally;
		while (ally) {
			if (ally.skin === CLEAN_MON || (ally.textureName && ally.textureName.includes(CLEAN_MON))) return ally;
			ally = ally.ally;
		}
		return null;
	};

	const spawnFlotom = () => {
		const front = tileAhead(game.player.x, game.player.y, game.player.direction);
		state.flotom = game.objects.add({
			type: "entity",
			uid: FLOTOM_UID,
			texture: CLEAN_MON,
			x: front[0],
			y: front[1],
			direction: game.player.direction,
			map: game.map.current,
			addToMap: true,
			solid: false,
			player: true
		});
		state.flotomTileX = null;
		state.flotomTileY = null;

		// splash array layout matches map splash tiles: [.., .., sprite, frames, fps, loop]
		state.flotom.createSplash([0, 0, "1995/rippleanim", 3, 100, 1]);
	};

	const startCleaning = () => {
		state.cleaning = true;
		game.map.eventVars["cleanmode"] = 1;
		state.cleanAlly = getCleanAlly();
		if (state.cleanAlly) state.cleanAlly.setOpacity(0);
		spawnFlotom();
		startSpray();
	};

	const stopCleaning = () => {
		state.cleaning = false;
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
		const label = state.cleaning ? "Stop Cleaning" : "Cleaning Mode";
		game.textbox.say("What would you like to do?");
		game.textbox.answers([
			[label, () => state.cleaning ? stopCleaning() : startCleaning()],
			["Nevermind", () => {}]
		]);
	};

	if (state.cleaning && (!state.flotom || !state.flotom.uid)) spawnFlotom();

	if (!game.player.cleanKeysHooked) {
		game.player.cleanKeysHooked = true;

		const originalLocalKeys = game.player.localKeys.bind(game.player);
		game.player.localKeys = function(moving) {
			if (game.input.keyPressed("action") && game.textbox.active < 0) {
				const front = tileAhead(game.player.x, game.player.y, game.player.direction);
				const facing = state.cleaning ? state.flotom : getCleanAlly();

				if (facing && facing.x === front[0] && facing.y === front[1]) {
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
			if (!state.cleaning) return;

			// recalling the mon to its ball turns cleaning off
			if (game.player.allyId.indexOf(CLEAN_MON) < 0) {
				stopCleaning();
				return;
			}

			// map reloads null the uid of string-uid objects, respawn right away
			if (!state.flotom || !state.flotom.uid) spawnFlotom();

			// glue the flotom one tile ahead of the player's live position every frame
			const front = tileAhead(game.player.x, game.player.y, game.player.direction);
			state.flotom.x = front[0];
			state.flotom.y = front[1];
			state.flotom.setSpritePosition();

			if (state.flotomDir !== game.player.direction) {
				state.flotomDir = game.player.direction;
				state.flotom.setDirection(game.player.direction);
			}

			// fire the flotom ontiles when it crosses into a new tile
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
