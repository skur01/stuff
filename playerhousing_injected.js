(game => {

	const TILE = 16;

	const MODE_VAR = "playerhousing";
	const SLOT_PREFIX = "ph";
	const FLOOR_PREFIX = "phf";
	const UNLOCK_PREFIX = "phu";

	const CURSOR_FIRST_DELAY = 220;
	const CURSOR_REPEAT_DELAY = 90;

	const SPRITE_DIR = "sprites/4543/";

	const FLOOR_DEPTH = 10000;

	const BATTLE_TRIGGER = "phbattle";
	const SCAN_FLAG = "phscan";

	const RESTING_COLOR = 0x6cd8ff;
	const UPRIGHT_COLOR = 0xffc44d;
	const BLOCKED_COLOR = 0xff5c5c;

	const FURNITURE = [
		{id: 1,  name: "Snorlax Pillow",     category: "Decor",       sprite: "playerhouse_snorlaxpillow",     layer: "map",   solid: true,  w: 2, h: 2, base: 1},
		{id: 2,  name: "Pixelchu Statue",    category: "Decor",       sprite: "playerhouse_pixelchustatue",    layer: "map",   solid: true,  w: 2, h: 2, base: 1},
		{id: 3,  name: "Mart Shelf (left)",  category: "Decor",       sprite: "playerhouse_martshelfleft",     layer: "map",   solid: true,  w: 1, h: 2, base: 1},
		{id: 4,  name: "Blue Pillow",        category: "Decor",       sprite: "playerhouse_bluepillow",        layer: "map",    solid: true},
		{id: 5,  name: "Yellow Pillow",      category: "Decor",       sprite: "playerhouse_yellowpillow",      layer: "map",    solid: true},
		{id: 6,  name: "Mart Shelf (right)", category: "Decor",       sprite: "playerhouse_martshelfright",    layer: "map",   solid: true,  w: 1, h: 2, base: 1},
		{id: 10, name: "White Mart Shelf",   category: "Decor",       sprite: "playerhouse_martwhiteshelf",    layer: "map",   solid: true,  w: 1, h: 2, base: 1},

		{id: 7,  name: "Red Table",          category: "Furniture",   sprite: "playerhouse_redtable",          layer: "map",    solid: true},
		{id: 8,  name: "Plain Table",        category: "Furniture",   sprite: "playerhouse_plaintable",        layer: "map",    solid: true},
		{id: 9,  name: "Glass Table",        category: "Furniture",   sprite: "playerhouse_glasstable",        layer: "map",    solid: true},
		{id: 11, name: "Red Stool",          category: "Furniture",   sprite: "playerhouse_redstool",          layer: "map",    solid: true},
		{id: 12, name: "Plain Stool",        category: "Furniture",   sprite: "playerhouse_plainstool",        layer: "map",    solid: true},

		{id: 15, name: "Cadastrophe Plush",  category: "Plushies",    sprite: "playerhouse_plush_cadastrophe", layer: "map",   solid: true,  w: 2, h: 2, base: 1},
		{id: 16, name: "Gobblin Plush",      category: "Plushies",    sprite: "playerhouse_plush_gobblin",     layer: "map",   solid: true,  w: 1, h: 1, base: 1},
		{id: 17, name: "Mightiro Plush",     category: "Plushies",    sprite: "playerhouse_plush_mightiro",    layer: "map",   solid: true,  w: 1, h: 1, base: 1},

		{id: 18, name: "PC",                 category: "Gadgets",     sprite: "playerhouse_gadget_pc",         layer: "map",   solid: true,  w: 1, h: 2, base: 1, interact: {
			msg: "Booted up the PC!",
			triggers: "pc"
		}},
		{id: 19, name: "Radio",              category: "Gadgets",     sprite: "playerhouse_gadget_radio",      layer: "map",   solid: true, interact: {
			msg: "What would you like to change the music to?",
			answers: [
				["Default", "", "track=db:scl/fi/ntrl80cavyqmt1qgro2ux/TomadatchiLife-BW.ogg?rlkey=jtngvf970ggsg3p7f2dciqgj0^st=wu5jgvkd^dl=0&ev[PlayerHousing_Music]=0"],
				["Cool", "", "track=db:scl/fi/6r4kspc0kchpxze0wdqel/AfterSchoolSpecial-Blockland-BW.ogg?rlkey=vh3x396769wdiidz8abf4xutu^st=j5b2ni2r^dl=0&ev[PlayerHousing_Music]=1"],
				["Pleasant", "", "track=db:scl/fi/ydydeubwrccaby7f87ka7/PokemonLeague-DP.ogg?rlkey=m3hngu89q3bdz9swaca91el1b^st=fy2ixdba^dl=0&ev[PlayerHousing_Music]=2"],
				["Cancel"]
			]
		}},
		{id: 20, name: "Warp Machine",       category: "Gadgets",     sprite: "playerhouse_gadget_warp",       layer: "map",   solid: true,  w: 1, h: 3, base: 1, interact: {
			msg: "Where would you like to warp to?",
			answers: [
				["Battle Tower", "", "warp=08j07bln,1"],
				["Cancel"]
			]
		}},
		{id: 21, name: "Battle Machine",     category: "Gadgets",     sprite: "playerhouse_gadget_npcbattler", layer: "map",   solid: true,  w: 1, h: 2, base: 1, interact: {
			msg: "The Battle Machine whirs to life.",
			triggers: BATTLE_TRIGGER
		}},

		{id: 22, name: "Green Carpet",       category: "Floor Decor", sprite: "playerhouse_greencarpet",       layer: "floor", solid: false},
		{id: 23, name: "Old Rug",            category: "Floor Decor", sprite: "playerhouse_oldrug",            layer: "floor", solid: false}
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
		preloading: 0,
		occupied: {},
		baseClaims: {},
		floorOccupied: {},
		solidTiles: [],
		messageTiles: [],
		carrying: 0,
		previewUid: "",
		camCursorX: 0,
		camCursorY: 0,
		cancelAnswer: "",
		prevCanMove: true,
		origStateUpdate: null,
		ownerState: null
	});

	const isFloorEntry = entry => entry && entry.layer === "floor";

	const isFloorId = id => isFloorEntry(FURNITURE_BY_ID[id]);

	const getSlotKey = (tx, ty, floor) => (floor ? FLOOR_PREFIX : SLOT_PREFIX) + "," + game.map.current + "," + tx + "," + ty;

	const getSlot = (tx, ty, floor) => {
		const key = getSlotKey(tx, ty, floor);

		if (Object.prototype.hasOwnProperty.call(state.pending, key)) return state.pending[key];

		return +game.map.eventVars[key] || 0;
	};

	const setSlot = (tx, ty, id, floor) => {
		state.pending[getSlotKey(tx, ty, floor)] = id;

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

	const getAnchorAt = (tx, ty, floor) => {
		const owner = (floor ? state.floorOccupied : state.occupied)[tx + "," + ty];

		if (!owner) return null;

		const parts = owner.split(",");

		return [+parts[0], +parts[1]];
	};

	const isPlaceable = (tx, ty) => {
		if (!isInBounds(tx, ty)) return false;

		if (state.occupied[tx + "," + ty] || state.floorOccupied[tx + "," + ty]) return true;

		return isFreeTile(tx, ty);
	};

	const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

	const isFreeTile = (tx, ty) => {
		if (!isInBounds(tx, ty)) return false;

		const row = game.map.solids[ty * TILE];

		return !row || !row[tx * TILE];
	};

	const getFootprint = id => {
		const entry = FURNITURE_BY_ID[id];
		const size = state.sizes[id];

		let w = entry && entry.w ? entry.w : 1;
		let h = entry && entry.h ? entry.h : 1;

		if (size && (!entry || !entry.w || !entry.h)) {
			w = Math.max(1, Math.ceil(size[0] / TILE));
			h = Math.max(1, Math.ceil(size[1] / TILE));
		}

		const base = clamp(entry && typeof entry.base === "number" ? entry.base : 1, 0, h);

		return {w, h, base};
	};

	const getSpriteOffsetX = id => (getFootprint(id).w - 1) * TILE / 2;

	// The bottom `base` rows rest on the floor. Anything above them is upright, like the
	// top half of a statue leaning on a wall, so it neither blocks the player nor cares
	// whether the tile behind it is solid.
	const forEachFootprintTile = (tx, ty, id, cb) => {
		const print = getFootprint(id);

		for (let x = tx; x < tx + print.w; ++x) {
			for (let y = ty - print.h + 1; y <= ty; ++y) {
				cb(x, y, y > ty - print.base);
			}
		}
	};

	// Only the rows resting on the floor need clear ground. Upright rows are hanging in
	// the air, so they are free to pass over walls and over the lower halves of whatever
	// is already standing there.
	const canPlaceAt = (tx, ty, id) => {
		const anchorKey = tx + "," + ty;
		const claims = isFloorId(id) ? state.floorOccupied : state.baseClaims;
		let ok = true;

		forEachFootprintTile(tx, ty, id, (x, y, resting) => {
			if (!isInBounds(x, y)) {
				ok = false;

				return;
			}

			if (!resting) return;

			const owner = claims[x + "," + y];

			if (owner) {
				if (owner !== anchorKey) ok = false;

				return;
			}

			if (!isFreeTile(x, y)) ok = false;
		});

		return ok;
	};

	// Footprints have to be known before the first placement, not discovered once a piece
	// is already on the map, so pull the real image dimensions up front for anything the
	// catalogue does not declare a size for.
	const preloadSizes = () => {
		if (state.preloading) return;

		const missing = FURNITURE.filter(entry => !state.sizes[entry.id]);

		if (!missing.length) return;

		state.preloading = missing.length;

		for (const entry of missing) {
			const img = new Image();

			const done = size => {
				state.sizes[entry.id] = size;

				if (--state.preloading > 0) return;

				renderLayout();

				if (state.active && state.cursorGfx) drawCursor();
			};

			img.onload = () => done([img.width, img.height]);
			img.onerror = () => done([TILE, TILE]);
			img.src = CDN_BASE + "images/" + SPRITE_DIR + entry.sprite + ".webp";
		}
	};

	// Mirrors what JCOAD's msg()/answers= pair compiles to: addObject(1) registers the tile
	// message, addObject(11) registers each answer's follow-up message and triggers.
	const registerInteraction = (tx, ty, entry) => {
		const interact = entry.interact;

		if (!interact) return;

		const px = tx * TILE;
		const py = ty * TILE;

		// renderLayout runs far more often than map.reset, and addObject(1) appends rather
		// than replaces, so a tile the map already speaks for is left alone and anything we
		// do register gets tracked for teardown.
		if (game.map.messages[py] && game.map.messages[py][px]) return;

		state.messageTiles.push([px, py]);

		const answers = interact.answers || [];
		const parts = [];

		if (interact.triggers) parts.push(interact.triggers);

		if (answers.length) parts.push("answers=" + answers.map(answer => answer[0]).join(","));

		game.map.direction = 0;
		game.map.addObject(1, px, py, interact.msg, parts.join("&"));

		for (const answer of answers) {
			game.map.addObject(11, px, py, answer[0], answer[1] || "", answer[2] || "");
		}
	};

	const clearInteractions = () => {
		for (const tile of state.messageTiles) {
			if (game.map.messages[tile[1]]) delete game.map.messages[tile[1]][tile[0]];
			if (game.map.answers[tile[1]]) delete game.map.answers[tile[1]][tile[0]];
		}

		state.messageTiles.length = 0;
	};

	// Mirror match. battle.load() builds the teams and calls setup() with no server round
	// trip, so the opponent can be assembled here: the player's own party serialised with
	// mon.store(false) and handed back as strings, which setup() rebuilds into fresh Mon
	// objects rather than aliasing the live party.
	// Snapshots live in localStorage, which is per browser and not tied to the account, so
	// a numeric ev records that a scan was ever taken. Flag set but storage empty means the
	// snapshot was made somewhere else or wiped, and the player is told rather than shown
	// an empty machine.
	const getScanKey = () => "playerhousing_scan_" + (game.player.id || 0);

	const readScan = () => {
		try {
			const raw = localStorage.getItem(getScanKey());

			if (!raw) return null;

			const data = JSON.parse(raw);

			return data && data.mons && data.mons.length ? data : null;
		} catch (e) {
			return null;
		}
	};

	const writeScan = data => {
		try {
			localStorage.setItem(getScanKey(), JSON.stringify(data));

			return true;
		} catch (e) {
			return false;
		}
	};

	const describeAge = saved => {
		const days = Math.floor((Date.now() - saved) / 86400000);

		if (days < 1) return "scanned today";
		if (days === 1) return "scanned yesterday";

		return "scanned " + days + " days ago";
	};

	const scanTeam = () => {
		const mons = [];
		const roster = [];

		for (const mon of game.player.party.mons) {
			if (!mon) continue;

			mons.push(mon.store(false));
			roster.push(mon.getName() + "  Lv." + mon.level);
		}

		if (!mons.length) {
			game.textbox.say("There's nothing in your party to scan.", () => openBattleMachineMenu());

			return;
		}

		const saved = writeScan({
			mons,
			roster,
			name: game.player.name,
			skin: game.player.skin,
			saved: Date.now()
		});

		if (!saved) {
			game.textbox.say("The Battle Machine couldn't hold onto the scan.#Your browser is refusing to store it.");

			return;
		}

		game.trigger("ev[" + SCAN_FLAG + "]=1");

		game.textbox.say("Scanned " + roster.length + (roster.length === 1 ? " team member." : " team members."));
		game.textbox.say("The scan is kept on this device only.#Clearing your browser data, or playing from somewhere else, will lose it.", () => openBattleMachineMenu());
	};

	const viewScan = scan => {
		const roster = scan.roster || [];

		game.textbox.say(scan.name + "'s scanned team:");

		for (let i = 0; i < roster.length; i += 3) {
			const last = i + 3 >= roster.length;

			game.textbox.say(roster.slice(i, i + 3).join("#"), last ? () => openBattleMachineMenu() : undefined);
		}
	};

	const startMirrorBattle = (fixedLevel, scan) => {
		if (!game.player.party.conscious()) {
			game.textbox.say("Your team is in no shape for a practice match.");

			return;
		}

		const clones = scan.mons.slice(0);

		const config = {
			amount: [1, 1],
			noExp: true,
			noMoney: true,
			noCatch: true,
			notWild: true,
			noSeen: true,
			fixedLevel: fixedLevel ? [fixedLevel, fixedLevel] : [0, 0],
			onend: () => {
				game.player.tmpPartner = null;
				game.player.enemyPartner = null;
				game.player.caughtMons = null;

				game.sound.playTrack("");
				game.weather.unhide();

				game.state.set("overworld");

				game.battling = false;

				game.setZoom(game.settings.zoom);
				game.player.createIcon(0);
			}
		};

		game.battling = true;

		game.fadeTransition(-1, "#000", () => {
			game.player.party.upload();
			game.player.createIcon(12, 1);

			game.state.set("battle");

			game.player.relay = data => game.client.relay(data);

			const battleData = {
				types: ["player", "npc"],
				mons: [game.player.party.mons, clones],
				trainers: [
					game.player,
					{
						name: scan.name,
						id: 0,
						trainerClass: "",
						individual: scan.skin,
						pressureSpeech: "You already know what I'm going to do.",
						victorySpeech: "Of course. I know that team better than anyone.",
						defeatSpeech: "You've moved on since that scan, haven't you.",
						items: ""
					}
				],
				config: {}
			};

			if (REGION.battleTheme) game.sound.playTrack(REGION.battleTheme);

			game.battle.load(battleData, config);
		});
	};

	const openLevelMenu = scan => {
		game.textbox.say("How should it fight you?");
		game.textbox.answers([
			["Their Own Levels", () => startMirrorBattle(0, scan)],
			["Set Level 50", () => startMirrorBattle(50, scan)],
			["Back", () => openBattleMachineMenu()]
		]);
	};

	const openBattleMachineMenu = () => {
		const scan = readScan();

		if (!scan) {
			const scannedBefore = (+game.map.eventVars[SCAN_FLAG] || 0) > 0;

			game.textbox.say(scannedBefore ?
				"The Battle Machine's records are empty.#You scanned a team once, but that snapshot was saved on another device or has been cleared from this browser." :
				"The Battle Machine has no team on record yet.");

			game.textbox.answers([
				["Scan My Team", () => scanTeam()],
				["Cancel"]
			]);

			return;
		}

		game.textbox.say("On record: " + scan.name + "'s team of " + scan.mons.length + ", " + describeAge(scan.saved) + ".");
		game.textbox.answers([
			["Battle It", () => openLevelMenu(scan)],
			["View Team", () => viewScan(scan)],
			["Rescan My Team", () => scanTeam()],
			["Cancel"]
		]);
	};

	const addSolid = (tx, ty) => {
		const px = tx * TILE;
		const py = ty * TILE;

		if (!game.map.solids[py]) game.map.solids[py] = {};

		if (game.map.solids[py][px]) return;

		game.map.solids[py][px] = "5";
		state.solidTiles.push([px, py]);
	};

	const clearSolids = () => {
		for (const tile of state.solidTiles) {
			if (game.map.solids[tile[1]]) delete game.map.solids[tile[1]][tile[0]];
		}

		state.solidTiles.length = 0;
	};

	const clearFurniture = () => {
		for (const uid of state.objectUids) {
			const obj = game.objects.get(uid);
			if (obj) game.objects.remove(obj);
		}

		state.objectUids.length = 0;
		state.occupied = {};
		state.baseClaims = {};
		state.floorOccupied = {};

		clearSolids();
		clearInteractions();
	};

	const getLayerContainer = layer => {
		if (layer === "floor") return game.containers.bottomSprites;
		if (layer === "bottom") return game.containers.bottomSprites;
		if (layer === "top") return game.containers.topSprites;

		return game.containers.objects;
	};

	const getLayerDepth = layer => layer === "floor" ? FLOOR_DEPTH : 0;

	const spawnFurniture = (tx, ty, entry) => {
		const floor = isFloorEntry(entry);
		const uid = (floor ? "phf_" : "ph_") + game.map.current + "_" + tx + "_" + ty;

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
			offset: {
				x: getSpriteOffsetX(entry.id),
				y: 0
			},
			depth: getLayerDepth(entry.layer),
			map: game.map.current,
			addToMap: true,
			parent: getLayerContainer(entry.layer)
		});

		obj.furnitureId = entry.id;

		state.objectUids.push(uid);

		const anchorKey = tx + "," + ty;
		const claims = floor ? state.floorOccupied : state.occupied;

		forEachFootprintTile(tx, ty, entry.id, (x, y, resting) => {
			const key = x + "," + y;

			if (resting) {
				claims[key] = anchorKey;

				if (!floor) state.baseClaims[key] = anchorKey;

				if (entry.solid) addSolid(x, y);

				registerInteraction(x, y, entry);
			} else if (!claims[key]) {
				claims[key] = anchorKey;
			}
		});

		return obj;
	};

	// Floor pieces are spawned first so their occupancy map is ready and so their sprites
	// sit behind the objects that can be stacked on top of them.
	const renderPrefix = prefix => {
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

	const renderLayout = () => {
		clearFurniture();

		renderPrefix(FLOOR_PREFIX + "," + game.map.current + ",");
		renderPrefix(SLOT_PREFIX + "," + game.map.current + ",");
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

			forEachFootprintTile(state.cursorX, state.cursorY, state.carrying, (x, y, resting) => {
				const tileColor = fits ? (resting ? RESTING_COLOR : UPRIGHT_COLOR) : BLOCKED_COLOR;

				gfx.lineStyle(1, tileColor, 1);
				gfx.beginFill(tileColor, resting ? 0.28 : 0.14);
				gfx.drawRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
				gfx.endFill();
			});

			return;
		}

		const color = isPlaceable(state.cursorX, state.cursorY) ? RESTING_COLOR : BLOCKED_COLOR;

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
			offset: {
				x: getSpriteOffsetX(id),
				y: 0
			},
			depth: getLayerDepth(entry.layer),
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

		obj.offset.custom.x = getSpriteOffsetX(state.carrying);

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

			const placedId = getSlot(tx, ty, isFloorEntry(entry));

			answers.push([entry.id === placedId ? entry.name + " *" : entry.name, () => startCarrying(entry.id)]);
		}

		answers.push(["Back", () => openMenu(tx, ty)]);

		game.textbox.say("Which one?");
		game.textbox.answers(answers, selected, top);
	};

	const clearAll = () => {
		const prefixes = [
			SLOT_PREFIX + "," + game.map.current + ",",
			FLOOR_PREFIX + "," + game.map.current + ","
		];

		const matches = key => prefixes.some(prefix => key.startsWith(prefix));

		for (const key in game.map.eventVars) {
			if (matches(key)) state.pending[key] = 0;
		}

		for (const key in state.pending) {
			if (matches(key)) state.pending[key] = 0;
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
		const objectAnchor = getAnchorAt(tx, ty, false);
		const floorAnchor = getAnchorAt(tx, ty, true);

		const placed = objectAnchor ? FURNITURE_BY_ID[getSlot(objectAnchor[0], objectAnchor[1], false)] : null;
		const placedFloor = floorAnchor ? FURNITURE_BY_ID[getSlot(floorAnchor[0], floorAnchor[1], true)] : null;

		const answers = [];

		for (const category of CATEGORY_ORDER) {
			if (!FURNITURE.some(entry => entry.category === category)) continue;

			answers.push([category, () => openCategoryMenu(tx, ty, category)]);
		}

		if (placed) answers.push(["Pick Up " + placed.name, () => setSlot(objectAnchor[0], objectAnchor[1], 0, false)]);

		if (placedFloor) answers.push(["Pick Up " + placedFloor.name, () => setSlot(floorAnchor[0], floorAnchor[1], 0, true)]);

		answers.push(["Clear All", () => askToClearAll(tx, ty)]);
		answers.push(["Cancel"]);

		const names = [placed, placedFloor].filter(entry => entry).map(entry => entry.name);

		game.textbox.say(names.length ? "There's a " + names.join(" and a ") + " here." : "This spot is empty.");
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
			setSlot(state.cursorX, state.cursorY, id, isFloorId(id));
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

	// Tile messages can only carry trigger strings, so the Battle Machine gets its own
	// keyword and game.trigger is taught to route it back into this file.
	if (!game.__playerHousingTriggerWrap) {
		game.__playerHousingTriggerWrap = true;

		const origTrigger = game.trigger;

		game.trigger = function (str, ...rest) {
			const parts = typeof str === "string" ? str.split("&") : null;

			if (parts && parts.includes(BATTLE_TRIGGER)) {
				const remaining = parts.filter(part => part !== BATTLE_TRIGGER);

				openBattleMachineMenu();

				if (!remaining.length) return true;

				return origTrigger.call(this, remaining.join("&"), ...rest);
			}

			return origTrigger.call(this, str, ...rest);
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

	preloadSizes();

	renderLayout();

	if ((+game.map.mapVars[MODE_VAR] || 0) === 1) {
		enterBuildMode();
	} else {
		exitBuildMode(true);
	}
})(game)
