(game => {
	if (!game.map || !game.player) return;
	if (game.map.functions.gooHooked) return;
	game.map.functions.gooHooked = true;

	const GOOP_SPRITE = "pink_goop";
	const DISSOLVE_FILE = "sprites/4543/pink_goop_dissolve";
	const DISSOLVE_FRAMES = 5;
	const DISSOLVE_FPS = 100;
	const SPRITE_SIZE = 24;

	const findGoop = obj => {
		for (const other of game.objects.list) {
			if (!other || other === obj) continue;
			const name = other.textureName || "";
			if (name.includes(GOOP_SPRITE) && !name.includes("dissolve") && other.x === obj.x && other.y === obj.y) return other;
		}
		return null;
	};

	const prevOnStep = game.map.functions.onStep;
	game.map.functions.onStep = obj => {
		if (prevOnStep) prevOnStep(obj);

		if (!obj.local || !obj.player) return;
		if (game.map.eventVars["cleanmode"] !== 1) return;

		const goop = findGoop(obj);
		if (!goop) return;

		goop.setAnimation({
			file: DISSOLVE_FILE,
			x: 0,
			y: 0,
			width: SPRITE_SIZE,
			height: SPRITE_SIZE,
			fps: DISSOLVE_FPS,
			frames: DISSOLVE_FRAMES,
			loop: {
				times: 1,
				cb: () => goop.remove()
			}
		});
	};
})(game)
