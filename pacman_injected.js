(game => {

	if (!game.hud) return;

	const CELL_SIZE = 11;

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

	const GHOST_MODES = Object.freeze({
		CHASE: "chase",
		FRIGHTENED: "frightened",
		EATEN: "eaten"
	});

	const GHOST_ROLES = Object.freeze({
		CHASER: "chaser",
		AMBUSHER: "ambusher",
		WANDERER: "wanderer",
		SHY: "shy"
	});

	const PAUSE_MESSAGES = Object.freeze({
		death: "OUCH!",
		round: "ROUND CLEAR!",
		gameover: "GAME OVER"
	});

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
		static PAUSE_ON_DEATH = 1200;
		static PAUSE_ON_ROUND_END = 2500;
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
			this.lastFrameTime = null;
			this.playerFrozenBeforeStart = true;
			this.mouthPhase = 0;

			this.grid = null;
			this.pacman = null;
			this.ghosts = [];
			this.score = 0;
			this.lives = PacmanGame.STARTING_LIVES;
			this.dotsRemaining = 0;
			this.frightenedTimer = 0;
			this.pauseTimer = 0;
			this.pauseMessage = "";
		}

		draw() {
			if (!this.game.map) return;

			const mapVars = this.game.map.mapVars || {};
			const wantsActive = mapVars.pacman === 1;

			if (wantsActive && !this.active) this.start();
			else if (!wantsActive && this.active) this.stop();

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

			this.resetBoard();

			this.active = true;
			this.lastFrameTime = null;
		}

		stop() {
			this.game.player.canMove = this.playerFrozenBeforeStart;
			this.active = false;
		}

		resetBoard() {
			this.grid = MAZE_TEMPLATE.map(row => row.split(""));

			this.dotsRemaining = 0;
			for (const row of this.grid) {
				for (const cell of row) {
					if (cell === "." || cell === "o") ++this.dotsRemaining;
				}
			}

			this.score = 0;
			this.lives = PacmanGame.STARTING_LIVES;
			this.frightenedTimer = 0;
			this.pauseTimer = 0;
			this.pauseMessage = "";

			this.ghosts = [
				this.createGhost(10, 9, GHOST_ROLES.CHASER, "#f03030"),
				this.createGhost(9, 10, GHOST_ROLES.AMBUSHER, "#f0a0d0"),
				this.createGhost(11, 10, GHOST_ROLES.WANDERER, "#40c0f0"),
				this.createGhost(10, 11, GHOST_ROLES.SHY, "#f0a030")
			];

			this.resetPositions();
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

			if (this.pauseTimer > 0) {
				this.pauseTimer -= dt;
				if (this.pauseTimer <= 0) this.resolvePause();
				return;
			}

			if (this.frightenedTimer > 0) {
				this.frightenedTimer -= dt;
				if (this.frightenedTimer <= 0) this.endFrightened();
			}

			this.readInput();
			this.moveEntity(this.pacman, PacmanGame.PACMAN_SPEED * dt / 1000, entity => entity.nextDir);

			for (const ghost of this.ghosts) this.updateGhost(ghost, dt);

			this.handleDotEating();
			this.handleGhostCollisions();
		}

		resolvePause() {
			const wasRoundOrGameOver = this.pauseMessage === "round" || this.pauseMessage === "gameover";
			this.pauseMessage = "";
			if (wasRoundOrGameOver) this.resetBoard();
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

		/**
		 * Advances an entity along the grid by `distance` cells, only allowing
		 * direction changes at cell centers (progress === 0), same as classic
		 * tile-based Pac-Man movement.
		 */
		moveEntity(entity, distance, getDesiredDirection) {
			let remaining = distance;
			let guard = 0;

			while (remaining > 0 && guard < 8) {
				++guard;

				if (entity.progress === 0) {
					const desired = getDesiredDirection(entity);
					if (desired !== DIRECTIONS.NONE && this.isWalkable(entity.col, entity.row, desired)) {
						entity.dir = desired;
					} else if (!this.isWalkable(entity.col, entity.row, entity.dir)) {
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

		updateGhost(ghost, dt) {
			let speed = PacmanGame.GHOST_CHASE_SPEED;
			if (ghost.mode === GHOST_MODES.FRIGHTENED) speed = PacmanGame.GHOST_FRIGHTENED_SPEED;
			else if (ghost.mode === GHOST_MODES.EATEN) speed = PacmanGame.GHOST_EATEN_SPEED;

			this.moveEntity(ghost, speed * dt / 1000, g => this.chooseGhostDirection(g));

			const atBoxCenter = ghost.col === PacmanGame.BOX_COL && ghost.row === PacmanGame.BOX_ROW && ghost.progress === 0;
			if (ghost.mode === GHOST_MODES.EATEN && atBoxCenter) ghost.mode = GHOST_MODES.CHASE;
		}

		chooseGhostDirection(ghost) {
			const options = this.getOpenDirections(ghost);
			if (options.length === 0) return OPPOSITE_DIRECTION[ghost.dir];

			if (ghost.mode === GHOST_MODES.FRIGHTENED || ghost.role === GHOST_ROLES.WANDERER) {
				return options[Math.floor(Math.random() * options.length)];
			}

			const target = this.getGhostTarget(ghost);
			return this.closestDirection(ghost, options, target);
		}

		getOpenDirections(ghost) {
			const all = [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT];
			const forward = all.filter(dir => dir !== OPPOSITE_DIRECTION[ghost.dir] && this.isWalkable(ghost.col, ghost.row, dir));
			if (forward.length > 0) return forward;

			return all.filter(dir => this.isWalkable(ghost.col, ghost.row, dir));
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

		getGhostTarget(ghost) {
			if (ghost.mode === GHOST_MODES.EATEN) return {col: PacmanGame.BOX_COL, row: PacmanGame.BOX_ROW};

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
					if (ghost.mode === GHOST_MODES.EATEN) continue;
					ghost.mode = GHOST_MODES.FRIGHTENED;
					ghost.dir = OPPOSITE_DIRECTION[ghost.dir];
				}
			}

			if (this.dotsRemaining <= 0) {
				this.pauseMessage = "round";
				this.pauseTimer = PacmanGame.PAUSE_ON_ROUND_END;
			}
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
				if (ghost.mode === GHOST_MODES.EATEN) continue;

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
				this.pauseMessage = "gameover";
			} else {
				this.pauseMessage = "death";
			}

			this.pauseTimer = this.lives <= 0 ? PacmanGame.PAUSE_ON_ROUND_END : PacmanGame.PAUSE_ON_DEATH;

			this.resetPositions();
		}

		render() {
			const ctx = this.game.hud.ctx;

			ctx.fillStyle = "#000000";
			ctx.fillRect(0, 0, this.game.width, this.game.height);

			this.drawMaze(ctx);
			for (const ghost of this.ghosts) this.drawGhost(ctx, ghost);
			this.drawPacman(ctx);
			this.drawHudText(ctx);

			if (this.pauseTimer > 0) this.drawPauseMessage(ctx);
		}

		drawMaze(ctx) {
			for (let row = 0; row < PacmanGame.GRID_HEIGHT; ++row) {
				for (let col = 0; col < PacmanGame.GRID_WIDTH; ++col) {
					const cell = this.grid[row][col];
					const x = this.offsetX + col * CELL_SIZE;
					const y = this.offsetY + row * CELL_SIZE;

					if (cell === "#") {
						ctx.fillStyle = "#1030a0";
						ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
					} else if (cell === ".") {
						ctx.fillStyle = "#f0d090";
						ctx.beginPath();
						ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 1.5, 0, Math.PI * 2);
						ctx.fill();
					} else if (cell === "o") {
						ctx.fillStyle = "#f0d090";
						ctx.beginPath();
						ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 3.5, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
		}

		drawPacman(ctx) {
			const pos = this.getRenderPosition(this.pacman);
			const x = this.offsetX + (pos.col + 0.5) * CELL_SIZE;
			const y = this.offsetY + (pos.row + 0.5) * CELL_SIZE;
			const radius = CELL_SIZE / 2 - 1;

			const angleByDirection = {up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0, none: 0};
			const facing = angleByDirection[this.pacman.dir];
			const mouthOpen = Math.abs(Math.sin(this.mouthPhase / 120)) * 0.22;

			ctx.fillStyle = "#f0e030";
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.arc(x, y, radius, facing + mouthOpen * Math.PI, facing + (2 - mouthOpen) * Math.PI);
			ctx.closePath();
			ctx.fill();
		}

		drawGhost(ctx, ghost) {
			const pos = this.getRenderPosition(ghost);
			const x = this.offsetX + (pos.col + 0.5) * CELL_SIZE;
			const y = this.offsetY + (pos.row + 0.5) * CELL_SIZE;
			const radius = CELL_SIZE / 2 - 1;

			if (ghost.mode === GHOST_MODES.EATEN) {
				this.drawGhostEyes(ctx, x, y);
				return;
			}

			ctx.fillStyle = ghost.mode === GHOST_MODES.FRIGHTENED ? "#2040c0" : ghost.color;
			ctx.beginPath();
			ctx.arc(x, y - radius * 0.2, radius, Math.PI, 0);
			ctx.lineTo(x + radius, y + radius);
			ctx.lineTo(x + radius * 0.5, y + radius * 0.6);
			ctx.lineTo(x, y + radius);
			ctx.lineTo(x - radius * 0.5, y + radius * 0.6);
			ctx.lineTo(x - radius, y + radius);
			ctx.closePath();
			ctx.fill();

			this.drawGhostEyes(ctx, x, y - 1);
		}

		drawGhostEyes(ctx, x, y) {
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.arc(x - 2, y, 1.3, 0, Math.PI * 2);
			ctx.arc(x + 2, y, 1.3, 0, Math.PI * 2);
			ctx.fill();
		}

		drawHudText(ctx) {
			ctx.fillStyle = "#ffffff";
			ctx.font = "8px monospace";
			ctx.textBaseline = "top";

			ctx.textAlign = "left";
			ctx.fillText("SCORE " + this.score, 4, 4);

			ctx.textAlign = "right";
			ctx.fillText("LIVES " + this.lives, this.game.width - 4, 4);
		}

		drawPauseMessage(ctx) {
			const text = PAUSE_MESSAGES[this.pauseMessage];
			if (!text) return;

			ctx.fillStyle = "#ffffff";
			ctx.font = "12px monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(text, this.game.width / 2, this.game.height / 2);
		}
	}

	if (!game.__pacmanGame) {
		game.__pacmanGame = new PacmanGame(game);
		game.hud.register(game.__pacmanGame);
	}

})(game)
