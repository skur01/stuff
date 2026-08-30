(game => {

	if (!game.hud) return;

	const CELL_SIZE = 12;

	const MAZE_TEMPLATE = [
		"#####################",
		"#o........#........o#",
		"#.#...#...#...#...#.#",
		"#.#...#...#...#...#.#",
		"#.........#.........#",
		"#.###.#########.###.#",
		"#...#.....#.....#...#",
		"###.#.#########.#.###",
		"#...#.....#.....#...#",
		"#.#......   ......#.#",
		"..#.#....   ....#.#..",
		"#.#.#....   ....#.#.#",
		"#.........#.........#",
		"#.#...#...#...#...#.#",
		"###...#########...###",
		"#.........#.........#",
		"#.#.....#. .#.....#.#",
		"#.#######.#.#######.#",
		"#.......#.#.#.......#",
		"#o#.......#.......#o#",
		"#####################"
	];

	const DIRECTIONS = Object.freeze({
		UP: "up",
		DOWN: "down",
		LEFT: "left",
		RIGHT: "right",
		NONE: "none"
	});

	const DIRECTION_VECTORS = Object.freeze({
		up: {dx: 0, dy: -1},
		down: {dx: 0, dy: 1},
		left: {dx: -1, dy: 0},
		right: {dx: 1, dy: 0},
		none: {dx: 0, dy: 0}
	});

	const OPPOSITE_DIRECTION = Object.freeze({
		up: "down",
		down: "up",
		left: "right",
		right: "left",
		none: "none"
	});

	const ALL_DIRECTIONS = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];

	const GHOST_MODES = Object.freeze({
		CHASE: "chase",
		FRIGHTENED: "frightened",
		EATEN: "eaten",
		WAITING: "waiting"
	});

	const GHOST_ROLES = Object.freeze({
		CHASER: "chaser",
		AMBUSHER: "ambusher",
		WANDERER: "wanderer",
		SHY: "shy"
	});

	const PHASES = Object.freeze({
		FADE_TO_BLACK: "fade_to_black",
		FADE_IN: "fade_in",
		GET_READY: "get_ready",
		PLAYING: "playing",
		DEATH_ANIMATION: "death_animation",
		RESPAWN_READY: "respawn_ready",
		ROUND_CLEAR_PAUSE: "round_clear_pause",
		GAME_OVER_PAUSE: "game_over_pause",
		FADE_OUT: "fade_out",
		BLACK_FADE_OUT: "black_fade_out"
	});

	const PHASE_MESSAGES = Object.freeze({
		get_ready: "GET READY",
		respawn_ready: "GET READY",
		round_clear_pause: "ROUND CLEAR",
		game_over_pause: "GAME OVER"
	});

	const HUD_FONT = 4;
	const PACMAN_INTRO_SFX = "db:scl/fi/1qey52snle571ef7zorqc/PacmanIntro.ogg?rlkey=34dawsyx5ykiyp3hobl3friha&st=ktyp9e0s&dl=0";
	const MOVE_SOUND_URL = "https://www.dl.dropboxusercontent.com/scl/fi/j9p56iieb5w4c8ybjjus5/munchlaxChomp.ogg?rlkey=jac1zuv5wyucx92oont8gqlfu&st=g8di96v6&dl=0";

	const PACMAN_RADIUS = 5;
	const GHOST_RADIUS = 5;
	const MOUTH_HALF_ANGLE = 0.65;
	const DEATH_MOUTH_HALF_ANGLE = 0.9;
	const FACING_ANGLE = Object.freeze({up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0, none: 0});

	/**
	 * Builds a list of [dx, dy] whole-pixel offsets forming a filled circle,
	 * optionally with a mouth wedge cut out, so the sprite can be drawn with
	 * hard-edged fillRect calls instead of an anti-aliased arc.
	 */
	function buildCircleMask(radiusPx, mouthAngle, mouthHalfAngle) {
		const mask = [];
		const roundedRadius = Math.round(radiusPx);

		for (let dy = -roundedRadius; dy <= roundedRadius; ++dy) {
			for (let dx = -roundedRadius; dx <= roundedRadius; ++dx) {
				if (Math.hypot(dx, dy) > radiusPx + 0.3) continue;

				if (mouthHalfAngle > 0) {
					const angle = Math.atan2(dy, dx);
					const diff = Math.atan2(Math.sin(angle - mouthAngle), Math.cos(angle - mouthAngle));
					if (Math.abs(diff) < mouthHalfAngle) continue;
				}

				mask.push([dx, dy]);
			}
		}

		return mask;
	}

	/**
	 * Builds a blocky ghost silhouette: a domed top over a rectangular skirt
	 * with a zigzag hem, as a list of whole-pixel [dx, dy] offsets.
	 */
	function buildGhostMask(radiusPx) {
		const mask = [];

		for (let dy = -radiusPx; dy <= radiusPx; ++dy) {
			for (let dx = -radiusPx; dx <= radiusPx; ++dx) {
				if (dy <= 0) {
					if (Math.hypot(dx, dy) > radiusPx + 0.3) continue;
				} else {
					if (Math.abs(dx) > radiusPx) continue;
					if (dy === radiusPx && (dx + radiusPx) % 2 === 0) continue;
				}

				mask.push([dx, dy]);
			}
		}

		return mask;
	}

	const PACMAN_CLOSED_MASK = buildCircleMask(PACMAN_RADIUS, 0, 0);
	const PACMAN_OPEN_MASKS = Object.freeze({
		up: buildCircleMask(PACMAN_RADIUS, FACING_ANGLE.up, MOUTH_HALF_ANGLE),
		down: buildCircleMask(PACMAN_RADIUS, FACING_ANGLE.down, MOUTH_HALF_ANGLE),
		left: buildCircleMask(PACMAN_RADIUS, FACING_ANGLE.left, MOUTH_HALF_ANGLE),
		right: buildCircleMask(PACMAN_RADIUS, FACING_ANGLE.right, MOUTH_HALF_ANGLE),
		none: PACMAN_CLOSED_MASK
	});
	const GHOST_MASK = buildGhostMask(GHOST_RADIUS);

	/**
	 * Self-contained overlay minigame drawn on the shared HUD canvas.
	 * Toggled on/off by mapvar[pacman]; registers once as a singleton on
	 * `game.__pacmanGame` so repeated map JS re-evaluation (which happens
	 * on every var change) never rebuilds it mid-round.
	 */
	class PacmanGame {

		static GRID_WIDTH = MAZE_TEMPLATE[0].length;
		static GRID_HEIGHT = MAZE_TEMPLATE.length;
		static PACMAN_SPEED = 6;
		static GHOST_CHASE_SPEED = 5;
		static GHOST_FRIGHTENED_SPEED = 2.5;
		static GHOST_EATEN_SPEED = 10;
		static FRIGHTENED_DURATION = 7000;
		static BLACK_FADE_DURATION = 250;
		static CONTENT_FADE_DURATION = 400;
		static GET_READY_DURATION = 4500;
		static DEATH_ANIMATION_DURATION = 1000;
		static RESPAWN_READY_DURATION = 1500;
		static ROUND_CLEAR_PAUSE_DURATION = 2000;
		static GAME_OVER_PAUSE_DURATION = 2000;
		static DOT_SCORE = 10;
		static PELLET_SCORE = 50;
		static GHOST_EAT_SCORE = 200;
		static STARTING_LIVES = 3;
		static COLLIDE_DISTANCE = 0.6;
		static BOX_COL = 10;
		static BOX_ROW = 10;
		static SPAWN_COL = 10;
		static SPAWN_ROW = 16;

		constructor(game) {
			this.game = game;

			this.pixelWidth = PacmanGame.GRID_WIDTH * CELL_SIZE;
			this.pixelHeight = PacmanGame.GRID_HEIGHT * CELL_SIZE;
			this.offsetX = Math.round((game.width - this.pixelWidth) / 2);
			this.offsetY = Math.round((game.height - this.pixelHeight) / 2);

			this.active = false;
			this.quitting = false;
			this.lastFrameTime = null;
			this.playerFrozenBeforeStart = true;
			this.mouthPhase = 0;

			this.phase = PHASES.FADE_TO_BLACK;
			this.phaseElapsed = 0;

			this.grid = null;
			this.pacman = null;
			this.ghosts = [];
			this.score = 0;
			this.lives = PacmanGame.STARTING_LIVES;
			this.dotsRemaining = 0;
			this.frightenedTimer = 0;

			// The <audio> element pathway (game.sound.play) hands this file to
			// Chrome's FFmpeg demuxer, which rejects it outright with
			// DEMUXER_ERROR_COULD_NOT_PARSE / "PTS is not defined" - a container
			// defect in the source file itself, not something fixable from JS
			// on that path. Web Audio's decodeAudioData is a different decoder
			// (the same one the engine's own playCry uses) and may tolerate it.
			this.moveGain = null;
			this.moveSoundPlaying = false;
			this.setupMoveSound();
		}

		setupMoveSound() {
			const AudioContextClass = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextClass) {
				console.error("[pacman audio] no AudioContext available in this browser");
				return;
			}

			if (!this.game.sound.audioContext) this.game.sound.audioContext = new AudioContextClass();
			const ctx = this.game.sound.audioContext;
			console.log("[pacman audio] AudioContext state:", ctx.state);

			fetch(MOVE_SOUND_URL)
				.then(response => {
					console.log("[pacman audio] fetch ok:", response.ok, "status:", response.status, "type:", response.type);
					return response.arrayBuffer();
				})
				.then(arrayBuffer => {
					console.log("[pacman audio] arrayBuffer bytes:", arrayBuffer.byteLength);
					return ctx.decodeAudioData(arrayBuffer);
				})
				.then(decodedBuffer => {
					console.log("[pacman audio] decodeAudioData succeeded, duration:", decodedBuffer.duration);

					this.moveGain = ctx.createGain();
					this.moveGain.gain.value = 0;
					this.moveGain.connect(ctx.destination);

					const source = ctx.createBufferSource();
					source.buffer = decodedBuffer;
					source.loop = true;
					source.connect(this.moveGain);
					source.start(0);

					console.log("[pacman audio] source started, looping silently until moved");
				})
				.catch(err => console.error("[pacman audio] WebAudio fetch/decode failed:", err));
		}

		draw() {
			if (!this.game.map) return;

			const mapVars = this.game.map.mapVars || {};
			const wantsActive = mapVars.pacman === 1;

			if (wantsActive && !this.active) this.start();
			else if (!wantsActive && this.active && !this.quitting) this.stop();

			if (!this.active) {
				this.lastFrameTime = null;
				return;
			}

			const now = performance.now();
			let dt = this.lastFrameTime === null ? 0 : now - this.lastFrameTime;
			this.lastFrameTime = now;
			dt = Math.min(dt, 50);

			this.update(dt);
			this.render();
		}

		start() {
			this.playerFrozenBeforeStart = this.game.player.canMove;
			this.game.player.canMove = false;

			this.quitting = false;
			this.resetBoard();
			this.setPhase(PHASES.FADE_TO_BLACK);

			this.active = true;
			this.lastFrameTime = null;
		}

		stop() {
			this.game.player.canMove = this.playerFrozenBeforeStart;
			this.active = false;
			this.quitting = false;

			this.setMoveSoundVolume(0);
			this.moveSoundPlaying = false;
		}

		setPhase(phase) {
			this.phase = phase;
			this.phaseElapsed = 0;

			if (phase === PHASES.GET_READY) this.game.sound.play(PACMAN_INTRO_SFX, false);
		}

		resetBoard() {
			this.score = 0;
			this.lives = PacmanGame.STARTING_LIVES;

			this.ghosts = [
				this.createGhost(10, 9, GHOST_ROLES.CHASER, "#f03030"),
				this.createGhost(9, 10, GHOST_ROLES.AMBUSHER, "#f0a0d0"),
				this.createGhost(11, 10, GHOST_ROLES.WANDERER, "#40c0f0"),
				this.createGhost(10, 11, GHOST_ROLES.SHY, "#f0a030")
			];

			this.refillGrid();
			this.resetPositions();
		}

		startNewRound() {
			this.refillGrid();
			this.resetPositions();
		}

		refillGrid() {
			this.grid = MAZE_TEMPLATE.map(row => row.split(""));

			this.dotsRemaining = 0;
			for (const row of this.grid) {
				for (const cell of row) {
					if (cell === "." || cell === "o") ++this.dotsRemaining;
				}
			}
		}

		createGhost(col, row, role, color) {
			return {
				col,
				row,
				progress: 0,
				homeCol: col,
				homeRow: row,
				dir: DIRECTIONS.UP,
				role,
				color,
				mode: GHOST_MODES.CHASE
			};
		}

		resetPositions() {
			this.pacman = {
				col: PacmanGame.SPAWN_COL,
				row: PacmanGame.SPAWN_ROW,
				progress: 0,
				dir: DIRECTIONS.NONE,
				nextDir: DIRECTIONS.NONE
			};

			this.frightenedTimer = 0;

			for (const ghost of this.ghosts) {
				ghost.col = ghost.homeCol;
				ghost.row = ghost.homeRow;
				ghost.progress = 0;
				ghost.dir = DIRECTIONS.UP;
				ghost.mode = GHOST_MODES.CHASE;
			}
		}

		update(dt) {
			this.mouthPhase += dt;
			this.phaseElapsed += dt;

			this.updateMoveSound();

			switch (this.phase) {
			case PHASES.FADE_TO_BLACK:
				if (this.phaseElapsed >= PacmanGame.BLACK_FADE_DURATION) this.setPhase(PHASES.FADE_IN);
				return;
			case PHASES.FADE_IN:
				if (this.phaseElapsed >= PacmanGame.CONTENT_FADE_DURATION) this.setPhase(PHASES.GET_READY);
				return;
			case PHASES.GET_READY:
				if (this.phaseElapsed >= PacmanGame.GET_READY_DURATION) this.setPhase(PHASES.PLAYING);
				return;
			case PHASES.DEATH_ANIMATION:
				if (this.phaseElapsed >= PacmanGame.DEATH_ANIMATION_DURATION) {
					this.resetPositions();
					this.setPhase(PHASES.RESPAWN_READY);
				}
				return;
			case PHASES.RESPAWN_READY:
				if (this.phaseElapsed >= PacmanGame.RESPAWN_READY_DURATION) this.setPhase(PHASES.PLAYING);
				return;
			case PHASES.ROUND_CLEAR_PAUSE:
				if (this.phaseElapsed >= PacmanGame.ROUND_CLEAR_PAUSE_DURATION) {
					this.startNewRound();
					this.setPhase(PHASES.GET_READY);
				}
				return;
			case PHASES.GAME_OVER_PAUSE:
				if (this.phaseElapsed >= PacmanGame.GAME_OVER_PAUSE_DURATION) {
					this.quitting = true;
					this.game.trigger("mapvar[pacman]=0");
					this.setPhase(PHASES.FADE_OUT);
				}
				return;
			case PHASES.FADE_OUT:
				if (this.phaseElapsed >= PacmanGame.CONTENT_FADE_DURATION) this.setPhase(PHASES.BLACK_FADE_OUT);
				return;
			case PHASES.BLACK_FADE_OUT:
				if (this.phaseElapsed >= PacmanGame.BLACK_FADE_DURATION) this.stop();
				return;
			}

			if (this.frightenedTimer > 0) {
				this.frightenedTimer -= dt;
				if (this.frightenedTimer <= 0) this.endFrightened();
			}

			this.readInput();
			this.moveEntity(this.pacman, PacmanGame.PACMAN_SPEED * dt / 1000, entity => entity.nextDir);
			this.updateMoveSound();

			for (const ghost of this.ghosts) this.updateGhost(ghost, dt);

			this.handleDotEating();
			this.handleGhostCollisions();
		}

		/**
		 * The movement sound is kept looping in the background the whole
		 * time the minigame is active; only its volume is toggled to match
		 * whether Pac-Man is actually walking right now (never during
		 * intros, pauses, or the death animation).
		 */
		updateMoveSound() {
			const isMoving = this.phase === PHASES.PLAYING && this.pacman.dir !== DIRECTIONS.NONE;
			if (isMoving === this.moveSoundPlaying) return;

			this.moveSoundPlaying = isMoving;
			console.log("[pacman audio] toggle, isMoving:", isMoving, "phase:", this.phase, "dir:", this.pacman.dir);

			if (isMoving && this.game.sound.audioContext && this.game.sound.audioContext.state === "suspended") {
				this.game.sound.audioContext.resume().then(() => console.log("[pacman audio] AudioContext resumed"));
			}

			this.setMoveSoundVolume(isMoving ? (this.game.settings.sfxVolume || 0) / 100 : 0);
		}

		setMoveSoundVolume(volume) {
			if (!this.moveGain) {
				console.warn("[pacman audio] gain node not ready yet, wanted volume", volume);
				return;
			}

			this.moveGain.gain.value = volume;
			console.log("[pacman audio] gain set to", volume, "context state:", this.game.sound.audioContext.state);
		}

		endFrightened() {
			for (const ghost of this.ghosts) {
				if (ghost.mode === GHOST_MODES.FRIGHTENED) ghost.mode = GHOST_MODES.CHASE;
			}
		}

		readInput() {
			const input = this.game.input;

			if (input.keyHeld("up")) this.pacman.nextDir = DIRECTIONS.UP;
			else if (input.keyHeld("down")) this.pacman.nextDir = DIRECTIONS.DOWN;
			else if (input.keyHeld("left")) this.pacman.nextDir = DIRECTIONS.LEFT;
			else if (input.keyHeld("right")) this.pacman.nextDir = DIRECTIONS.RIGHT;
		}

		isWalkable(col, row, dir) {
			const vector = DIRECTION_VECTORS[dir];
			const targetRow = row + vector.dy;
			if (targetRow < 0 || targetRow >= PacmanGame.GRID_HEIGHT) return false;

			const targetCol = this.wrapCol(col + vector.dx);
			return this.grid[targetRow][targetCol] !== "#";
		}

		wrapCol(col) {
			if (col < 0) return PacmanGame.GRID_WIDTH - 1;
			if (col >= PacmanGame.GRID_WIDTH) return 0;
			return col;
		}

		/**
		 * Advances an entity along the grid by `distance` cells, only allowing
		 * direction changes at cell centers (progress === 0), same as classic
		 * tile-based Pac-Man movement. `isWalkableFn` defaults to the shared
		 * grid check but can be overridden per entity if a caller needs one.
		 */
		moveEntity(entity, distance, getDesiredDirection, isWalkableFn) {
			if (!isWalkableFn) isWalkableFn = (col, row, dir) => this.isWalkable(col, row, dir);

			let remaining = distance;
			let guard = 0;

			while (remaining > 0 && guard < 8) {
				++guard;

				if (entity.progress === 0) {
					const desired = getDesiredDirection(entity);
					if (desired !== DIRECTIONS.NONE && isWalkableFn(entity.col, entity.row, desired)) {
						entity.dir = desired;
					} else if (!isWalkableFn(entity.col, entity.row, entity.dir)) {
						entity.dir = DIRECTIONS.NONE;
					}
				}

				if (entity.dir === DIRECTIONS.NONE) break;

				const distanceToNextCell = 1 - entity.progress;
				const step = Math.min(remaining, distanceToNextCell);
				entity.progress += step;
				remaining -= step;

				if (entity.progress >= 1) {
					const vector = DIRECTION_VECTORS[entity.dir];
					entity.col = this.wrapCol(entity.col + vector.dx);
					entity.row += vector.dy;
					entity.progress = 0;
				}
			}
		}

		updateGhost(ghost, dt) {
			if (ghost.mode === GHOST_MODES.WAITING) {
				if (this.frightenedTimer <= 0) ghost.mode = GHOST_MODES.CHASE;
				return;
			}

			let speed = PacmanGame.GHOST_CHASE_SPEED;
			if (ghost.mode === GHOST_MODES.FRIGHTENED) speed = PacmanGame.GHOST_FRIGHTENED_SPEED;
			else if (ghost.mode === GHOST_MODES.EATEN) speed = PacmanGame.GHOST_EATEN_SPEED;

			this.moveEntity(ghost, speed * dt / 1000, g => this.chooseGhostDirection(g));
		}

		chooseGhostDirection(ghost) {
			if (ghost.mode === GHOST_MODES.EATEN) {
				if (ghost.col === PacmanGame.BOX_COL && ghost.row === PacmanGame.BOX_ROW) {
					ghost.mode = this.frightenedTimer > 0 ? GHOST_MODES.WAITING : GHOST_MODES.CHASE;
				} else {
					return this.findShortestDirection(ghost.col, ghost.row, PacmanGame.BOX_COL, PacmanGame.BOX_ROW, ghost.dir);
				}
			}

			const options = this.getOpenDirections(ghost);
			if (options.length === 0) return OPPOSITE_DIRECTION[ghost.dir];

			if (ghost.mode === GHOST_MODES.FRIGHTENED || ghost.role === GHOST_ROLES.WANDERER) {
				return options[Math.floor(Math.random() * options.length)];
			}

			const target = this.getGhostTarget(ghost);
			return this.closestDirection(ghost, options, target);
		}

		getOpenDirections(ghost) {
			const forward = ALL_DIRECTIONS.filter(dir => dir !== OPPOSITE_DIRECTION[ghost.dir] && this.isWalkable(ghost.col, ghost.row, dir));
			if (forward.length > 0) return forward;

			return ALL_DIRECTIONS.filter(dir => this.isWalkable(ghost.col, ghost.row, dir));
		}

		closestDirection(ghost, options, target) {
			let bestDir = options[0];
			let bestDistance = Infinity;

			for (const dir of options) {
				const vector = DIRECTION_VECTORS[dir];
				const nextCol = this.wrapCol(ghost.col + vector.dx);
				const nextRow = ghost.row + vector.dy;
				const distance = Math.hypot(nextCol - target.col, nextRow - target.row);

				if (distance < bestDistance) {
					bestDistance = distance;
					bestDir = dir;
				}
			}

			return bestDir;
		}

		/**
		 * Breadth-first search over the grid graph, returning the first-step
		 * direction along the true shortest path from (fromCol, fromRow) to
		 * (targetCol, targetRow). Used for eaten ghosts returning to the box
		 * so they always actually arrive, instead of the straight-line
		 * distance heuristic getting stuck on a wall detour.
		 */
		findShortestDirection(fromCol, fromRow, targetCol, targetRow, fallbackDir) {
			if (fromCol === targetCol && fromRow === targetRow) return fallbackDir;

			const visited = new Set([fromRow + "," + fromCol]);
			const queue = [{col: fromCol, row: fromRow, firstDir: null}];
			let head = 0;

			while (head < queue.length) {
				const current = queue[head++];

				for (const dir of ALL_DIRECTIONS) {
					if (!this.isWalkable(current.col, current.row, dir)) continue;

					const vector = DIRECTION_VECTORS[dir];
					const nextCol = this.wrapCol(current.col + vector.dx);
					const nextRow = current.row + vector.dy;
					const key = nextRow + "," + nextCol;
					if (visited.has(key)) continue;

					visited.add(key);
					const firstDir = current.firstDir || dir;

					if (nextCol === targetCol && nextRow === targetRow) return firstDir;

					queue.push({col: nextCol, row: nextRow, firstDir});
				}
			}

			return fallbackDir;
		}

		getGhostTarget(ghost) {
			const pacman = this.pacman;

			if (ghost.role === GHOST_ROLES.AMBUSHER) {
				const vector = DIRECTION_VECTORS[pacman.dir];
				return {col: this.wrapCol(pacman.col + vector.dx * 4), row: pacman.row + vector.dy * 4};
			}

			if (ghost.role === GHOST_ROLES.SHY) {
				const distance = Math.hypot(ghost.col - pacman.col, ghost.row - pacman.row);
				if (distance > 8) return {col: pacman.col, row: pacman.row};
				return {col: 1, row: PacmanGame.GRID_HEIGHT - 2};
			}

			return {col: pacman.col, row: pacman.row};
		}

		/**
		 * Reverses a ghost's direction of travel in place, remapping its
		 * (col, row, progress) so its rendered position doesn't jump: a
		 * ghost mid-transit toward a cell is repositioned to be mid-transit
		 * back from that same cell, at the equivalent remaining fraction.
		 */
		reverseGhost(ghost) {
			if (ghost.progress > 0) {
				const vector = DIRECTION_VECTORS[ghost.dir];
				ghost.col = this.wrapCol(ghost.col + vector.dx);
				ghost.row += vector.dy;
				ghost.progress = 1 - ghost.progress;
			}

			ghost.dir = OPPOSITE_DIRECTION[ghost.dir];
		}

		handleDotEating() {
			const cell = this.grid[this.pacman.row][this.pacman.col];
			if (cell !== "." && cell !== "o") return;

			this.grid[this.pacman.row][this.pacman.col] = " ";
			--this.dotsRemaining;

			if (cell === ".") {
				this.score += PacmanGame.DOT_SCORE;
			} else {
				this.score += PacmanGame.PELLET_SCORE;
				this.frightenedTimer = PacmanGame.FRIGHTENED_DURATION;
				for (const ghost of this.ghosts) {
					if (ghost.mode === GHOST_MODES.EATEN || ghost.mode === GHOST_MODES.WAITING) continue;
					ghost.mode = GHOST_MODES.FRIGHTENED;
					this.reverseGhost(ghost);
				}
			}

			if (this.dotsRemaining <= 0) this.setPhase(PHASES.ROUND_CLEAR_PAUSE);
		}

		getRenderPosition(entity) {
			const vector = DIRECTION_VECTORS[entity.dir];
			return {
				col: entity.col + vector.dx * entity.progress,
				row: entity.row + vector.dy * entity.progress
			};
		}

		handleGhostCollisions() {
			const pacmanPos = this.getRenderPosition(this.pacman);

			for (const ghost of this.ghosts) {
				if (ghost.mode === GHOST_MODES.EATEN || ghost.mode === GHOST_MODES.WAITING) continue;

				const ghostPos = this.getRenderPosition(ghost);
				const distance = Math.hypot(pacmanPos.col - ghostPos.col, pacmanPos.row - ghostPos.row);
				if (distance >= PacmanGame.COLLIDE_DISTANCE) continue;

				if (ghost.mode === GHOST_MODES.FRIGHTENED) {
					ghost.mode = GHOST_MODES.EATEN;
					this.score += PacmanGame.GHOST_EAT_SCORE;
				} else {
					this.loseLife();
					break;
				}
			}
		}

		loseLife() {
			--this.lives;

			if (this.lives <= 0) {
				this.game.trigger("ev[pacman_score]=" + this.score);
				this.setPhase(PHASES.GAME_OVER_PAUSE);
			} else {
				this.setPhase(PHASES.DEATH_ANIMATION);
			}
		}

		computeAlphas() {
			let blackAlpha = 1;
			let contentAlpha = 1;

			if (this.phase === PHASES.FADE_TO_BLACK) {
				blackAlpha = this.phaseElapsed / PacmanGame.BLACK_FADE_DURATION;
				contentAlpha = 0;
			} else if (this.phase === PHASES.FADE_IN) {
				contentAlpha = this.phaseElapsed / PacmanGame.CONTENT_FADE_DURATION;
			} else if (this.phase === PHASES.FADE_OUT) {
				contentAlpha = 1 - this.phaseElapsed / PacmanGame.CONTENT_FADE_DURATION;
			} else if (this.phase === PHASES.BLACK_FADE_OUT) {
				blackAlpha = 1 - this.phaseElapsed / PacmanGame.BLACK_FADE_DURATION;
				contentAlpha = 0;
			}

			return {
				black: Math.min(1, Math.max(0, blackAlpha)),
				content: Math.min(1, Math.max(0, contentAlpha))
			};
		}

		render() {
			const ctx = this.game.hud.ctx;
			const alphas = this.computeAlphas();

			ctx.save();
			ctx.globalAlpha = alphas.black;
			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, this.game.width, this.game.height);
			ctx.restore();

			if (alphas.content <= 0) return;

			ctx.save();
			ctx.globalAlpha = alphas.content;

			this.drawMaze(ctx);
			if (this.phase !== PHASES.DEATH_ANIMATION) {
				for (const ghost of this.ghosts) this.drawGhost(ctx, ghost);
			}
			this.drawPacman(ctx);
			this.drawHudText(ctx);

			const message = PHASE_MESSAGES[this.phase];
			if (message) this.drawCenteredMessage(ctx, message);

			ctx.restore();
		}

		drawMaze(ctx) {
			for (let row = 0; row < PacmanGame.GRID_HEIGHT; ++row) {
				for (let col = 0; col < PacmanGame.GRID_WIDTH; ++col) {
					const cell = this.grid[row][col];
					const x = this.offsetX + col * CELL_SIZE;
					const y = this.offsetY + row * CELL_SIZE;

					if (cell === "#") {
						ctx.fillStyle = "#0c2280";
						ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
						ctx.fillStyle = "#1c40c0";
						ctx.fillRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
					} else if (cell === ".") {
						ctx.fillStyle = "#f0d090";
						ctx.fillRect(x + CELL_SIZE / 2 - 1, y + CELL_SIZE / 2 - 1, 2, 2);
					} else if (cell === "o") {
						ctx.fillStyle = "#f0d090";
						if (Math.floor(this.mouthPhase / 250) % 2 === 0) ctx.fillRect(x + CELL_SIZE / 2 - 2, y + CELL_SIZE / 2 - 2, 4, 4);
					}
				}
			}
		}

		drawPacman(ctx) {
			if (this.phase === PHASES.DEATH_ANIMATION) {
				this.drawPacmanDeath(ctx);
				return;
			}

			const pos = this.getRenderPosition(this.pacman);
			const x = Math.round(this.offsetX + (pos.col + 0.5) * CELL_SIZE);
			const y = Math.round(this.offsetY + (pos.row + 0.5) * CELL_SIZE);

			const isChewing = this.pacman.dir !== DIRECTIONS.NONE && Math.floor(this.mouthPhase / 90) % 2 === 0;
			const mask = isChewing ? PACMAN_OPEN_MASKS[this.pacman.dir] : PACMAN_CLOSED_MASK;

			ctx.fillStyle = "#f0e030";
			for (const [dx, dy] of mask) ctx.fillRect(x + dx, y + dy, 1, 1);
		}

		/**
		 * Death animation: a couple of quick spins with the mouth thrown wide
		 * open, then the whole sprite shrinks away to nothing.
		 */
		drawPacmanDeath(ctx) {
			const x = Math.round(this.offsetX + (this.pacman.col + 0.5) * CELL_SIZE);
			const y = Math.round(this.offsetY + (this.pacman.row + 0.5) * CELL_SIZE);
			const progress = Math.min(1, this.phaseElapsed / PacmanGame.DEATH_ANIMATION_DURATION);

			let mask;
			if (progress < 0.6) {
				const spinProgress = progress / 0.6;
				mask = buildCircleMask(PACMAN_RADIUS, spinProgress * Math.PI * 4, DEATH_MOUTH_HALF_ANGLE);
			} else {
				const shrinkProgress = (progress - 0.6) / 0.4;
				const radius = PACMAN_RADIUS * (1 - shrinkProgress);
				mask = radius > 0.5 ? buildCircleMask(radius, 0, 0) : [];
			}

			ctx.fillStyle = "#f0e030";
			for (const [dx, dy] of mask) ctx.fillRect(x + dx, y + dy, 1, 1);
		}

		drawGhost(ctx, ghost) {
			const pos = this.getRenderPosition(ghost);
			const x = Math.round(this.offsetX + (pos.col + 0.5) * CELL_SIZE);
			const y = Math.round(this.offsetY + (pos.row + 0.5) * CELL_SIZE);

			if (ghost.mode === GHOST_MODES.EATEN || ghost.mode === GHOST_MODES.WAITING) {
				this.drawGhostEyes(ctx, x, y);
				return;
			}

			ctx.fillStyle = ghost.mode === GHOST_MODES.FRIGHTENED ? "#2040c0" : ghost.color;
			for (const [dx, dy] of GHOST_MASK) ctx.fillRect(x + dx, y + dy, 1, 1);

			this.drawGhostEyes(ctx, x, y - 1);
		}

		drawGhostEyes(ctx, x, y) {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(x - 3, y - 1, 2, 2);
			ctx.fillRect(x + 1, y - 1, 2, 2);
		}

		drawHudText(ctx) {
			const text = this.game.text;

			text.draw(ctx, "SCORE " + this.score, 4, 4, HUD_FONT);

			const livesStr = "LIVES " + this.lives;
			const livesWidth = text.getWidth(livesStr, HUD_FONT);
			text.draw(ctx, livesStr, this.game.width - 4 - livesWidth, 4, HUD_FONT);
		}

		drawCenteredMessage(ctx, message) {
			this.game.text.drawCentered(ctx, message, this.game.width / 2, this.game.height / 2 - 4, HUD_FONT);
		}
	}

	if (!game.__pacmanGame) {
		game.__pacmanGame = new PacmanGame(game);
		game.hud.register(game.__pacmanGame);
	}

})(game)
