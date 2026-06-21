(
game => {
	if (!game.map) return;
	if (!game.map.width || !game.map.height) return;

	const TILE_SIZE = 16;
	const PASSAGE_SIZE = 3;
	const WALL_SIZE = 5;
	const ORIGIN_X = 0;
	const ORIGIN_Y = 0;
	const TILESET_NAME = "091pgtm0";
	const EXIT_MAP = "08t5fzij";
	const FLOOR_AUTOTILE_X = 16;
	const FLOOR_AUTOTILE_Y = 2256;
	const WALL_AUTOTILE_X = 16;
	const WALL_AUTOTILE_Y = 2208;
	const WALL_CORNER_BL_X = 96;
	const WALL_CORNER_BL_Y = 2224;
	const WALL_CORNER_BR_X = 112;
	const WALL_CORNER_BR_Y = 2224;
	const BOTTOM_CORNER_L_X = 112;
	const BOTTOM_CORNER_L_Y = 2240;
	const BOTTOM_CORNER_R_X = 96;
	const BOTTOM_CORNER_R_Y = 2240;
	const VOID_BLOCK_X = 64;
	const VOID_BLOCK_Y = 2288;
	const INNER_TL_X = 128;
	const INNER_TL_Y = 2304;
	const INNER_TR_X = 112;
	const INNER_TR_Y = 2304;
	const INNER_BL_X = 128;
	const INNER_BL_Y = 2288;
	const INNER_BR_X = 112;
	const INNER_BR_Y = 2288;
	const DOOR_A_X = 176;
	const DOOR_A_Y = 2384;
	const DOOR_B_X = 176;
	const DOOR_B_Y = 2384;

	let seed = game.map.eventVars["MazeSeed"] || 0;
	if (!seed) {
		seed = (Math.random() * 0xFFFFFFFF >>> 0) || 1;
		game.trigger("ev[MazeSeed]=" + seed);
	}

	if (typeof game.map.eventVars["LabRunProgress"] === "undefined") {
		game.trigger("ev[LabRunProgress]=0");
	}

	const mapTilesW = Math.floor(game.map.width / TILE_SIZE) - ORIGIN_X;
	const mapTilesH = Math.floor(game.map.height / TILE_SIZE) - ORIGIN_Y;
	const period = PASSAGE_SIZE + WALL_SIZE;
	const CELLS_W = Math.floor((mapTilesW - WALL_SIZE) / period);
	const CELLS_H = Math.floor((mapTilesH - WALL_SIZE) / period);

	if (CELLS_W < 1 || CELLS_H < 1) return;

	if (!game.__mazeFadePatched) {
		game.__mazeFadePatched = true;
		const origFade = game.fade;
		game.fade = function(opacity, color, cb) {
			if (opacity === 0 && game.__mazeFadeHold) {
				console.log("[MAZE] fade-in suppressed (hold active)");
				return;
			}
			return origFade.call(this, opacity, color, cb);
		};
	}
	game.__mazeFadeHold = true;
	game.fade(1, "#000");
	console.log("[MAZE] inject start | render=" + game.render + " | id=" + game.map.id + " | cachedid=" + game.map.__cachedid + " | player=" + game.player.x + "," + game.player.y);

	const revealMaze = () => {
		if (!game.render) {
			setTimeout(revealMaze, 50);
			return;
		}
		console.log("[MAZE] reveal | render=" + game.render + " | fading in");
		game.__mazeFadeHold = false;
		game.fade(0);
	};

	let rngState = seed >>> 0;
	const nextRandom = () => {
		rngState = (rngState + 0x6D2B79F5) | 0;
		let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	const gridWidth = CELLS_W * 2 + 1;
	const gridHeight = CELLS_H * 2 + 1;

	const open = [];
	for (let gy = 0; gy < gridHeight; ++gy) {
		open.push(new Array(gridWidth).fill(false));
	}

	const mazeVar = (name, defaultValue) => {
		const value = game.map.getVar ? +game.map.getVar(name, defaultValue) : defaultValue;
		return isNaN(value) ? defaultValue : value;
	};

	const MAZE_DEFAULTS = {
		MazeIntensity: 65,
		MazeBaseChaos: 12,
		MazeMaxWidth: 7,
		MazeEncounterSpacing: 1,
		MazeDifficulty: 6,
		MazeItemChance: 35,
		MazeRoomDensity: 15,
		MazeLevelMin: 5,
		MazeLevelMax: 10,
		MazeLevelStep: 3,
		autoevolve_all: 1,
		overworld_encounters_max_mons: 5,
		encounter_chance: 5
	};

	game.map.mapVars = game.map.mapVars || {};
	for (const name in MAZE_DEFAULTS) {
		if (typeof game.map.mapVars[name] === "undefined") game.map.mapVars[name] = MAZE_DEFAULTS[name];
		console.log("mapvar[" + name + "] = " + MAZE_DEFAULTS[name]);
	}

	const LAB_PROGRESS = mazeVar("LabRunProgress", 0);
	const INTENSITY = Math.min(100, mazeVar("MazeIntensity", MAZE_DEFAULTS.MazeIntensity) + LAB_PROGRESS * 10) / 100;
	const BASE_CHAOS = Math.min(100, mazeVar("MazeBaseChaos", MAZE_DEFAULTS.MazeBaseChaos) + LAB_PROGRESS * 5) / 100;
	const MAX_PASSAGE_WIDTH = mazeVar("MazeMaxWidth", MAZE_DEFAULTS.MazeMaxWidth);
	const PASSAGE_WIDTHS = [3, 3];
	for (let width = 5; width <= MAX_PASSAGE_WIDTH; width += 2) PASSAGE_WIDTHS.push(width);

	const cellKey = (cx, cy) => cy * CELLS_W + cx;
	const inCellBounds = (cx, cy) => cx >= 0 && cx < CELLS_W && cy >= 0 && cy < CELLS_H;
	const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

	const centerCount = Math.max(1, Math.round(CELLS_W * CELLS_H / 40));
	const chaosRadius = Math.max(2, Math.round(Math.min(CELLS_W, CELLS_H) / 3));
	const chaosCenters = [];
	for (let c = 0; c < centerCount; ++c) {
		chaosCenters.push([Math.floor(nextRandom() * CELLS_W), Math.floor(nextRandom() * CELLS_H), 0.8 + nextRandom() * 0.2]);
	}

	const chaosAt = (cx, cy) => {
		let peak = 0;
		for (const center of chaosCenters) {
			const distX = cx - center[0];
			const distY = cy - center[1];
			const dist = Math.sqrt(distX * distX + distY * distY);
			const falloff = Math.max(0, 1 - dist / chaosRadius) * center[2];
			if (falloff > peak) peak = falloff;
		}
		return Math.min(1, BASE_CHAOS + peak * INTENSITY);
	};

	const visited = new Set();
	const active = [[0, 0]];
	visited.add(cellKey(0, 0));
	open[1][1] = true;

	while (active.length) {
		const frontier = active[active.length - 1];
		const useRandom = nextRandom() < chaosAt(frontier[0], frontier[1]);
		const idx = useRandom ? Math.floor(nextRandom() * active.length) : active.length - 1;
		const cx = active[idx][0];
		const cy = active[idx][1];

		const options = [];
		for (const dir of DIRS) {
			const nx = cx + dir[0];
			const ny = cy + dir[1];
			if (inCellBounds(nx, ny) && !visited.has(cellKey(nx, ny))) {
				options.push([nx, ny, dir[0], dir[1]]);
			}
		}

		if (!options.length) {
			active.splice(idx, 1);
			continue;
		}

		const choice = options[Math.floor(nextRandom() * options.length)];
		const nx = choice[0];
		const ny = choice[1];

		open[cy * 2 + 1 + choice[3]][cx * 2 + 1 + choice[2]] = true;
		open[ny * 2 + 1][nx * 2 + 1] = true;

		visited.add(cellKey(nx, ny));
		active.push([nx, ny]);
	}

	const roomedCells = new Set();
	const carveRoom = (rx0, ry0, rw, rh) => {
		for (let cy = ry0; cy <= ry0 + rh; ++cy) {
			for (let cx = rx0; cx <= rx0 + rw; ++cx) {
				if (cx < 0 || cy < 0 || cx >= CELLS_W || cy >= CELLS_H) continue;
				roomedCells.add(cellKey(cx, cy));
				open[cy * 2 + 1][cx * 2 + 1] = true;
				if (cx < rx0 + rw && cx + 1 < CELLS_W) open[cy * 2 + 1][cx * 2 + 2] = true;
				if (cy < ry0 + rh && cy + 1 < CELLS_H) open[cy * 2 + 2][cx * 2 + 1] = true;
			}
		}
	};

	const roomCellBudget = Math.round(CELLS_W * CELLS_H * mazeVar("MazeRoomDensity", MAZE_DEFAULTS.MazeRoomDensity) / 100);
	const roomAttempts = centerCount * 4;
	for (let a = 0; a < roomAttempts; ++a) {
		if (roomedCells.size >= roomCellBudget) break;
		const roomX = Math.floor(nextRandom() * CELLS_W);
		const roomY = Math.floor(nextRandom() * CELLS_H);
		if (chaosAt(roomX, roomY) < 0.45) continue;

		const roomW = 1 + Math.floor(nextRandom() * 3);
		const roomH = 1 + Math.floor(nextRandom() * 3);
		carveRoom(roomX, roomY, roomW, roomH);

		if (nextRandom() < 0.6) {
			const offX = roomX + Math.floor(nextRandom() * (roomW + 1));
			const offY = roomY + Math.floor(nextRandom() * (roomH + 1));
			carveRoom(offX, offY, 1 + Math.floor(nextRandom() * 2), 1 + Math.floor(nextRandom() * 2));
		}
	}

	for (let cy = 0; cy < CELLS_H; ++cy) {
		for (let cx = 0; cx < CELLS_W; ++cx) {
			let degree = 0;
			const closedDirs = [];
			for (const dir of DIRS) {
				const wallGy = cy * 2 + 1 + dir[1];
				const wallGx = cx * 2 + 1 + dir[0];
				if (open[wallGy][wallGx]) {
					++degree;
				} else if (inCellBounds(cx + dir[0], cy + dir[1])) {
					closedDirs.push(dir);
				}
			}
			if (degree <= 1 && closedDirs.length && nextRandom() < chaosAt(cx, cy) * 0.8) {
				const dir = closedDirs[Math.floor(nextRandom() * closedDirs.length)];
				open[cy * 2 + 1 + dir[1]][cx * 2 + 1 + dir[0]] = true;
			}
		}
	}

	const buildSpans = (cellCount) => {
		const gridSize = cellCount * 2 + 1;
		const spans = [];
		for (let g = 0; g < gridSize; ++g) {
			if (g % 2 === 1) {
				spans.push(PASSAGE_WIDTHS[Math.floor(nextRandom() * PASSAGE_WIDTHS.length)]);
			} else {
				spans.push(WALL_SIZE);
			}
		}
		return spans;
	};

	const fitSpans = (spans, maxTiles) => {
		let total = 0;
		for (const span of spans) total += span;
		for (let g = 1; g < spans.length && total > maxTiles; g += 2) {
			if (spans[g] > PASSAGE_SIZE) {
				total -= spans[g] - PASSAGE_SIZE;
				spans[g] = PASSAGE_SIZE;
			}
		}
	};

	const expandLogical = (spans) => {
		const logical = [];
		for (let g = 0; g < spans.length; ++g) {
			for (let s = 0; s < spans[g]; ++s) logical.push(g);
		}
		return logical;
	};

	const colSpan = buildSpans(CELLS_W);
	const rowSpan = buildSpans(CELLS_H);
	fitSpans(colSpan, mapTilesW);
	fitSpans(rowSpan, mapTilesH);

	const colLogical = expandLogical(colSpan);
	const rowLogical = expandLogical(rowSpan);
	const realCols = colLogical.length;
	const realRows = rowLogical.length;

	const isFloor = (rx, ry) => {
		if (rx < 0 || ry < 0 || rx >= realCols || ry >= realRows) return false;
		return open[rowLogical[ry]][colLogical[rx]];
	};

	const isFace = (rx, ry) => {
		if (rx < 0 || ry < 0 || rx >= realCols || ry >= realRows) return false;
		if (isFloor(rx, ry)) return false;
		return isFloor(rx - 1, ry) || isFloor(rx + 1, ry) || isFloor(rx, ry - 1) || isFloor(rx, ry + 1);
	};

	for (let ry = 0; ry < realRows; ++ry) {
		for (let rx = 0; rx < realCols; ++rx) {
			if (!isFloor(rx, ry)) {
				game.map.addObject(0, (ORIGIN_X + rx) * TILE_SIZE, (ORIGIN_Y + ry) * TILE_SIZE);
			}
		}
	}

	const buildCenters = (logicalArr) => {
		const centers = {};
		let runStart = 0;
		for (let r = 1; r <= logicalArr.length; ++r) {
			if (r === logicalArr.length || logicalArr[r] !== logicalArr[r - 1]) {
				centers[logicalArr[r - 1]] = Math.floor((runStart + r - 1) / 2);
				runStart = r;
			}
		}
		return centers;
	};
	const colCenter = buildCenters(colLogical);
	const rowCenter = buildCenters(rowLogical);

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

		for (let cy = 0; cy < CELLS_H; ++cy) {
			for (let cx = 0; cx < CELLS_W; ++cx) {
				let degree = 0;
				for (const dir of DIRS) {
					if (open[cy * 2 + 1 + dir[1]][cx * 2 + 1 + dir[0]]) ++degree;
				}
				if (degree !== 1) continue;
				if (nextRandom() * 100 >= ITEM_CHANCE) continue;

				let roll = nextRandom() * totalItemWeight;
				let acc = 0;
				let chosen = eligibleItems[eligibleItems.length - 1];
				for (const it of eligibleItems) {
					acc += it.baseChance;
					if (roll < acc) { chosen = it; break; }
				}

				const itemX = colCenter[cx * 2 + 1];
				const itemY = rowCenter[cy * 2 + 1];
				game.map.addObject(14, (ORIGIN_X + itemX) * TILE_SIZE, (ORIGIN_Y + itemY) * TILE_SIZE, [chosen.uid, 1]);
			}
		}
	}

	const ENCOUNTER_LIST = "encounters";
	const ENCOUNTER_SPACING = Math.max(1, mazeVar("MazeEncounterSpacing", MAZE_DEFAULTS.MazeEncounterSpacing));
	const keepChance = 1 / (ENCOUNTER_SPACING * ENCOUNTER_SPACING);

	if (typeof game.map.__mazeBaseEncounters === "undefined") {
		game.map.__mazeBaseEncounters = (game.map.overworldEncounters || []).slice();
	}

	const overworldPoints = game.map.__mazeBaseEncounters.slice();
	for (let ry = 0; ry < realRows; ++ry) {
		for (let rx = 0; rx < realCols; ++rx) {
			if (isFloor(rx, ry) && (ENCOUNTER_SPACING <= 1 || nextRandom() < keepChance)) {
				overworldPoints.push([(ORIGIN_X + rx) * TILE_SIZE, (ORIGIN_Y + ry) * TILE_SIZE, ENCOUNTER_LIST]);
			}
		}
	}
	game.map.overworldEncounters = overworldPoints;

	const doorCandidates = [];
	for (let ry = 2; ry < realRows - 2; ++ry) {
		for (let rx = 2; rx < realCols - 2; ++rx) {
			if (!isFloor(rx, ry) && isFloor(rx, ry + 1) && !isFloor(rx - 1, ry) && !isFloor(rx + 1, ry)) {
				doorCandidates.push([rx, ry]);
			}
		}
	}

	let pointA = null;
	let pointB = null;
	if (doorCandidates.length >= 2) {
		pointA = doorCandidates[Math.floor(nextRandom() * doorCandidates.length)];

		const diag = Math.sqrt(realCols * realCols + realRows * realRows);
		const minDist = diag * 0.45;
		const maxDist = diag * 0.9;
		const inBand = [];
		let farthest = null;
		let farthestDist = -1;
		for (const candidate of doorCandidates) {
			if (candidate === pointA) continue;
			const dx = candidate[0] - pointA[0];
			const dy = candidate[1] - pointA[1];
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > farthestDist) {
				farthestDist = dist;
				farthest = candidate;
			}
			if (dist >= minDist && dist <= maxDist) inBand.push(candidate);
		}
		pointB = inBand.length ? inBand[Math.floor(nextRandom() * inBand.length)] : farthest;
	}

	if (pointA) {
		const spawnX = (ORIGIN_X + pointA[0]) * TILE_SIZE;
		const spawnY = (ORIGIN_Y + pointA[1] + 1) * TILE_SIZE;
		game.map.spawns = game.map.spawns || {};
		game.map.spawns[0] = [spawnX, spawnY, 1];
		if (game.render) {
			game.player.setPosition(spawnX, spawnY);
		}
		console.log("[MAZE] spawnA set | spawns[0]=" + JSON.stringify(game.map.spawns[0]) + " | candidates=" + doorCandidates.length + " | render=" + game.render + " | player=" + game.player.x + "," + game.player.y);
	} else {
		console.log("[MAZE] spawnA NOT set | doorCandidates=" + doorCandidates.length);
	}

	if (pointB) {
		const warpX = (ORIGIN_X + pointB[0]) * TILE_SIZE;
		const warpY = (ORIGIN_Y + pointB[1] + 1) * TILE_SIZE;
		const exitMod = LAB_PROGRESS % 6;
		const exitSpawn = exitMod === 2 ? 2 : (exitMod === 5 ? 3 : 1);
		const prevOntile = game.map.ontile;
		game.map.ontile = "any";
		game.map.addObject(7, warpX, warpY, "freeze&rise=spin&ev[LabRunProgress]=+1&ev[MazeSeed]=0&pause=700&warp=" + EXIT_MAP + "," + exitSpawn);
		game.map.ontile = prevOntile;
	}

	const REGION_UID = (typeof REGION !== "undefined" && REGION && REGION.uid) ? REGION.uid : null;
	const AUTO_EVOLVE = mazeVar("autoevolve_all", MAZE_DEFAULTS.autoevolve_all);

	const levelMin = mazeVar("MazeLevelMin", MAZE_DEFAULTS.MazeLevelMin) + LAB_PROGRESS * mazeVar("MazeLevelStep", MAZE_DEFAULTS.MazeLevelStep);
	const levelMax = mazeVar("MazeLevelMax", MAZE_DEFAULTS.MazeLevelMax) + LAB_PROGRESS * mazeVar("MazeLevelStep", MAZE_DEFAULTS.MazeLevelStep);

	const rollEncounterLevel = () => {
		const lo = Math.max(1, Math.min(100, levelMin));
		const hi = Math.max(lo, Math.min(100, levelMax));
		return lo + Math.floor(Math.random() * (hi - lo + 1));
	};

	const LEVEL_TOKENS = ["l", "lv", "level", "levels", "d", "dynamic-level"];
	const setMonLevel = (monStr, level) => {
		const parts = monStr.split(";");
		const kept = [parts[0]];
		for (let p = 1; p < parts.length; ++p) {
			if (LEVEL_TOKENS.indexOf(parts[p].split(" ")[0]) === -1) kept.push(parts[p]);
		}
		kept.push("l " + level);
		return kept.join(";");
	};

	const pickSplitEvo = (candidates) => candidates[Math.floor(Math.random() * candidates.length)];

	const processEvoUid = (uid, level, depth, lastLevelEvoLvl, cb) => {
		if (depth > 5) {
			cb(uid);
			return;
		}
		getMon(uid, monObj => {
			const data = monObj && monObj.data;
			if (!data || !data.evolutions || !data.evolutions.length) {
				cb(uid);
				return;
			}

			const levelCandidates = data.evolutions.filter(evo => evo[1] === 0 && level >= +evo[2] && (!evo[3] || evo[3] === REGION_UID));
			const nonLevelCandidates = data.evolutions.filter(evo => evo[1] !== 35 && evo[1] !== 0 && (!evo[3] || evo[3] === REGION_UID));

			let evoTarget = null;
			let evoLevel = null;
			let isLevelEvo = false;

			const pickLevel = () => {
				if (levelCandidates.length) {
					const picked = pickSplitEvo(levelCandidates);
					evoTarget = picked[0];
					evoLevel = +picked[2];
					isLevelEvo = true;
				}
			};

			const pickNonLevel = () => {
				if (nonLevelCandidates.length === 1) {
					evoTarget = nonLevelCandidates[0][0];
				} else if (nonLevelCandidates.length > 1) {
					const methodGroups = {};
					for (const evo of nonLevelCandidates) {
						if (!methodGroups[evo[1]]) methodGroups[evo[1]] = [];
						methodGroups[evo[1]].push(evo);
					}
					const splitGroup = Object.values(methodGroups).find(g => g.length > 1);
					evoTarget = pickSplitEvo(splitGroup || nonLevelCandidates)[0];
				}
			};

			if (AUTO_EVOLVE === 3) {
				const allCandidates = levelCandidates.concat(nonLevelCandidates);
				if (allCandidates.length) {
					const picked = pickSplitEvo(allCandidates);
					evoTarget = picked[0];
					if (picked[1] === 0) {
						evoLevel = +picked[2];
						isLevelEvo = true;
					}
				}
			} else if (AUTO_EVOLVE === 4) {
				pickLevel();
			} else if (AUTO_EVOLVE === 2) {
				pickNonLevel();
				if (!evoTarget) pickLevel();
			} else {
				pickLevel();
				if (!evoTarget && nonLevelCandidates.length) evoTarget = nonLevelCandidates[0][0];
			}

			if (!evoTarget) {
				cb(uid);
				return;
			}

			getMon(evoTarget, evolved => {
				if (!evolved || !evolved.data) {
					cb(uid);
					return;
				}

				if (!isLevelEvo) {
					if (lastLevelEvoLvl !== null) {
						evoLevel = lastLevelEvoLvl + 20;
					} else {
						const hasNextEvo = evolved.data.evolutions && evolved.data.evolutions.length > 0;
						evoLevel = depth >= 1 ? 38 : (hasNextEvo ? 20 : 31);
					}
				}

				if (level < evoLevel) {
					cb(uid);
					return;
				}

				processEvoUid(evoTarget, level, depth + 1, isLevelEvo ? evoLevel : lastLevelEvoLvl, cb);
			});
		});
	};

	if (!game.map.__mazeEvoSkin && typeof getMon === "function") {
		game.map.__mazeEvoSkin = true;
		const origAddOverworldMon = game.map.addOverworldMon;
		if (typeof origAddOverworldMon === "function") {
			game.map.addOverworldMon = function(attr, mon, battleAttr) {
				const self = this;
				if (battleAttr && battleAttr.length >= 4) {
					battleAttr[3] = (battleAttr[3] ? battleAttr[3] + ";" : "") + "nocatch;norun";
				}
				const level = rollEncounterLevel();
				const leveledMon = setMonLevel(mon, level);
				const baseUid = leveledMon.split(";")[0];
				processEvoUid(baseUid, level, 0, null, evolvedUid => {
					let finalMon = leveledMon;
					if (evolvedUid && evolvedUid !== baseUid) {
						const parts = leveledMon.split(";");
						parts[0] = evolvedUid;
						finalMon = parts.join(";");
					}
					origAddOverworldMon.call(self, attr, finalMon, battleAttr);
				});
			};
		}
	}

	if (!game.map.reset.__mazeWrapped) {
		const origReset = game.map.reset;
		const wrappedReset = function() {
			if (this.__mazeOverlay) {
				if (this.__mazeOverlay.parent) this.__mazeOverlay.parent.removeChild(this.__mazeOverlay);
				this.__mazeOverlay.destroy({ children: true, texture: true, baseTexture: true });
				this.__mazeOverlay = null;
			}
			return origReset.apply(this, arguments);
		};
		wrappedReset.__mazeWrapped = true;
		game.map.reset = wrappedReset;
	}

	if (game.map.__mazeOverlay && game.map.__mazeOverlay.parent) {
		game.map.__mazeOverlay.parent.removeChild(game.map.__mazeOverlay);
	}

	const tilesetUrl = CDN_BASE + "images/tilesets/" + TILESET_NAME + ".webp?t=" + getCache(TILESET_NAME);

	const drawOverlay = (image) => {
		const canvas = document.createElement("canvas");
		canvas.width = realCols * TILE_SIZE;
		canvas.height = realRows * TILE_SIZE;
		const ctx = canvas.getContext("2d");

		const convexCorners = [];
		const bottomCorners = [];

		for (let ry = 0; ry < realRows; ++ry) {
			for (let rx = 0; rx < realCols; ++rx) {
				const dx = rx * TILE_SIZE;
				const dy = ry * TILE_SIZE;

				if (isFloor(rx, ry)) {
					const col = !isFloor(rx - 1, ry) ? 0 : (!isFloor(rx + 1, ry) ? 2 : 1);
					const row = !isFloor(rx, ry - 1) ? 0 : (!isFloor(rx, ry + 1) ? 2 : 1);
					ctx.drawImage(image, FLOOR_AUTOTILE_X + col * TILE_SIZE, FLOOR_AUTOTILE_Y + row * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				} else {
					const floorLeft = isFloor(rx - 1, ry);
					const floorRight = isFloor(rx + 1, ry);
					const floorUp = isFloor(rx, ry - 1);
					const floorDown = isFloor(rx, ry + 1);

					if (!floorLeft && !floorRight && !floorUp && !floorDown) {
						const faceLeft = isFace(rx - 1, ry);
						const faceRight = isFace(rx + 1, ry);
						const faceUp = isFace(rx, ry - 1);
						const faceDown = isFace(rx, ry + 1);

						if (faceDown && faceRight && isFloor(rx + 1, ry + 1)) {
							convexCorners.push([dx, dy, true]);
						} else if (faceDown && faceLeft && isFloor(rx - 1, ry + 1)) {
							convexCorners.push([dx, dy, false]);
						} else if (faceUp && faceRight && isFloor(rx + 1, ry - 1)) {
							bottomCorners.push([dx, dy, true]);
						} else if (faceUp && faceLeft && isFloor(rx - 1, ry - 1)) {
							bottomCorners.push([dx, dy, false]);
						} else {
							const col = faceLeft ? 2 : (faceRight ? 0 : 1);
							const row = faceUp ? 2 : (faceDown ? 0 : 1);
							if (col === 2 && row === 2) {
								ctx.drawImage(image, INNER_TL_X, INNER_TL_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
							} else if (col === 0 && row === 2) {
								ctx.drawImage(image, INNER_TR_X, INNER_TR_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
							} else if (col === 2 && row === 0) {
								ctx.drawImage(image, INNER_BL_X, INNER_BL_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
							} else if (col === 0 && row === 0) {
								ctx.drawImage(image, INNER_BR_X, INNER_BR_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
							} else {
								ctx.drawImage(image, VOID_BLOCK_X + col * TILE_SIZE, VOID_BLOCK_Y + row * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
							}
						}
					} else {
						const col = floorLeft ? 0 : (floorRight ? 2 : 1);
						const row = floorUp ? 0 : (floorDown ? 2 : 1);
						ctx.drawImage(image, WALL_AUTOTILE_X + col * TILE_SIZE, WALL_AUTOTILE_Y + row * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
					}
				}
			}
		}

		for (const corner of convexCorners) {
			const dx = corner[0];
			const dy = corner[1];
			const isRight = corner[2];

			ctx.drawImage(image, VOID_BLOCK_X + TILE_SIZE, VOID_BLOCK_Y, TILE_SIZE, TILE_SIZE, dx, dy - TILE_SIZE, TILE_SIZE, TILE_SIZE);

			if (isRight) {
				ctx.drawImage(image, WALL_CORNER_BR_X, WALL_CORNER_BR_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X, VOID_BLOCK_Y, TILE_SIZE, TILE_SIZE, dx - TILE_SIZE, dy - TILE_SIZE, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X, VOID_BLOCK_Y + TILE_SIZE, TILE_SIZE, TILE_SIZE, dx - TILE_SIZE, dy, TILE_SIZE, TILE_SIZE);
			} else {
				ctx.drawImage(image, WALL_CORNER_BL_X, WALL_CORNER_BL_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X + 2 * TILE_SIZE, VOID_BLOCK_Y, TILE_SIZE, TILE_SIZE, dx + TILE_SIZE, dy - TILE_SIZE, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X + 2 * TILE_SIZE, VOID_BLOCK_Y + TILE_SIZE, TILE_SIZE, TILE_SIZE, dx + TILE_SIZE, dy, TILE_SIZE, TILE_SIZE);
			}
		}

		for (const corner of bottomCorners) {
			const dx = corner[0];
			const dy = corner[1];
			const isRight = corner[2];

			ctx.drawImage(image, VOID_BLOCK_X + TILE_SIZE, VOID_BLOCK_Y + 2 * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy + TILE_SIZE, TILE_SIZE, TILE_SIZE);

			if (isRight) {
				ctx.drawImage(image, BOTTOM_CORNER_L_X, BOTTOM_CORNER_L_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X, VOID_BLOCK_Y + 2 * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx - TILE_SIZE, dy + TILE_SIZE, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X, VOID_BLOCK_Y + TILE_SIZE, TILE_SIZE, TILE_SIZE, dx - TILE_SIZE, dy, TILE_SIZE, TILE_SIZE);
			} else {
				ctx.drawImage(image, BOTTOM_CORNER_R_X, BOTTOM_CORNER_R_Y, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X + 2 * TILE_SIZE, VOID_BLOCK_Y + 2 * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx + TILE_SIZE, dy + TILE_SIZE, TILE_SIZE, TILE_SIZE);
				ctx.drawImage(image, VOID_BLOCK_X + 2 * TILE_SIZE, VOID_BLOCK_Y + TILE_SIZE, TILE_SIZE, TILE_SIZE, dx + TILE_SIZE, dy, TILE_SIZE, TILE_SIZE);
			}
		}

		const drawDoor = (point, srcX, srcY, tint) => {
			if (!point) return;
			const baseX = (point[0] - 1) * TILE_SIZE;
			const baseY = (point[1] - 1) * TILE_SIZE;
			for (let r = 0; r < 3; ++r) {
				for (let c = 0; c < 3; ++c) {
					ctx.drawImage(image, srcX + c * TILE_SIZE, srcY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE, baseX + c * TILE_SIZE, baseY + r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
				}
			}
			if (tint) {
				ctx.globalCompositeOperation = "source-atop";
				ctx.fillStyle = tint;
				ctx.fillRect(baseX, baseY, 3 * TILE_SIZE, 3 * TILE_SIZE);
				ctx.globalCompositeOperation = "source-over";
			}
		};
		drawDoor(pointA, DOOR_A_X, DOOR_A_Y, null);
		drawDoor(pointB, DOOR_B_X, DOOR_B_Y, "rgba(220,40,40,0.55)");

		const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
		sprite.position.x = ORIGIN_X * TILE_SIZE;
		sprite.position.y = ORIGIN_Y * TILE_SIZE;
		sprite.depth = -99999;

		game.containers.bottomSprites.addChild(sprite);
		game.map.__mazeOverlay = sprite;

		revealMaze();
	};

	const loaded = game.assets.get(tilesetUrl);
	if (loaded) {
		drawOverlay(loaded);
	} else {
		game.assets.add(tilesetUrl).load(() => {
			const image = game.assets.get(tilesetUrl);
			if (image) drawOverlay(image);
			else revealMaze();
		});
	}
}
)(game);
