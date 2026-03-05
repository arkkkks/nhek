const scene = document.getElementById("scene");
const startBtn = document.getElementById("startBtn");
const stepDisplay = document.getElementById("stepDisplay");
const speedButtons = document.querySelectorAll(".speed-btn");
const characterImage = document.getElementById("character");

const timerWrap = document.getElementById("wtimer");
const timerDisplay = document.getElementById("tdisp");
const timerProgress = document.getElementById("tpg");
const timerPlayPauseBtn = document.getElementById("tpp");
const timerResetBtn = document.getElementById("trs");
const timerAddMinBtn = document.getElementById("addMinBtn");

const timerModal = document.getElementById("timerM");
const timerCloseBtn = document.getElementById("closeTMBtn");
const timerSetBtn = document.getElementById("setTValBtn");
const timerHoursInput = document.getElementById("inH");
const timerMinutesInput = document.getElementById("inM");
const timerSecondsInput = document.getElementById("inS");
const finishModal = document.getElementById("finishM");
const finishMessage = document.getElementById("finishMsg");
const finishOkBtn = document.getElementById("finishOkBtn");

const SPEED = {
    slow: { rate: 0.9, stepMs: 670, runShift: "3px" },
    fast: { rate: 2.2, stepMs: 170, runShift: "20px" }
};

let running = false;
let speedMode = "slow";
let steps = 0;
let stepInterval = null;

let timerTotal = 150;
let timerLeft = 150;
let timerInterval = null;
let timerOn = false;
let finishAlarmLock = false;

function updateStepDisplay() {
    stepDisplay.textContent = `\uD83D\uDC63 ${steps.toLocaleString()} steps`;
}

function updateSpeedButtons() {
    speedButtons.forEach((button) => {
        const isActive = button.getAttribute("data-speed") === speedMode;
        button.classList.toggle("is-active", isActive);
    });
}

function startStepCounter() {
    clearInterval(stepInterval);
    stepInterval = setInterval(() => {
        steps += 1;
        updateStepDisplay();
    }, SPEED[speedMode].stepMs);
}

function stopStepCounter() {
    clearInterval(stepInterval);
    stepInterval = null;
}

function syncScenePlaybackRate() {
    const rate = SPEED[speedMode].rate;
    const animations = scene.getAnimations({ subtree: true });
    animations.forEach((animation) => {
        if (animation.playState !== "finished") {
            animation.playbackRate = rate;
        }
    });
}

function applySpeed(mode) {
    if (!SPEED[mode]) {
        return;
    }

    const wasRunning = running;
    speedMode = mode;
    scene.style.setProperty("--run-shift", SPEED[mode].runShift);
    updateSpeedButtons();
    scene.classList.toggle("fast-mode", mode === "fast");
    characterImage.classList.toggle("is-fast", mode === "fast");

    if (wasRunning) {
        // Keep the run active while only changing speed.
        running = true;
        scene.classList.add("is-walking");
        startBtn.innerHTML = "&#9646;&#9646; PAUSE";
        startBtn.classList.add("running");
        startStepCounter();
        syncScenePlaybackRate();
    }
}

function startRun() {
    if (running) {
        return;
    }
    if (timerTotal <= 0) {
        alert("Set timer first.");
        return;
    }
    if (timerLeft <= 0) {
        timerLeft = timerTotal;
        updateTimerDisplay();
    }

    running = true;
    scene.classList.add("is-walking");
    scene.classList.remove("character-paused");
    characterImage.classList.toggle("is-fast", speedMode === "fast");
    startBtn.innerHTML = "&#9646;&#9646; PAUSE";
    startBtn.classList.add("running");
    startStepCounter();
    if (!timerOn) {
        startTimer();
    }
    requestAnimationFrame(syncScenePlaybackRate);
}

function stopRun(options = {}) {
    const { pauseTimerToo = true, keepFastMode = false } = options;

    running = false;
    scene.classList.remove("is-walking");
    scene.classList.remove("character-paused");
    startBtn.innerHTML = "&#9654; START";
    startBtn.classList.remove("running");
    characterImage.classList.remove("is-fast");
    if (!keepFastMode) {
        scene.classList.remove("fast-mode");
    }
    if (pauseTimerToo) {
        pauseTimer();
    }
    stopStepCounter();
}

function toggleRun() {
    if (running) {
        stopRun();
    } else {
        startRun();
    }
}

function updateTimerDisplay() {
    const hours = Math.floor(timerLeft / 3600);
    const minutes = Math.floor((timerLeft % 3600) / 60);
    const seconds = timerLeft % 60;

    if (hours > 0) {
        timerDisplay.textContent = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    } else {
        timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    const ratio = timerTotal > 0 ? timerLeft / timerTotal : 0;
    timerProgress.style.strokeDashoffset = `${325 * (1 - ratio)}`;
}

function triggerFinishAlarm(message) {
    if (finishAlarmLock) {
        return;
    }
    finishAlarmLock = true;

    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            const audioCtx = new AudioCtx();
            const ringPattern = [
                { freq: 880, duration: 0.52 },
                { freq: 760, duration: 0.52 },
                { freq: 980, duration: 0.72 }
            ];
            let t = audioCtx.currentTime;

            ringPattern.forEach((tone) => {
                const oscillator = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                oscillator.type = "sine";
                oscillator.frequency.setValueAtTime(tone.freq, t);

                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.linearRampToValueAtTime(0.085, t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.duration);

                oscillator.connect(gain);
                gain.connect(audioCtx.destination);
                oscillator.start(t);
                oscillator.stop(t + tone.duration);
                t += tone.duration + 0.09;
            });

            setTimeout(() => {
                audioCtx.close().catch(() => {});
            }, Math.max(0, (t - audioCtx.currentTime + 0.25) * 1000));
        }
    } catch (error) {
        // Ignore audio errors and still alert.
    }

    if (navigator.vibrate) {
        navigator.vibrate([280, 120, 280, 120, 280]);
    }
    finishMessage.textContent = message;
    finishModal.classList.add("open");
}

function closeFinishModal() {
    finishModal.classList.remove("open");
    finishAlarmLock = false;
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerOn = false;
    timerPlayPauseBtn.innerHTML = "&#9654;";
}

function startTimer() {
    if (timerLeft <= 0) {
        return;
    }

    timerOn = true;
    timerPlayPauseBtn.innerHTML = "&#9646;&#9646;";
    timerInterval = setInterval(() => {
        timerLeft -= 1;
        updateTimerDisplay();
        if (timerLeft <= 0) {
            pauseTimer();
            stopRun({ pauseTimerToo: false, keepFastMode: false });
            triggerFinishAlarm("Your set time is finished!");
        }
    }, 1000);
}

function toggleTimer() {
    if (timerOn) {
        pauseTimer();
        return;
    }
    startTimer();
}

function resetTimer() {
    pauseTimer();
    timerLeft = timerTotal;
    updateTimerDisplay();
}

function addMin() {
    timerTotal += 60;
    timerLeft += 60;
    updateTimerDisplay();
}

function openTM() {
    timerModal.classList.add("open");
}

function closeTM() {
    timerModal.classList.remove("open");
}

function setTVal() {
    const h = parseInt(timerHoursInput.value, 10) || 0;
    const m = parseInt(timerMinutesInput.value, 10) || 0;
    const s = parseInt(timerSecondsInput.value, 10) || 0;

    timerTotal = Math.max(0, (h * 3600) + (m * 60) + s);
    timerLeft = timerTotal;
    pauseTimer();
    updateTimerDisplay();
    closeTM();
}

startBtn.addEventListener("click", toggleRun);

speedButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
        event.preventDefault();
        applySpeed(button.getAttribute("data-speed"));
    });
});

timerWrap.addEventListener("click", () => {
    openTM();
});

timerPlayPauseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleTimer();
});

timerResetBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    resetTimer();
});

timerAddMinBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    addMin();
});

timerCloseBtn.addEventListener("click", closeTM);
timerSetBtn.addEventListener("click", setTVal);

timerModal.addEventListener("click", (event) => {
    if (event.target === timerModal) {
        closeTM();
    }
});

finishOkBtn.addEventListener("click", closeFinishModal);
finishModal.addEventListener("click", (event) => {
    if (event.target === finishModal) {
        closeFinishModal();
    }
});

applySpeed("slow");
updateStepDisplay();
updateTimerDisplay();
