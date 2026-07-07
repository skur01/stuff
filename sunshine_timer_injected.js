(game => {
	if (!game.map || !game.player) return;

	const SUNSHINE_TIMER_SFX = "https://dl.dropboxusercontent.com/scl/fi/19wnxt37uvy2immpa3pr8/sunshinetimer.ogg?rlkey=1dje076zgfuv8e92uwrlhstbx&dl=1";
	const SUNSHINE_FAST_SFX = "https://dl.dropboxusercontent.com/scl/fi/07yuq0pwxhjkc9uul35s0/sunshinetimerfast.ogg?rlkey=dua6jl7at5ccykk1kxlldf5co&dl=1";
	const SUNSHINE_GAMEOVER_SFX = "https://dl.dropboxusercontent.com/scl/fi/1mrkygpxp3virk7kq373z/sunshinegameover.ogg?rlkey=skbb7e0rsxtuh26xdb9q2g28p&dl=1";

	const SLOW_STAGE_MS = 10000;
	const FAST_STAGE_MS = 5000;
	const SLIDE_IN_DURATION_MS = 1200;
	const SLIDE_OUT_DURATION_MS = 1300;

	const STAGES = Object.freeze({ NONE: 0, SLOW: 1, FAST: 2 });

	const state = game.player.sunshineState || (game.player.sunshineState = {
		active: false,
		finishing: false,
		paused: false,
		remaining: 0,
		lastTick: 0,
		varSeen: 0,
		stage: STAGES.NONE,
		stageAudio: null,
		element: null
	});

	const clearTimerVar = () => {
		if (typeof game.map.eventVars["sunshinetimer"] !== "undefined") game.map.eventVars["sunshinetimer"] = 0;
		if (typeof game.map.mapVars["sunshinetimer"] !== "undefined") game.map.mapVars["sunshinetimer"] = 0;
		game.trigger("var[sunshinetimer]=0");
	};

	const stopStageAudio = () => {
		if (state.stageAudio) {
			state.stageAudio.stop();
			state.stageAudio = null;
		}
	};

	const formatTime = ms => {
		const clamped = Math.max(0, ms);
		const minutes = Math.floor(clamped / 60000);
		const seconds = Math.floor((clamped % 60000) / 1000);
		const millis = Math.floor(clamped % 1000);
		return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(millis).padStart(3, "0");
	};

	const createTimerElement = initialText => {
		const container = document.getElementById("game-container");
		if (!container) return null;

		// the wrapper clips the slide so the timer emerges from inside the screen edge
		const wrapper = document.createElement("div");
		wrapper.id = "sunshine-timer-wrapper";
		wrapper.style.cssText =
			"position:absolute;top:0;left:0;width:100%;height:64px;" +
			"overflow:hidden;pointer-events:none;z-index:5;";

		const element = document.createElement("div");
		element.id = "sunshine-timer";
		element.style.cssText =
			"position:absolute;top:8px;left:50%;" +
			"transform:translate(-50%,-250%);" +
			"transition:transform " + SLIDE_IN_DURATION_MS + "ms cubic-bezier(0.22, 1, 0.36, 1);" +
			"background:rgba(0,0,0,0.65);color:#ffdd44;" +
			"font-family:monospace;font-size:22px;font-weight:bold;" +
			"padding:6px 14px;border-radius:8px;pointer-events:none;";

		// the text must be in place before layout, otherwise the width change mid slide drifts the centering
		element.textContent = initialText;

		wrapper.appendChild(element);
		container.appendChild(wrapper);

		// force a layout pass so the slide-in transition actually animates
		element.getBoundingClientRect();
		element.style.transform = "translate(-50%,0)";

		return element;
	};

	const removeTimerElement = () => {
		if (!state.element) return;

		const element = state.element;
		state.element = null;

		// a small dip first, then accelerating upward, like hopping off a tiny ledge
		element.style.transition = "transform " + SLIDE_OUT_DURATION_MS + "ms cubic-bezier(0.6, -0.28, 0.735, 0.045)";
		element.getBoundingClientRect();
		element.style.transform = "translate(-50%,-250%)";

		INTERVAL.push(setTimeout(() => {
			if (element.parentElement) element.parentElement.remove();
			else element.remove();
		}, SLIDE_OUT_DURATION_MS));
	};

	const startTimer = seconds => {
		state.active = true;
		state.finishing = false;
		state.paused = false;
		state.remaining = seconds * 1000;
		state.lastTick = Date.now();
		state.varSeen = seconds;
		state.stage = STAGES.NONE;

		if (!state.element) state.element = createTimerElement(formatTime(state.remaining));
	};

	const shutdownTimer = () => {
		state.active = false;
		state.finishing = false;
		state.stage = STAGES.NONE;
		stopStageAudio();
		removeTimerElement();
	};

	// natural zero: flag it, close the var, play the game over sting, then slide away
	const finishTimer = () => {
		state.finishing = true;
		state.remaining = 0;
		stopStageAudio();
		game.trigger("var[sunshinetimerzeroed]=1");
		clearTimerVar();

		if (state.element) state.element.textContent = formatTime(0);

		game.sound.play(SUNSHINE_GAMEOVER_SFX, false, () => shutdownTimer());
	};

	const updateStage = () => {
		if (state.remaining <= FAST_STAGE_MS && state.stage < STAGES.FAST) {
			state.stage = STAGES.FAST;
			stopStageAudio();
			state.stageAudio = game.sound.play(SUNSHINE_FAST_SFX, false);
		} else if (state.remaining <= SLOW_STAGE_MS && state.stage < STAGES.SLOW) {
			state.stage = STAGES.SLOW;
			state.stageAudio = game.sound.play(SUNSHINE_TIMER_SFX, false);
		}
	};

	if (game.player.sunshineTimerHooked) return;
	game.player.sunshineTimerHooked = true;

	const originalUpdate = game.player.update.bind(game.player);
	game.player.update = function() {
		originalUpdate();

		const timerVar = +game.map.getVar("sunshinetimer", 0) || 0;

		if (!state.active) {
			if (timerVar >= 1) startTimer(timerVar);
			return;
		}

		if (state.finishing) return;

		// zeroing the var early cancels quietly, no game over sting
		if (timerVar === 0) {
			shutdownTimer();
			return;
		}

		if (timerVar !== state.varSeen) {
			state.varSeen = timerVar;
			state.remaining = timerVar * 1000;
			state.stage = STAGES.NONE;
			stopStageAudio();
		}

		// losing control (trigger freezes, cutscenes, textboxes) halts the clock unless overridden
		const ignoreFreeze = (+game.map.getVar("sunshinetimerignorefreeze", 0) || 0) === 1;
		const controlFrozen = !ignoreFreeze &&
			(game.player.frozen || !game.player.canMove || game.textbox.active > -1);

		const pausedNow = controlFrozen || (+game.map.getVar("sunshinetimerpause", 0) || 0) === 1;
		if (pausedNow !== state.paused) {
			state.paused = pausedNow;
			if (state.stageAudio) {
				if (pausedNow) state.stageAudio.pause();
				else {
					const resume = state.stageAudio.play();
					if (resume) resume.catch(() => {});
				}
			}
		}

		const now = Date.now();
		if (!state.paused) state.remaining -= now - state.lastTick;
		state.lastTick = now;

		if (state.remaining <= 0) {
			finishTimer();
			return;
		}

		updateStage();

		if (state.element) state.element.textContent = formatTime(state.remaining);
	};
})(game)
