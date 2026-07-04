(game => {
	console.log("[cleanmode] IIFE entered - map?", !!(game && game.map), "player?", !!(game && game.player), "hooked?", !!(game && game.player && game.player.cleanmodeHooked));

	if (!game.map || !game.player) {
		console.log("[cleanmode] bailed: map or player not ready");
		return;
	}

	const mapId = game.map.id;

	if (game.player.cleanmodeHooked) {
		console.log("[cleanmode] bailed: already hooked");
		return;
	}
	game.player.cleanmodeHooked = true;

	console.log("[cleanmode] hook installed on map", mapId);

	const CLEAN_MON = "00zw418h";

	let engaged = false;
	let engagedMap = null;
	let prevNoJumping = false;

	const hasMonOut = () => {
		const party = game.player.party;
		if (!party) {
			console.log("[cleanmode] no party");
			return false;
		}
		for (const mon of party.mons) {
			if (!mon) continue;
			console.log("[cleanmode] mon uid", mon.data && mon.data.uid, "outAsAlly", mon.outAsAlly);
			if (mon.outAsAlly && mon.data && mon.data.uid === CLEAN_MON) return true;
		}
		return false;
	};

	const originalUpdate = game.player.update.bind(game.player);
	game.player.update = function() {
		const mapMatch = game.map.id === mapId;
		const jumpHeld = game.input.keyHeld("jump");

		if (jumpHeld) console.log("[cleanmode] jumpHeld", jumpHeld, "mapMatch", mapMatch, "id", game.map.id, "expected", mapId);

		const active = mapMatch && jumpHeld && hasMonOut();

		if (active && !engaged) {
			console.log("[cleanmode] ENGAGE");
			engaged = true;
			engagedMap = game.map;
			prevNoJumping = game.map.noJumping;
			game.map.noJumping = true;
			game.map.eventVars["cleanmode"] = 1;
		} else if (!active && engaged) {
			console.log("[cleanmode] DISENGAGE");
			engaged = false;
			engagedMap.noJumping = prevNoJumping;
			engagedMap.eventVars["cleanmode"] = 0;
			engagedMap = null;
		}

		originalUpdate();
	};
})(game)
