(game => {
	if (!game.map || !game.player) return;
	if (game.player.positionalHooked) return;
	game.player.positionalHooked = true;

	const SOUND_FILE = "https://www.dropbox.com/scl/fi/e3m9l73lnhoucdvwqy8li/waterfountain.ogg?rlkey=k7vlp3lrdvurmt1o8wr0dno51&dl=1";
	// emitter placement and falloff radius in pixels (tile * 16)
	const EMITTER_X = 1208;
	const EMITTER_Y = 800;
	const RADIUS = 128;

	const mapId = game.map.id;

	const audio = game.sound.play(SOUND_FILE, false);
	if (!audio) return;
	audio.loop = true;

	const baseVolume = audio.targetVolume || audio.volume || 1;

	const originalUpdate = game.player.update.bind(game.player);
	game.player.update = function() {
		originalUpdate();

		if (game.map.id !== mapId) {
			audio.volume = 0;
			return;
		}

		const dx = game.player.x - EMITTER_X;
		const dy = game.player.y - EMITTER_Y;
		const dist = Math.hypot(dx, dy);
		const falloff = Math.max(0, 1 - dist / RADIUS);
		audio.volume = baseVolume * falloff;
	};
})(game)
