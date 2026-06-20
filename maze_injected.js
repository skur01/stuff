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

	let seed = game.map.eventVars["MazeSeed"] || 0;
	if (!seed) {
		seed = (Math.random() * 0xFFFFFFFF >>> 0) || 1;
		game.trigger("ev[MazeSeed]=" + seed);
	}

	const mapTilesW = Math.floor(game.map.width / TILE_SIZE) - ORIGIN_X;
	const mapTilesH = Math.floor(game.map.height / TILE_SIZE) - ORIGIN_Y;
	const period = PASSAGE_SIZE + WALL_SIZE;
	const CELLS_W = Math.floor((mapTilesW - WALL_SIZE) / period);
	const CELLS_H = Math.floor((mapTilesH - WALL_SIZE) / period);

	if (CELLS_W < 1 || CELLS_H < 1) return;

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

	const INTENSITY = mazeVar("MazeIntensity", 65) / 100;
	const BASE_CHAOS = mazeVar("MazeBaseChaos", 12) / 100;
	const MAX_PASSAGE_WIDTH = mazeVar("MazeMaxWidth", 7);
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

	const roomAttempts = centerCount * 3;
	for (let a = 0; a < roomAttempts; ++a) {
		const roomX = Math.floor(nextRandom() * CELLS_W);
		const roomY = Math.floor(nextRandom() * CELLS_H);
		if (chaosAt(roomX, roomY) < 0.5) continue;

		const roomW = 1 + Math.floor(nextRandom() * 2);
		const roomH = 1 + Math.floor(nextRandom() * 2);
		if (roomX + roomW >= CELLS_W || roomY + roomH >= CELLS_H) continue;

		for (let cy = roomY; cy <= roomY + roomH; ++cy) {
			for (let cx = roomX; cx <= roomX + roomW; ++cx) {
				open[cy * 2 + 1][cx * 2 + 1] = true;
				if (cx < roomX + roomW) open[cy * 2 + 1][cx * 2 + 2] = true;
				if (cy < roomY + roomH) open[cy * 2 + 2][cx * 2 + 1] = true;
			}
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

	const ENCOUNTER_LIST = "encounters";
	const ENCOUNTER_SPACING = Math.max(1, mazeVar("MazeEncounterSpacing", 2));

	if (typeof game.map.__mazeBaseEncounters === "undefined") {
		game.map.__mazeBaseEncounters = (game.map.overworldEncounters || []).slice();
	}

	const overworldPoints = game.map.__mazeBaseEncounters.slice();
	for (let ry = 0; ry < realRows; ry += ENCOUNTER_SPACING) {
		for (let rx = 0; rx < realCols; rx += ENCOUNTER_SPACING) {
			if (isFloor(rx, ry)) {
				overworldPoints.push([(ORIGIN_X + rx) * TILE_SIZE, (ORIGIN_Y + ry) * TILE_SIZE, ENCOUNTER_LIST]);
			}
		}
	}
	game.map.overworldEncounters = overworldPoints;

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

		const sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
		sprite.position.x = ORIGIN_X * TILE_SIZE;
		sprite.position.y = ORIGIN_Y * TILE_SIZE;
		sprite.depth = -99999;

		game.containers.bottomSprites.addChild(sprite);
		game.map.__mazeOverlay = sprite;
	};

	const loaded = game.assets.get(tilesetUrl);
	if (loaded) {
		drawOverlay(loaded);
	} else {
		game.assets.add(tilesetUrl).load(() => {
			const image = game.assets.get(tilesetUrl);
			if (image) drawOverlay(image);
		});
	}
}
)(game);
