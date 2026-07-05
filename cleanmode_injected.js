(game => {
	if (!game.map || !game.player) return;

	const CLEAN_MON = "00zw418h";
	const FLOTOM_UID = "flotom";
	const WATERSPRAY_1 = "https://dl.dropboxusercontent.com/scl/fi/ic8z5es3s55p5v7g1w0dk/Waterspray1.ogg?rlkey=hddsmf1779vhmkhx7hhssfo2h&dl=1";
	const WATERSPRAY_2 = "https://dl.dropboxusercontent.com/scl/fi/ljsoxpe4lvr1nxm5j5q71/Waterspray2.ogg?rlkey=hku5lng0h72c515o9lqfqrm87&dl=1";
	const TILE_SIZE = 16;

	const state = game.player.cleanState || (game.player.cleanState = { cleaning: false, flotom: null, spray1: null, spray2: null });

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
			solid: false
		});
	};

	const startCleaning = () => {
		state.cleaning = true;
		game.map.eventVars["cleanmode"] = 1;
		spawnFlotom();
		startSpray();
	};

	const stopCleaning = () => {
		state.cleaning = false;
		game.map.eventVars["cleanmode"] = 0;
		stopSpray();
		if (state.flotom) {
			state.flotom.remove();
			state.flotom = null;
		}
	};

	const openMenu = () => {
		const label = state.cleaning ? "Stop Cleaning" : "Cleaning Mode";
		context({ presetX: window.innerWidth / 2, presetY: window.innerHeight / 2 }, [
			[label, () => state.cleaning ? stopCleaning() : startCleaning()]
		]);
	};

	if (!game.player.cleanKeysHooked) {
		game.player.cleanKeysHooked = true;

		const originalLocalKeys = game.player.localKeys.bind(game.player);
		game.player.localKeys = function(moving) {
			if (game.input.keyPressed("action") && !CONTEXT_MENU.current) {
				const ally = getCleanAlly();
				if (ally) {
					const front = tileAhead(game.player.x, game.player.y, game.player.direction);
					if (ally.x === front[0] && ally.y === front[1]) {
						openMenu();
						return;
					}
				}
			}

			originalLocalKeys(moving);
		};
	}

	if (!game.map.functions.cleanStepHooked) {
		game.map.functions.cleanStepHooked = true;

		// keep leading flotom present after a map change
		if (state.cleaning && !state.flotom) spawnFlotom();

		const prevOnStep = game.map.functions.onStep;
		game.map.functions.onStep = obj => {
			if (prevOnStep) prevOnStep(obj);
			if (!state.cleaning || !state.flotom || obj !== game.player) return;

			const front = tileAhead(game.player.x, game.player.y, game.player.direction);
			state.flotom.moveTo(front[0], front[1], game.player.direction + 1, 1);
		};
	}
})(game)
