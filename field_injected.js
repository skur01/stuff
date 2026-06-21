(
game => {
	if (!game.map) return;
	if (!game.map.width || !game.map.height) return;

	const TILE_SIZE = 16;
	const ORIGIN_X = 0;
	const ORIGIN_Y = 0;
	const TILESET_NAME = "094m58vi";
	const WALL_TILESET_NAME = "091pgtm0";
	const EXIT_MAP = "08t5fzij";
	const FLOOR_X = 32;
	const FLOOR_Y = 1328;
	const GRASS_X = 32;
	const GRASS_Y = 1328;
	const WALL_X = 32;
	const WALL_Y = 2224;
	const DOOR_A_X = 176;
	const DOOR_A_Y = 2384;
	const DOOR_B_X = 176;
	const DOOR_B_Y = 2384;

	game.map.mapVars = game.map.mapVars || {};

	let seed = game.map.mapVars.MazeSeedActive || 0;
	if (!seed) {
		seed = game.map.eventVars["MazeSeed"] || 0;
		if (!seed) {
			seed = (Math.random() * 0xFFFFFFFF >>> 0) || 1;
			game.trigger("ev[MazeSeed]=" + seed);
		}
		game.map.mapVars.MazeSeedActive = seed;
	}

	if (typeof game.map.eventVars["LabRunProgress"] === "undefined") {
		game.trigger("ev[LabRunProgress]=0");
	}

	const mapTilesW = Math.floor(game.map.width / TILE_SIZE) - ORIGIN_X;
	const mapTilesH = Math.floor(game.map.height / TILE_SIZE) - ORIGIN_Y;

	if (mapTilesW < 8 || mapTilesH < 8) return;

	if (!game.__mazeFadePatched) {
		game.__mazeFadePatched = true;
		const origFade = game.fade;
		game.fade = function(opacity, color, cb) {
			if (opacity === 0 && game.__mazeFadeHold) {
				console.log("[FIELD] fade-in suppressed (hold active)");
				return;
			}
			return origFade.call(this, opacity, color, cb);
		};
	}
	game.__mazeFadeHold = true;
	game.fade(1, "#000");
	console.log("[FIELD] inject start | render=" + game.render + " | id=" + game.map.id + " | cachedid=" + game.map.__cachedid + " | player=" + game.player.x + "," + game.player.y);

	const mazeMapId = game.map.id;

	const revealMaze = () => {
		if (game.map.id !== mazeMapId) return;
		if (!game.render) {
			setTimeout(revealMaze, 50);
			return;
		}
		console.log("[FIELD] reveal | render=" + game.render + " | fading in");
		game.__mazeFadeHold = false;
		game.fade(0);
	};

	if (!game.map.updating) {
		const tick = str => {
			if (!document.hidden) game.trigger(str);
		};
		INTERVAL[0] = setInterval(() => tick("var[simstability]=-1"), 13000);
		INTERVAL[1] = setInterval(() => tick("var[runMinute]=+1"), 60000);
	}

	let rngState = seed >>> 0;
	const nextRandom = () => {
		rngState = (rngState + 0x6D2B79F5) | 0;
		let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const mazeVar = (name, defaultValue) => {
		const value = game.map.getVar ? +game.map.getVar(name, defaultValue) : defaultValue;
		return isNaN(value) ? defaultValue : value;
	};

	const MAZE_DEFAULTS = {
		MazeIntensity: 65,
		MazeBaseChaos: 12,
		FieldObstacleDensity: 14,
		FieldGrassDensity: 18,
		FieldClusterMin: 2,
		FieldClusterMax: 5,
		MazeDifficulty: 6,
		MazeItemChance: 4,
		MazeRoomDensity: 15,
		autoevolve_all: 1,
		overworld_encounters_max_mons: 5,
		encounter_chance: 5
	};

	for (const name in MAZE_DEFAULTS) {
		if (typeof game.map.mapVars[name] === "undefined") game.map.mapVars[name] = MAZE_DEFAULTS[name];
		console.log("mapvar[" + name + "] = " + MAZE_DEFAULTS[name]);
	}

	if (typeof game.map.mapVars.LabProgressActive === "undefined") {
		game.map.mapVars.LabProgressActive = mazeVar("LabRunProgress", 0);
	}
	const LAB_PROGRESS = game.map.mapVars.LabProgressActive;

	const INTENSITY = Math.min(100, mazeVar("MazeIntensity", MAZE_DEFAULTS.MazeIntensity) + LAB_PROGRESS * 10) / 100;
	const OBSTACLE_DENSITY = mazeVar("FieldObstacleDensity", MAZE_DEFAULTS.FieldObstacleDensity) * (1 + INTENSITY) / 100;
	const GRASS_DENSITY = mazeVar("FieldGrassDensity", MAZE_DEFAULTS.FieldGrassDensity) / 100;
	const CLUSTER_MIN = Math.max(1, mazeVar("FieldClusterMin", MAZE_DEFAULTS.FieldClusterMin));
	const CLUSTER_MAX = Math.max(CLUSTER_MIN, mazeVar("FieldClusterMax", MAZE_DEFAULTS.FieldClusterMax));

	const realCols = mapTilesW;
	const realRows = mapTilesH;

	const obstacle = [];
	for (let ry = 0; ry < realRows; ++ry) {
		obstacle.push(new Array(realCols).fill(false));
	}

	const inBounds = (rx, ry) => rx >= 0 && ry >= 0 && rx < realCols && ry < realRows;
	const BORDER = 2;
	const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

	const placeCluster = (cx, cy) => {
		const placed = [];
		const size = CLUSTER_MIN + Math.floor(nextRandom() * (CLUSTER_MAX - CLUSTER_MIN + 1));
		let frontier = [[cx, cy]];
		for (let s = 0; s < size && frontier.length; ++s) {
			const idx = Math.floor(nextRandom() * frontier.length);
			const next = frontier.splice(idx, 1)[0];
			const px = next[0];
			const py = next[1];
			if (!inBounds(px, py) || obstacle[py][px]) continue;
			obstacle[py][px] = true;
			placed.push([px, py]);
			for (const dir of DIRS4) {
				const nx = px + dir[0];
				const ny = py + dir[1];
				if (inBounds(nx, ny) && !obstacle[ny][nx]) frontier.push([nx, ny]);
			}
		}
		return placed;
	};

	const clusterAttempts = Math.round(realCols * realRows * OBSTACLE_DENSITY / ((CLUSTER_MIN + CLUSTER_MAX) / 2));
	const placedClusters = [];
	for (let a = 0; a < clusterAttempts; ++a) {
		const cx = BORDER + Math.floor(nextRandom() * (realCols - BORDER * 2));
		const cy = BORDER + Math.floor(nextRandom() * (realRows - BORDER * 2));
		if (obstacle[cy][cx]) continue;
		placedClusters.push(placeCluster(cx, cy));
	}

	const isWalkable = (rx, ry) => inBounds(rx, ry) && !obstacle[ry][rx];

	const hasPath = (startX, startY, endX, endY) => {
		if (!isWalkable(startX, startY) || !isWalkable(endX, endY)) return false;
		const seen = new Set();
		const key = (x, y) => y * realCols + x;
		const queue = [[startX, startY]];
		seen.add(key(startX, startY));
		while (queue.length) {
			const current = queue.shift();
			const cx = current[0];
			const cy = current[1];
			if (cx === endX && cy === endY) return true;
			for (const dir of DIRS4) {
				const nx = cx + dir[0];
				const ny = cy + dir[1];
				if (isWalkable(nx, ny) && !seen.has(key(nx, ny))) {
					seen.add(key(nx, ny));
					queue.push([nx, ny]);
				}
			}
		}
		return false;
	};

	const spawnRX = BORDER;
	const spawnRY = Math.floor(realRows / 2);
	const exitRX = realCols - 1 - BORDER;
	const exitRY = Math.floor(realRows / 2);

	while (!hasPath(spawnRX, spawnRY, exitRX, exitRY) && placedClusters.length) {
		const offending = placedClusters.pop();
		for (let i = 0; i < offending.length; ++i) {
			obstacle[offending[i][1]][offending[i][0]] = false;
		}
	}

	obstacle[spawnRY][spawnRX] = false;
	obstacle[exitRY][exitRX] = false;

	const grass = [];
	for (let ry = 0; ry < realRows; ++ry) {
		const row = new Array(realCols).fill(false);
		for (let rx = 0; rx < realCols; ++rx) {
			if (!obstacle[ry][rx] && nextRandom() < GRASS_DENSITY) row[rx] = true;
		}
		grass.push(row);
	}

	for (let ry = 0; ry < realRows; ++ry) {
		for (let rx = 0; rx < realCols; ++rx) {
			if (obstacle[ry][rx]) {
				game.map.addObject(0, (ORIGIN_X + rx) * TILE_SIZE, (ORIGIN_Y + ry) * TILE_SIZE);
			}
		}
	}

	const MAZE_DIFFICULTY = mazeVar("MazeDifficulty", MAZE_DEFAULTS.MazeDifficulty) + LAB_PROGRESS;
	const ITEM_CHANCE = mazeVar("MazeItemChance", MAZE_DEFAULTS.MazeItemChance);
	const ITEM_TABLE = [
		{ uid: "06xa6ohm", minDifficulty: 0, baseChance: 60 },
		{ uid: "06nsq383", minDifficulty: 3, baseChance: 30 },
		{ uid: "06jq3b1m", minDifficulty: 6, baseChance: 15 }
	];

	const eligibleItems = ITEM_TABLE.filter(it => MAZE_DIFFICULTY >= it.minDifficulty);
	if (eligibleItems.length) {
		let totalItemWeight = 0;
		for (const it of eligibleItems) totalItemWeight += it.baseChance;

		for (let ry = 0; ry < realRows; ++ry) {
			for (let rx = 0; rx < realCols; ++rx) {
				if (!isWalkable(rx, ry)) continue;
				if (nextRandom() * 100 >= ITEM_CHANCE) continue;

				let roll = nextRandom() * totalItemWeight;
				let acc = 0;
				let chosen = eligibleItems[eligibleItems.length - 1];
				for (const it of eligibleItems) {
					acc += it.baseChance;
					if (roll < acc) { chosen = it; break; }
				}

				game.map.addObject(14, (ORIGIN_X + rx) * TILE_SIZE, (ORIGIN_Y + ry) * TILE_SIZE, [chosen.uid, 1]);
			}
		}
	}

	if (game.map.__mazeGlitches) {
		for (let g = 0; g < game.map.__mazeGlitches.length; ++g) {
			const old = game.objects.get(game.map.__mazeGlitches[g]);
			if (old) old.remove();
		}
	}
	game.map.__mazeGlitches = [];

	const SIM_STABILITY = mazeVar("simstability", 100);
	if (SIM_STABILITY < 50) {
		const glitchImpassable = SIM_STABILITY < 26;
		const glitchChance = glitchImpassable ? 3 : 6;
		const glitchMsg = "It's a glitch. Seems like it's appeared from the simulation degrading. It's completely impasable.";
		let glitchIndex = 0;
		for (let ry = 0; ry < realRows; ++ry) {
			for (let rx = 0; rx < realCols; ++rx) {
				if (!isWalkable(rx, ry)) continue;
				if (nextRandom() * 100 >= glitchChance) continue;
				const uid = "fieldGlitch" + glitchIndex++;
				const px = (ORIGIN_X + rx) * TILE_SIZE;
				const py = (ORIGIN_Y + ry) * TILE_SIZE;
				game.map.addObject(9, px, py, uid, "4543/glitcheffect", "fore", 0, 0, 20, 20, 32, 60, -1);
				game.map.addObject(10, 0, uid, "5x5x5x5");
				game.map.addObject(10, 5, uid, 1);
				if (glitchImpassable) {
					game.map.addObject(1, uid, glitchMsg, "");
				} else {
					game.map.addObject(10, 14, uid, 20);
				}
				game.map.__mazeGlitches.push(uid);
			}
		}
	}

	const spawnX = (ORIGIN_X + spawnRX) * TILE_SIZE;
	const spawnY = (ORIGIN_Y + spawnRY) * TILE_SIZE;
	game.map.spawns = game.map.spawns || {};
	game.map.spawns[0] = [spawnX, spawnY, 1];

	if (!game.map.mapVars.MazeSpawned) {
		game.map.mapVars.MazeSpawned = 1;
		const applySpawn = () => {
			if (game.map.id !== mazeMapId) return;
			if (!game.render) {
				setTimeout(applySpawn, 50);
				return;
			}
			game.player.setPosition(spawnX, spawnY);
		};
		applySpawn();
	}

	const warpX = (ORIGIN_X + exitRX) * TILE_SIZE;
	const warpY = (ORIGIN_Y + exitRY) * TILE_SIZE;
	const exitMod = LAB_PROGRESS % 6;
	const exitSpawn = exitMod === 2 ? 2 : (exitMod === 5 ? 3 : 1);
	const prevOntile = game.map.ontile;
	game.map.ontile = "any";
	game.map.addObject(7, warpX, warpY, "freeze&rise=spin&ev[LabRunProgress]=+1&ev[MazeSeed]=0&pause=700&warp=" + EXIT_MAP + "," + exitSpawn);
	game.map.ontile = prevOntile;

	if (!game.map.reset.__mazeWrapped) {
		const origReset = game.map.reset;
		const wrappedReset = function() {
			if (this.__mazeOverlay) {
				if (this.__mazeOverlay.parent) this.__mazeOverlay.parent.removeChild(this.__mazeOverlay);
				this.__mazeOverlay.destroy({ children: true, texture: true, baseTexture: true });
				this.__mazeOverlay = null;
			}
			this.game.__mazeFadeHold = false;
			return origReset.apply(this, arguments);
		};
		wrappedReset.__mazeWrapped = true;
		game.map.reset = wrappedReset;
	}

	if (game.map.__mazeOverlay && game.map.__mazeOverlay.parent) {
		game.map.__mazeOverlay.parent.removeChild(game.map.__mazeOverlay);
	}

	const tilesetUrl = CDN_BASE + "images/tilesets/" + TILESET_NAME + ".webp?t=" + getCache(TILESET_NAME);
	const wallTilesetUrl = CDN_BASE + "images/tilesets/" + WALL_TILESET_NAME + ".webp?t=" + getCache(WALL_TILESET_NAME);

	const drawOverlay = (image, wallImage) => {
		const canvas = document.createElement("canvas");
		canvas.width = realCols * TILE_SIZE;
		canvas.height = realRows * TILE_SIZE;
		const ctx = canvas.getContext("2d");

		for (let ry = 0; ry < realRows; ++ry) {
			for (let rx = 0; rx < realCols; ++rx) {
				const dx = rx * TILE_SIZE;
				const dy = ry * TILE_SIZE;

				ctx.drawImage(image, FLOOR_X, FLOOR_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);

				if (obstacle[ry][rx]) {
					ctx.drawImage(wallImage, WALL_X, WALL_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				} else if (grass[ry][rx]) {
					ctx.drawImage(image, GRASS_X, GRASS_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				}
			}
		}

		const drawDoor = (rx, ry, srcX, srcY, tint) => {
			const baseX = (rx - 1) * TILE_SIZE;
			const baseY = (ry - 1) * TILE_SIZE;
			for (let r = 0; r < 3; ++r) {
				for (let c = 0; c < 3; ++c) {
					ctx.drawImage(wallImage, srcX + c * TILE_SIZE, srcY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE, baseX + c * TILE_SIZE, baseY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
				}
			}
			if (tint) {
				ctx.globalCompositeOperation = "source-atop";
				ctx.fillStyle = tint;
				ctx.fillRect(baseX, baseY, 3 * TILE_SIZE, 3 * TILE_SIZE);
				ctx.globalCompositeOperation = "source-over";
			}
		};
		drawDoor(spawnRX, spawnRY, DOOR_A_X, DOOR_A_Y, null);
		drawDoor(exitRX, exitRY, DOOR_B_X, DOOR_B_Y, "rgba(220,40,40,0.55)");

		const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
		sprite.position.x = ORIGIN_X * TILE_SIZE;
		sprite.position.y = ORIGIN_Y * TILE_SIZE;
		sprite.depth = -99999;

		game.containers.bottomSprites.addChild(sprite);
		game.map.__mazeOverlay = sprite;

		revealMaze();
	};

	const tryDraw = () => {
		if (game.map.id !== mazeMapId) return;
		const floorImage = game.assets.get(tilesetUrl);
		const wallImage = game.assets.get(wallTilesetUrl);
		if (floorImage && wallImage) drawOverlay(floorImage, wallImage);
	};

	const floorLoaded = game.assets.get(tilesetUrl);
	const wallLoaded = game.assets.get(wallTilesetUrl);
	if (floorLoaded && wallLoaded) {
		drawOverlay(floorLoaded, wallLoaded);
	} else {
		if (!floorLoaded) game.assets.add(tilesetUrl).load(tryDraw);
		if (!wallLoaded) game.assets.add(wallTilesetUrl).load(tryDraw);
		if (floorLoaded || wallLoaded) tryDraw();
	}
}
)(game);
