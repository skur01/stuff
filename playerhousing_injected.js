(game => {

	const TILE = 16;

	const MODE_VAR = "playerhousing";
	const SLOT_PREFIX = "ph";
	const UNLOCK_PREFIX = "phu";

	const CURSOR_FIRST_DELAY = 220;
	const CURSOR_REPEAT_DELAY = 90;

	const SPRITE_DIR = "sprites/4543/";

	const FURNITURE = [
		{id: 1,  name: "Snorlax Pillow",     category: "Decor",       sprite: "playerhouse_snorlaxpillow",     layer: "map",    solid: true},
		{id: 2,  name: "Pixelchu Statue",    category: "Decor",       sprite: "playerhouse_pixelchustatue",    layer: "map",    solid: true},
		{id: 3,  name: "Mart Shelf (left)",  category: "Decor",       sprite: "playerhouse_martshelfleft",     layer: "map",    solid: true},
		{id: 4,  name: "Blue Pillow",        category: "Decor",       sprite: "playerhouse_bluepillow",        layer: "map",    solid: true},
		{id: 5,  name: "Yellow Pillow",      category: "Decor",       sprite: "playerhouse_yellowpillow",      layer: "map",    solid: true},
		{id: 6,  name: "Mart Shelf (right)", category: "Decor",       sprite: "playerhouse_martshelfright",    layer: "map",    solid: true},
		{id: 10, name: "White Mart Shelf",   category: "Decor",       sprite: "playerhouse_martwhiteshelf",    layer: "map",    solid: true},

		{id: 7,  name: "Red Table",          category: "Furniture",   sprite: "playerhouse_redtable",          layer: "map",    solid: true},
		{id: 8,  name: "Plain Table",        category: "Furniture",   sprite: "playerhouse_plaintable",        layer: "map",    solid: true},
		{id: 9,  name: "Glass Table",        category: "Furniture",   sprite: "playerhouse_glasstable",        layer: "map",    solid: true},
		{id: 11, name: "Red Stool",          category: "Furniture",   sprite: "playerhouse_redstool",          layer: "map",    solid: true},
		{id: 12, name: "Plain Stool",        category: "Furniture",   sprite: "playerhouse_plainstool",        layer: "map",    solid: true},

		{id: 15, name: "Cadastrophe Plush",  category: "Plushies",    sprite: "playerhouse_plush_cadastrophe", layer: "map",    solid: true},
		{id: 16, name: "Gobblin Plush",      category: "Plushies",    sprite: "playerhouse_plush_gobblin",     layer: "map",    solid: true},
		{id: 17, name: "Mightiro Plush",     category: "Plushies",    sprite: "playerhouse_plush_mightiro",    layer: "map",    solid: true},

		{id: 18, name: "PC",                 category: "Gadgets",     sprite: "playerhouse_gadget_pc",         layer: "map",    solid: true},
		{id: 19, name: "Radio",              category: "Gadgets",     sprite: "playerhouse_gadget_radio",      layer: "map",    solid: true},
		{id: 20, name: "Warp Pad",           category: "Gadgets",     sprite: "playerhouse_gadget_warp",       layer: "bottom", solid: false},
		{id: 21, name: "Battle Dummy",       category: "Gadgets",     sprite: "playerhouse_gadget_npcbattler", layer: "map",    solid: true},

		{id: 22, name: "Green Carpet",       category: "Floor Decor", sprite: "playerhouse_greencarpet",       layer: "bottom", solid: false},
		{id: 23, name: "Old Rug",            category: "Floor Decor", sprite: "playerhouse_oldrug",            layer: "bottom", solid: false}
	];

	const CATEGORY_ORDER = ["Decor", "Furniture", "Plushies", "Gadgets", "Floor Decor"];

	const FURNITURE_BY_ID = {};
	for (const entry of FURNITURE) {
		FURNITURE_BY_ID[entry.id] = entry;
	}

	const state = game.__playerHousing || (game.__playerHousing = {
		active: false,
		exiting: false,
		cursorX: 0,
		cursorY: 0,
		nextStep: 0,
		lastDirection: 0,
		freeCam: {x: 0, y: 0, offset: {x: 0, y: 0}},
		gridGfx: null,
		cursorGfx: null,
		objectUids: [],
		pending: {},
		sizes: {},
		occupied: {},
		carrying: 0,
		previewUid: "",
		camCursorX: 0,
		camCursorY: 0,
		cancelAnswer: "",
		prevCanMove: true,
		origStateUpdate: null,
		ownerState: null
	});

	const getSlotKey = (tx, ty) => SLOT_PREFIX + "," + game.map.current + "," + tx + "," + ty;

	const getSlot = (tx, ty) => {
		const key = getSlotKey(tx, ty);

		if (Object.prototype.hasOwnProperty.call(state.pending, key)) return state.pending[key];

		return +game.map.eventVars[key] || 0;
	};

	const setSlot = (tx, ty, id) => {
		state.pending[getSlotKey(tx, ty)] = id;

		renderLayout();
	};

	const commitPending = () => {
		for (const key in state.pending) {
			game.trigger("ev[" + key + "]=" + state.pending[key]);
		}

		state.pending = {};
	};

	const discardPending = () => {
		state.pending = {};

		renderLayout();
	};

	const isUnlocked = entry => (+game.map.eventVars[UNLOCK_PREFIX + "," + entry.id] || 0) > 0;

	const getTileWidth = () => Math.floor(game.map.width / TILE);
	const getTileHeight = () => Math.floor(game.map.height / TILE);

	const isInBounds = (tx, ty) => tx >= 0 && ty >= 0 && tx < getTileWidth() && ty < getTileHeight();

	const isPlaceable = (tx, ty) => {
		if (!isInBounds(tx, ty)) return false;

		if (getSlot(tx, ty)) return true;

		return isFreeTile(tx, ty);
	};

	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

	const isFreeTile = (tx, ty) => {
		if (!isInBounds(tx, ty)) return false;

		const row = game.map.solids[ty * TILE];

		return !row || !row[tx * TILE];
	};

	const getFootprint = id => {
		const size = state.sizes[id];

		if (!size) return {left: 0, right: 0, top: 0};

		return {
			left: Math.ceil((size[0] / 2 - TILE / 2) / TILE),
			right: Math.ceil((size[0] / 2 - TILE / 2) / TILE),
			top: Math.ceil((size[1] - TILE) / TILE)
		};
	};

	const forEachFootprintTile = (tx, ty, id, cb) => {
		const print = getFootprint(id);

		for (let x = tx - print.left; x <= tx + print.right; ++x) {
			for (let y = ty - print.top; y <= ty; ++y) {
				cb(x, y);
			}
		}
	};

	const canPlaceAt = (tx, ty, id) => {
		const anchorKey = tx + "," + ty;
		let ok = true;

		forEachFootprintTile(tx, ty, id, (x, y) => {
			if (!isFreeTile(x, y)) ok = false;

			const owner = state.occupied[x + "," + y];
			if (owner && owner !== anchorKey) ok = false;
		});

		return ok;
	};

	const measureSprites = () => {
		let learned = false;

		const measure = obj => {
			if (!obj || !obj.furnitureId || state.sizes[obj.furnitureId]) return;

			const texture = obj.sprite.texture;
			if (!texture || !texture.valid || !texture.width) return;

			state.sizes[obj.furnitureId] = [texture.width, texture.height];
			learned = true;
		};

		for (const uid of state.objectUids) {
			measure(game.objects.get(uid));
		}

		measure(game.objects.get(state.previewUid));

		return learned;
	};

	const clearFurniture = () => {
		for (const uid of state.objectUids) {
			const obj = game.objects.get(uid);
			if (obj) game.objects.remove(obj);
		}

		state.objectUids.length = 0;
		state.occupied = {};
	};

	const getLayerContainer = layer => {
		if (layer === "bottom") return game.containers.bottomSprites;
		if (layer === "top") return game.containers.topSprites;

		return game.containers.objects;
	};

	const spawnFurniture = (tx, ty, entry) => {
		const uid = "ph_" + game.map.current + "_" + tx + "_" + ty;

		const obj = game.objects.add({
			type: "sprite",
			uid,
			texture: {
				file: SPRITE_DIR + entry.sprite,
				frames: 1,
				loop: -1
			},
			x: tx * TILE,
			y: ty * TILE,
			map: game.map.current,
			addToMap: true,
			parent: getLayerContainer(entry.layer)
		});

		obj.furnitureId = entry.id;

		state.objectUids.push(uid);

		const anchorKey = tx + "," + ty;
		forEachFootprintTile(tx, ty, entry.id, (x, y) => {
			state.occupied[x + "," + y] = anchorKey;
		});

		if (entry.solid) game.map.addObject(0, tx * TILE, ty * TILE);

		return obj;
	};

	const renderLayout = () => {
		clearFurniture();

		const prefix = SLOT_PREFIX + "," + game.map.current + ",";
		const slots = {};

		for (const key in game.map.eventVars) {
			if (key.startsWith(prefix)) slots[key] = +game.map.eventVars[key] || 0;
		}

		for (const key in state.pending) {
			if (key.startsWith(prefix)) slots[key] = state.pending[key];
		}

		for (const key in slots) {
			const entry = FURNITURE_BY_ID[slots[key]];
			if (!entry) continue;

			const coords = key.substring(prefix.length).split(",");
			const tx = +coords[0];
			const ty = +coords[1];

			if (!isInBounds(tx, ty)) continue;

			spawnFurniture(tx, ty, entry);
		}
	};

	const destroyGraphics = () => {
		if (state.gridGfx) {
			if (state.gridGfx.parent) state.gridGfx.parent.removeChild(state.gridGfx);
			state.gridGfx.destroy();
			state.gridGfx = null;
		}

		if (state.cursorGfx) {
			if (state.cursorGfx.parent) state.cursorGfx.parent.removeChild(state.cursorGfx);
			state.cursorGfx.destroy();
			state.cursorGfx = null;
		}
	};

	const drawGrid = () => {
		const gfx = state.gridGfx;
		const tilesWide = getTileWidth();
		const tilesHigh = getTileHeight();
		let i;

		gfx.clear();
		gfx.lineStyle(1, 0xffffff, 0.12);

		for (i = 0; i <= tilesWide; ++i) {
			gfx.moveTo(i * TILE, 0);
			gfx.lineTo(i * TILE, tilesHigh * TILE);
		}

		for (i = 0; i <= tilesHigh; ++i) {
			gfx.moveTo(0, i * TILE);
			gfx.lineTo(tilesWide * TILE, i * TILE);
		}
	};

	const drawCursor = () => {
		const gfx = state.cursorGfx;

		gfx.clear();

		if (state.carrying) {
			const fits = canPlaceAt(state.cursorX, state.cursorY, state.carrying);
			const color = fits ? 0x6cd8ff : 0xff5c5c;

			gfx.lineStyle(1, color, 1);
			gfx.beginFill(color, 0.18);

			forEachFootprintTile(state.cursorX, state.cursorY, state.carrying, (x, y) => {
				gfx.drawRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
			});

			gfx.endFill();

			return;
		}

		const color = isPlaceable(state.cursorX, state.cursorY) ? 0x6cd8ff : 0xff5c5c;

		gfx.lineStyle(1, color, 1);
		gfx.beginFill(color, 0.18);
		gfx.drawRect(state.cursorX * TILE + 0.5, state.cursorY * TILE + 0.5, TILE - 1, TILE - 1);
		gfx.endFill();
	};

	const destroyPreview = () => {
		const obj = game.objects.get(state.previewUid);
		if (obj) game.objects.remove(obj);

		state.previewUid = "";
		state.carrying = 0;
	};

	const startCarrying = id => {
		destroyPreview();

		const entry = FURNITURE_BY_ID[id];
		if (!entry) return;

		state.carrying = id;
		state.previewUid = "ph_preview";

		const obj = game.objects.add({
			type: "sprite",
			uid: state.previewUid,
			texture: {
				file: SPRITE_DIR + entry.sprite,
				frames: 1,
				loop: -1
			},
			x: state.cursorX * TILE,
			y: state.cursorY * TILE,
			map: game.map.current,
			addToMap: true,
			parent: getLayerContainer(entry.layer)
		});

		obj.furnitureId = id;
		obj.setOpacity(65);

		drawCursor();
	};

	const updatePreview = () => {
		const obj = game.objects.get(state.previewUid);
		if (!obj) return;

		if (!obj.sprite.parent) obj.addToMap();

		obj.setPosition(state.cursorX * TILE, state.cursorY * TILE);
		obj.setOpacity(65);

		obj.tint = canPlaceAt(state.cursorX, state.cursorY, state.carrying) ? 0xffffff : 0xff8080;
		obj.sprite.tint = obj.tint;
	};

	const ensureGraphics = () => {
		if (!state.gridGfx) {
			state.gridGfx = new PIXI.Graphics();
			drawGrid();
		}

		if (!state.cursorGfx) {
			state.cursorGfx = new PIXI.Graphics();
			drawCursor();
		}

		if (!state.gridGfx.parent) game.containers.overlay.addChild(state.gridGfx);
		if (!state.cursorGfx.parent) game.containers.overlay.addChild(state.cursorGfx);
	};

	const followCursor = () => {
		state.freeCam.x = state.cursorX * TILE + TILE / 2;
		state.freeCam.y = state.cursorY * TILE + TILE / 2;
	};

	const openCategoryMenu = (tx, ty, category, selected = 0, top = 0) => {
		const placedId = getSlot(tx, ty);
		const answers = [];

		for (const entry of FURNITURE) {
			if (entry.category !== category) continue;

			const index = answers.length;

			if (!isUnlocked(entry)) {
				answers.push([entry.name, () => {
					game.sound.play("wrong.ogg");

					openCategoryMenu(tx, ty, category, index, game.textbox.visibleAnswers.top);
				}]);

				continue;
			}

			answers.push([entry.id === placedId ? entry.name + " *" : entry.name, () => startCarrying(entry.id)]);
		}

		answers.push(["Back", () => openMenu(tx, ty)]);

		game.textbox.say("Which one?");
		game.textbox.answers(answers, selected, top);
	};

	const clearAll = () => {
		const prefix = SLOT_PREFIX + "," + game.map.current + ",";

		for (const key in game.map.eventVars) {
			if (key.startsWith(prefix)) state.pending[key] = 0;
		}

		for (const key in state.pending) {
			if (key.startsWith(prefix)) state.pending[key] = 0;
		}

		renderLayout();
		drawCursor();
	};

	const askToClearAll = (tx, ty) => {
		state.cancelAnswer = "No";

		game.textbox.say("Clear out everything in here?#This removes every piece you've placed.");
		game.textbox.answers([
			["No", () => {
				state.cancelAnswer = "";

				openMenu(tx, ty);
			}],
			["Yes, clear it all", () => {
				state.cancelAnswer = "";

				clearAll();
			}]
		]);
	};

	const openMenu = (tx, ty) => {
		const placedId = getSlot(tx, ty);
		const placed = FURNITURE_BY_ID[placedId];
		const answers = [];

		for (const category of CATEGORY_ORDER) {
			if (!FURNITURE.some(entry => entry.category === category)) continue;

			answers.push([category, () => openCategoryMenu(tx, ty, category)]);
		}

		if (placed) answers.push(["Pick Up", () => setSlot(tx, ty, 0)]);

		answers.push(["Clear All", () => askToClearAll(tx, ty)]);
		answers.push(["Cancel"]);

		game.textbox.say(placed ? "There's a " + placed.name + " here." : "This spot is empty.");
		game.textbox.answers(answers);
	};

	const askToFinish = () => {
		state.cancelAnswer = "Not Done";

		game.textbox.say("Are you done editing?#Save your changes?");
		game.textbox.answers([
			["Save", () => {
				state.cancelAnswer = "";

				commitPending();

				game.trigger("mapvar[" + MODE_VAR + "]=0");
			}],
			["Don't Save", () => {
				state.cancelAnswer = "";

				discardPending();

				game.trigger("mapvar[" + MODE_VAR + "]=0");
			}],
			["Not Done", () => {
				state.cancelAnswer = "";
			}]
		]);
	};

	const setCursor = (tx, ty, recenter) => {
		const nextX = clamp(tx, 0, getTileWidth() - 1);
		const nextY = clamp(ty, 0, getTileHeight() - 1);

		const moved = nextX !== state.cursorX || nextY !== state.cursorY;

		state.cursorX = nextX;
		state.cursorY = nextY;

		if (recenter) {
			state.camCursorX = nextX;
			state.camCursorY = nextY;

			followCursor();
		}

		if (!moved) return false;

		game.sound.play("select.ogg");

		drawCursor();
		updatePreview();

		return true;
	};

	const readDirection = () => {
		if (game.input.keyHeld("up")) return 1;
		if (game.input.keyHeld("down")) return 2;
		if (game.input.keyHeld("left")) return 3;
		if (game.input.keyHeld("right")) return 4;

		return 0;
	};

	const stepCursor = direction => {
		const fromX = state.camCursorX;
		const fromY = state.camCursorY;

		if (direction === 1) setCursor(fromX, fromY - 1, true);
		else if (direction === 2) setCursor(fromX, fromY + 1, true);
		else if (direction === 3) setCursor(fromX - 1, fromY, true);
		else if (direction === 4) setCursor(fromX + 1, fromY, true);
	};

	const handleKeyboard = () => {
		const direction = readDirection();

		if (!direction) {
			state.lastDirection = 0;
			state.nextStep = 0;

			return;
		}

		if (direction !== state.lastDirection) {
			state.lastDirection = direction;
			state.nextStep = game.now + CURSOR_FIRST_DELAY;

			stepCursor(direction);

			return;
		}

		if (game.now >= state.nextStep) {
			state.nextStep = game.now + CURSOR_REPEAT_DELAY;

			stepCursor(direction);
		}
	};

	const handleMouse = () => {
		if (!game.input.mouse.onGame) return;

		if (game.input.mouse.moved) {
			const tx = Math.floor(game.input.mouse.gameX / TILE);
			const ty = Math.floor(game.input.mouse.gameY / TILE);

			if (isInBounds(tx, ty)) setCursor(tx, ty, false);
		}

		if (game.input.buttonPressed(1)) confirmAtCursor();
	};

	const confirmAtCursor = () => {
		if (state.carrying) {
			if (!canPlaceAt(state.cursorX, state.cursorY, state.carrying)) {
				game.sound.play("wrong.ogg");

				return;
			}

			const id = state.carrying;

			destroyPreview();
			setSlot(state.cursorX, state.cursorY, id);
			drawCursor();

			return;
		}

		if (isPlaceable(state.cursorX, state.cursorY)) openMenu(state.cursorX, state.cursorY);
	};

	const RETURN_EASE = 8;
	const RETURN_SNAP = 1;

	const panBackToPlayer = () => {
		const targetX = game.player.x + game.player.offset.x;
		const targetY = game.player.y;

		state.freeCam.x += (targetX - state.freeCam.x) / RETURN_EASE;
		state.freeCam.y += (targetY - state.freeCam.y) / RETURN_EASE;

		if (Math.abs(targetX - state.freeCam.x) < RETURN_SNAP && Math.abs(targetY - state.freeCam.y) < RETURN_SNAP) {
			finishExit();
		}
	};

	const updateBuildMode = () => {
		if (!state.active) return;

		if (state.exiting) {
			panBackToPlayer();

			return;
		}

		ensureGraphics();

		if (measureSprites()) {
			renderLayout();
			drawCursor();
		}

		if (state.carrying) updatePreview();

		if (game.chat.focused || game.textbox.active > -1 || $("cover") || !game.focused) return;

		if (game.input.keyPressed("cancel")) {
			if (state.carrying) {
				destroyPreview();
				drawCursor();
			} else {
				askToFinish();
			}

			return;
		}

		handleKeyboard();
		handleMouse();

		if (game.input.keyPressed("action")) confirmAtCursor();
	};

	const enterBuildMode = () => {
		if (state.active) return;

		state.active = true;
		state.exiting = false;
		state.pending = {};

		state.ownerState = game.state;

		state.cursorX = clamp(Math.round(game.player.x / TILE), 0, Math.max(0, getTileWidth() - 1));
		state.cursorY = clamp(Math.round(game.player.y / TILE), 0, Math.max(0, getTileHeight() - 1));
		state.camCursorX = state.cursorX;
		state.camCursorY = state.cursorY;

		state.prevCanMove = game.player.canMove;
		game.player.canMove = false;

		ensureGraphics();
		drawGrid();
		drawCursor();
		followCursor();

		game.camera.setTarget(state.freeCam);

		const origUpdate = game.state.update;

		state.origStateUpdate = origUpdate;
		game.state.update = function (...args) {
			updateBuildMode();

			return origUpdate.apply(this, args);
		};
	};

	const finishExit = () => {
		state.active = false;
		state.exiting = false;
		state.pending = {};
		state.cancelAnswer = "";

		destroyPreview();

		if (state.ownerState && state.origStateUpdate) {
			state.ownerState.update = state.origStateUpdate;
		}

		state.origStateUpdate = null;
		state.ownerState = null;

		destroyGraphics();

		game.player.canMove = state.prevCanMove;

		game.camera.setTarget(game.player);
	};

	const exitBuildMode = smooth => {
		if (!state.active || state.exiting) return;

		if (!smooth) {
			finishExit();

			return;
		}

		state.exiting = true;

		destroyPreview();
		destroyGraphics();
	};

	if (!game.textbox.__playerHousingCancelWrap) {
		game.textbox.__playerHousingCancelWrap = true;

		const origSelectAnswer = game.textbox.selectAnswer;

		game.textbox.selectAnswer = function (keywords) {
			if (state.cancelAnswer && Array.isArray(keywords)) {
				const answers = this.queue[this.active] ? this.queue[this.active].answers : null;

				if (answers && !answers.some(answer => keywords.includes(answer[0].toLowerCase()))) {
					return origSelectAnswer.call(this, state.cancelAnswer);
				}
			}

			return origSelectAnswer.call(this, keywords);
		};
	}

	if (!game.map.__playerHousingResetWrap) {
		game.map.__playerHousingResetWrap = true;

		const origReset = game.map.reset;

		game.map.reset = function (...args) {
			clearFurniture();

			if (!this.updating) destroyGraphics();

			return origReset.apply(this, args);
		};
	}

	renderLayout();

	if ((+game.map.mapVars[MODE_VAR] || 0) === 1) {
		enterBuildMode();
	} else {
		exitBuildMode(true);
	}
})(game)
