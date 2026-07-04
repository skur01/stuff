(game => {
	if (!game.map || !game.player) return;
	if (game.player.irukaAmbienceHooked) return;
	game.player.irukaAmbienceHooked = true;

	const TILE_SIZE = 16;

	const PLAZA_FILE = "https://dl.dropboxusercontent.com/scl/fi/tf38cpmw6u62hwl8y13p9/irukaplazaambience.ogg?rlkey=4uq4vomj08a5jm8gvrmk3mxw4&dl=1";
	const WAVES_FILE = "https://dl.dropboxusercontent.com/scl/fi/t2tm4ruu5johijo3gb4ra/irukawavesambience.ogg?rlkey=4uphas2eogli15nj8w1nh44aj&dl=1";
	const SHINE_FILE = "https://www.dropbox.com/scl/fi/gt07vmwpnsbfng798abma/shinespritesfx.ogg?rlkey=0vnuoschnl831u21eavu9bgno&dl=1";
	const FOUNTAIN_FILE = "https://dl.dropboxusercontent.com/scl/fi/e3m9l73lnhoucdvwqy8li/waterfountain.ogg?rlkey=k7vlp3lrdvurmt1o8wr0dno51&dl=1";

	const PLAZA_X = 1208;
	const PLAZA_Y = 720;
	const PLAZA_RADIUS = 34 * TILE_SIZE;
	const PLAZA_FULL_RADIUS = (34 - 10) * TILE_SIZE;

	const SHINE_X = 1200;
	const SHINE_Y = 192;
	const SHINE_RADIUS = 5 * TILE_SIZE;

	const FOUNTAIN_X = 1208;
	const FOUNTAIN_Y = 800;
	const FOUNTAIN_RADIUS = 8 * TILE_SIZE;

	const mapId = game.map.id;

	// full volume within PLAZA_FULL_RADIUS, linear fade over the outer 3 tiles, silent past PLAZA_RADIUS
	const plazaFalloff = dist => {
		if (dist <= PLAZA_FULL_RADIUS) return 1;
		if (dist >= PLAZA_RADIUS) return 0;
		return 1 - (dist - PLAZA_FULL_RADIUS) / (PLAZA_RADIUS - PLAZA_FULL_RADIUS);
	};

	const linearFalloff = (dist, radius) => Math.max(0, 1 - dist / radius);

	const distanceTo = (x, y) => Math.hypot(game.player.x - x, game.player.y - y);

	const emitters = [
		{ file: PLAZA_FILE, volume: () => plazaFalloff(distanceTo(PLAZA_X, PLAZA_Y)) },
		{ file: WAVES_FILE, volume: () => 1 - plazaFalloff(distanceTo(PLAZA_X, PLAZA_Y)) },
		{ file: SHINE_FILE, volume: () => linearFalloff(distanceTo(SHINE_X, SHINE_Y), SHINE_RADIUS) },
		{ file: FOUNTAIN_FILE, volume: () => linearFalloff(distanceTo(FOUNTAIN_X, FOUNTAIN_Y), FOUNTAIN_RADIUS) }
	];

	for (const emitter of emitters) {
		emitter.audio = game.sound.play(emitter.file, false, null, 1);
		if (emitter.audio) {
			emitter.audio.loop = true;
			emitter.audio.muted = true;
		}
	}

	const unmute = () => {
		for (const emitter of emitters) {
			if (emitter.audio) emitter.audio.muted = false;
		}
	};
	window.addEventListener("keydown", unmute, { once: true });
	window.addEventListener("pointerdown", unmute, { once: true });

	const originalUpdate = game.player.update.bind(game.player);
	game.player.update = function() {
		originalUpdate();

		const off = game.map.id !== mapId;
		const sfx = game.settings.sfxVolume / 100;

		for (const emitter of emitters) {
			if (!emitter.audio) continue;
			emitter.audio.volume = off ? 0 : sfx * emitter.volume();
			if (!off && emitter.audio.paused) {
				const p = emitter.audio.play();
				if (p) p.catch(() => {});
			}
		}
	};
})(game)
