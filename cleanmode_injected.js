(game => {
	if (!game.map || !game.player) return;

	if (game.player.cleanmodeHooked) return;
	game.player.cleanmodeHooked = true;

	const CLEAN_MON = "00zw418h";
	const WATERSPRAY_1 = "https://www.dropbox.com/scl/fi/ic8z5es3s55p5v7g1w0dk/Waterspray1.ogg?rlkey=hddsmf1779vhmkhx7hhssfo2h&dl=1";
	const WATERSPRAY_2 = "https://www.dropbox.com/scl/fi/ljsoxpe4lvr1nxm5j5q71/Waterspray2.ogg?rlkey=hku5lng0h72c515o9lqfqrm87&dl=1";

	const mapId = game.map.id;

	let engaged = false;
	let engagedMap = null;
	let prevNoJumping = false;
	let spray1 = null;
	let spray2 = null;

	const hasMonOut = () => {
		const party = game.player.party;
		if (!party) return false;
		for (const mon of party.mons) {
			if (mon && mon.outAsAlly && mon.data && mon.data.uid === CLEAN_MON) return true;
		}
		return false;
	};

	const startSpray = () => {
		spray1 = game.sound.play(WATERSPRAY_1, false, () => {
			spray1 = null;
			if (!engaged) return;
			spray2 = game.sound.play(WATERSPRAY_2, false);
			if (spray2) spray2.loop = true;
		});
	};

	const stopSpray = () => {
		if (spray1) {
			spray1.stop();
			spray1 = null;
		}
		if (spray2) {
			spray2.stop();
			spray2 = null;
		}
	};

	const originalLocalKeys = game.player.localKeys.bind(game.player);
	game.player.localKeys = function(moving) {
		const active = game.map.id === mapId && game.input.keyHeld("jump") && hasMonOut();

		if (active && !engaged) {
			engaged = true;
			engagedMap = game.map;
			prevNoJumping = game.map.noJumping;
			game.map.noJumping = true;
			game.map.eventVars["cleanmode"] = 1;
			startSpray();
		} else if (!active && engaged) {
			engaged = false;
			engagedMap.noJumping = prevNoJumping;
			engagedMap.eventVars["cleanmode"] = 0;
			engagedMap = null;
			stopSpray();
		}

		originalLocalKeys(moving);
	};
})(game)
