(game => {
	if (!game.map || !game.player) return;

	const CLEAN_MON = "00zw418h";
	const FLOTOM_UID = "flotom";
	const WATERSPRAY_1 = "https://dl.dropboxusercontent.com/scl/fi/ic8z5es3s55p5v7g1w0dk/Waterspray1.ogg?rlkey=hddsmf1779vhmkhx7hhssfo2h&dl=1";
	const WATERSPRAY_2 = "https://dl.dropboxusercontent.com/scl/fi/ljsoxpe4lvr1nxm5j5q71/Waterspray2.ogg?rlkey=hku5lng0h72c515o9lqfqrm87&dl=1";
	const TILE_SIZE = 16;
	const FLOAT_HEIGHT = 16;
	const HOLD_DURATION = 4000;
	const DESCENT_DURATION = 1000;
	const FLOAT_COOLDOWN = 1000;

	const state = game.player.cleanState || (game.player.cleanState = {
		mode: null,
		flotom: null,
		cleanAlly: null,
		spray1: null,
		spray2: null,
		sprayOn: false,
		floatEngaged: false,
		floatDeadline: 0,
		floatStartTime: 0,
		descending: false,
		descentStart: 0,
		descentHover: 0,
		awaitingLand: false,
		cooldownUntil: 0,
		jumpBlocked: false,
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

	// samples the baked foreground canvas for any visible pixels in the given map-space rect
	const hasForegroundPixels = (x, y, w, h) => {
		if (!game.map.tilemaps.foreground.length) return false;

		const pixels = game.map.ctx.foreground.getImageData(x, y, w, h).data;
		for (let i = 3; i < pixels.length; i += 4) {
			if (pixels[i]) return true;
		}
		return false;
	};

	// true when the raised sprite overlaps foreground above it but none sits on its own row (perspective stays intact)
	const isOverlappingForegroundAbove = obj => {
		const tileX = Math.round((obj.x - game.map.offset.x) / TILE_SIZE) * TILE_SIZE;
		const tileY = Math.round((obj.y - game.map.offset.y) / TILE_SIZE) * TILE_SIZE;
		const cacheKey = tileX + "," + tileY;

		if (obj.foreCacheKey !== cacheKey) {
			obj.foreCacheKey = cacheKey;
			obj.foreCacheValue = hasForegroundPixels(tileX, tileY - 2 * TILE_SIZE, TILE_SIZE, 2 * TILE_SIZE) &&
				!hasForegroundPixels(tileX, tileY, TILE_SIZE, TILE_SIZE);
		}
		return obj.foreCacheValue;
	};

	const setForeLevel = (obj, fore) => {
		const target = fore ? game.containers.topSprites : obj.parent;
		if (obj.sprite.parent && obj.sprite.parent !== target) {
			target.addChild(obj.sprite);
			game.objects.needsSorting[target.name] = true;
		}
	};

	// getVar reads eventVars, then mapVars, then globalVars, so zero it wherever it lives
	const clearFloatingModeVar = () => {
		if (typeof game.map.eventVars["floatingmode"] !== "undefined") game.map.eventVars["floatingmode"] = 0;
		if (typeof game.map.mapVars["floatingmode"] !== "undefined") game.map.mapVars["floatingmode"] = 0;
		game.map.globalVars["floatingmode"] = 0;
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
		state.floatStartTime = Date.now();
		state.prevNoJumping = game.map.noJumping;
		game.map.noJumping = true;
		game.map.globalVars["cleanmode"] = 1;
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
		state.awaitingLand = true;
		game.map.noJumping = state.prevNoJumping;
		game.map.globalVars["cleanmode"] = 0;
		game.player.floating = 0;
		game.player.floatingHeight = 0;
		game.client.relay([39, 0]);

		setForeLevel(game.player, false);

		if (state.flotom) {
			state.flotom.floating = 0;
			state.flotom.floatingHeight = 0;
			state.flotom.destroySplash();
			setForeLevel(state.flotom, false);
		}

		stopSpray();
	};

	const startMode = mode => {
		state.mode = mode;
		state.cleanAlly = getCleanAlly();
		if (state.cleanAlly) state.cleanAlly.setOpacity(0);
		spawnFlotom();

		if (mode === "cleaning") {
			game.map.globalVars["cleanmode"] = 1;
			startSpray();
		}
	};

	const stopMode = () => {
		if (state.floatEngaged) disengageFloat();
		if (state.jumpBlocked) {
			state.jumpBlocked = false;
			game.map.noJumping = state.prevNoJumping;
		}
		state.descending = false;
		state.awaitingLand = false;
		state.mode = null;
		game.map.globalVars["cleanmode"] = 0;
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
		if (state.mode === "cleaning") {
			game.textbox.say("What would you like to do?");
			game.textbox.answers([
				["Stop Cleaning", () => stopMode()],
				["Nevermind", () => {}]
			]);
			return;
		}

		game.textbox.say("What would you like to do?");
		game.textbox.answers([
			["Cleaning Mode", () => startMode("cleaning")],
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
				const coolingDown = state.descending || Date.now() < state.cooldownUntil;
				const canEngage = !state.floatEngaged && !coolingDown;

				// no real jumps while drifting down or cooling down
				if (coolingDown && !state.floatEngaged && !state.jumpBlocked) {
					state.jumpBlocked = true;
					game.map.noJumping = true;
				} else if (!coolingDown && state.jumpBlocked && !state.floatEngaged) {
					state.jumpBlocked = false;
					game.map.noJumping = state.prevNoJumping;
				}

				if (held && canEngage) engageFloat();
				else if (!held && state.floatEngaged) disengageFloat();
			}

			if (game.input.keyPressed("action") && game.textbox.active < 0 && state.mode !== "floating") {
				const front = tileAhead(game.player.x, game.player.y, game.player.direction);
				const facing = state.mode ? state.flotom : getCleanAlly();

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
			if (game.map.loading || game.map.resetting) return;

			// mirror a fully risen float into var[floating_on]
			const fullyFloating = game.player.floating === 2 ? 1 : 0;
			if (game.map.globalVars["floating_on"] !== fullyFloating) game.trigger("var[floating_on]=" + fullyFloating);

			// var[floatingmode]: 1 = on until zeroed, above 1 = seconds until it zeroes itself
			const floatingVar = +game.map.getVar("floatingmode", 0) || 0;
			if (!state.mode && floatingVar >= 1) {
				startMode("floating");
				state.floatDeadline = floatingVar > 1 ? Date.now() + floatingVar * 1000 : 0;
			} else if (state.mode === "floating") {
				const expired = state.floatDeadline && Date.now() >= state.floatDeadline;
				if (expired) clearFloatingModeVar();
				if (expired || !floatingVar) stopMode();
			}

			if (!state.mode) return;

			// recalling the mon turns the mode off
			if (game.player.allyId.indexOf(CLEAN_MON) < 0) {
				stopMode();
				return;
			}

			// map reloads null the uid of string-uid objects, respawn right away
			if (!state.flotom || !state.flotom.uid) spawnFlotom();

			if (state.mode === "floating") {
				// the nozzle only holds for so long, then a gentle drift down
				if (state.floatEngaged && Date.now() - state.floatStartTime >= HOLD_DURATION) {
					state.descentStart = Date.now();
					state.descentHover = game.player.hover;
					disengageFloat();
					state.descending = true;
					state.awaitingLand = false;
				}

				if (state.descending) {
					const progress = (Date.now() - state.descentStart) / DESCENT_DURATION;
					if (progress >= 1) {
						game.player.hover = 0;
						state.descending = false;
						state.cooldownUntil = Date.now() + FLOAT_COOLDOWN;
					} else {
						// engine decay runs first each frame, this overwrite wins for rendering
						game.player.hover = state.descentHover * (1 - progress);
					}
					game.player.setSpritePosition();
					if (state.flotom) state.flotom.hover = game.player.hover;
				} else if (state.awaitingLand && !game.player.hover) {
					state.awaitingLand = false;
					state.cooldownUntil = Date.now() + FLOAT_COOLDOWN;
				}
			}

			// refresh strips sprites without nulling the uid, re-add and rebuild the splash
			if (!state.flotom.nearby) {
				state.flotom.addToMap();
				if (state.mode === "cleaning" || state.floatEngaged) state.flotom.createSplash([0, 0, "1995/rippleanim", 3, 100, 1]);
			}

			const spot = glueTarget();
			state.flotom.x = spot[0];
			state.flotom.y = spot[1];
			state.flotom.setSpritePosition();

			// direct coordinate writes skip the engine's depth recalculation, so mirror it here
			state.flotom.sprite.depth = state.flotom.y - state.flotom.z + state.flotom.offset.y + state.flotom.offset.custom.y - state.flotom.depth;
			state.flotom.sprite.realDepth = state.flotom.sprite.depth | 0;

			if (state.flotom.splash) {
				state.flotom.splash.sprite.depth = state.flotom.sprite.depth + 1;
				state.flotom.splash.sprite.realDepth = state.flotom.sprite.realDepth + 1;
			}

			if (state.flotom.sprite.parent) game.objects.needsSorting[state.flotom.sprite.parent.name] = true;

			if (state.mode === "floating") {
				setForeLevel(game.player, state.floatEngaged && isOverlappingForegroundAbove(game.player));
				setForeLevel(state.flotom, state.floatEngaged && isOverlappingForegroundAbove(state.flotom));
			}

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
