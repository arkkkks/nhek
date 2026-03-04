const startBtn = document.getElementById("startBtn");
const continueBtn = document.getElementById("continueBtn");
const scene = document.getElementById("scene");
const timeDisplay = document.getElementById("time");

const characterImage = document.getElementById("character");
const customCharacter = document.getElementById("customCharacter");
const walkFigure = document.getElementById("walkFigure");

const hoursInput = document.getElementById("hours");
const minutesInput = document.getElementById("minutes");
const secondsInput = document.getElementById("seconds");
const speedButtons = document.querySelectorAll(".speed-controls button");

const presetOptions = document.querySelectorAll(".human-option[data-character]");
const openCreatorBtn = document.getElementById("openCreatorBtn");
const creatorModal = document.getElementById("creatorModal");
const creatorFigure = document.getElementById("creatorFigure");
const closeCreatorBtn = document.getElementById("closeCreatorBtn");
const clearObjectsBtn = document.getElementById("clearObjectsBtn");
const useCreatorBtn = document.getElementById("useCreatorBtn");

const creatorGender = document.getElementById("creatorGender");
const creatorTop = document.getElementById("creatorTop");
const creatorBottom = document.getElementById("creatorBottom");
const creatorHat = document.getElementById("creatorHat");
const creatorShoes = document.getElementById("creatorShoes");
const creatorAccessory = document.getElementById("creatorAccessory");
const creatorSkinColor = document.getElementById("creatorSkinColor");
const creatorHairColor = document.getElementById("creatorHairColor");
const creatorTopColor = document.getElementById("creatorTopColor");
const creatorBottomColor = document.getElementById("creatorBottomColor");
const creatorHatColor = document.getElementById("creatorHatColor");
const creatorShoeColor = document.getElementById("creatorShoeColor");

const OBJECT_PARTS = ["wig", "top", "bottom", "dress", "hat", "shoes", "accessory"];
const creatorObjectInputs = {
    wig: document.getElementById("creatorObjectWig"),
    top: document.getElementById("creatorObjectTop"),
    bottom: document.getElementById("creatorObjectBottom"),
    dress: document.getElementById("creatorObjectDress"),
    hat: document.getElementById("creatorObjectHat"),
    shoes: document.getElementById("creatorObjectShoes"),
    accessory: document.getElementById("creatorObjectAccessory")
};

const creatorFields = [
    creatorGender,
    creatorTop,
    creatorBottom,
    creatorHat,
    creatorShoes,
    creatorAccessory,
    creatorSkinColor,
    creatorHairColor,
    creatorTopColor,
    creatorBottomColor,
    creatorHatColor,
    creatorShoeColor
];

let countdown = null;
let isRunning = false;
let remainingSeconds = 0;
let creatorObjectMap = {
    wig: "",
    top: "",
    bottom: "",
    dress: "",
    hat: "",
    shoes: "",
    accessory: ""
};
let appliedObjectMap = { ...creatorObjectMap };

const CHARACTER_CONFIG = {
    traveler: { src: "walk-walking.gif", className: "char-traveler" },
    sport: { src: "walk-walking.gif", className: "char-sport" },
    sunset: { src: "walk-walking.gif", className: "char-sunset" },
    classic: { src: "walk-walking.gif", className: "char-classic" }
};

const DEFAULT_CUSTOM_CONFIG = {
    gender: "boy",
    top: "hoodie",
    bottom: "pants",
    hat: "cap",
    shoes: "sneakers",
    accessory: "none",
    skinColor: "#f2be93",
    hairColor: "#352319",
    topColor: "#4b8f4b",
    bottomColor: "#55463e",
    hatColor: "#7b3f00",
    shoeColor: "#f5d64f"
};

function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds);
    const hrs = Math.floor(safeSeconds / 3600);
    const mins = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startWalking() {
    isRunning = true;
    scene.classList.add("is-walking");
    scene.classList.remove("character-paused");
}

function stopWalking() {
    isRunning = false;
    scene.classList.remove("is-walking");
    scene.classList.remove("character-paused");
}

function runCountdown() {
    clearInterval(countdown);
    countdown = setInterval(() => {
        remainingSeconds -= 1;
        timeDisplay.textContent = formatTime(remainingSeconds);

        if (remainingSeconds <= 0) {
            clearInterval(countdown);
            stopWalking();
            continueBtn.classList.add("hidden");
            alert("Time is up.");
        }
    }, 1000);
}

function pauseSession() {
    if (!isRunning) {
        return;
    }

    clearInterval(countdown);
    isRunning = false;
    scene.classList.remove("is-walking");
    scene.classList.add("character-paused");
    continueBtn.classList.remove("hidden");
}

function toSafeNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
        return 0;
    }
    return Math.floor(num);
}

function readTotalSeconds() {
    const hours = toSafeNumber(hoursInput.value);
    const minutes = toSafeNumber(minutesInput.value);
    const seconds = toSafeNumber(secondsInput.value);
    const total = (hours * 3600) + (minutes * 60) + seconds;
    if (total <= 0) {
        return 180;
    }
    return total;
}

function markPresetSelection(selectedKey) {
    presetOptions.forEach((option) => {
        const selected = option.getAttribute("data-character") === selectedKey;
        option.classList.toggle("is-active", selected);
        option.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    openCreatorBtn.classList.remove("is-active");
    openCreatorBtn.setAttribute("aria-pressed", "false");
}

function activateCustomSelection() {
    presetOptions.forEach((option) => {
        option.classList.remove("is-active");
        option.setAttribute("aria-pressed", "false");
    });
    openCreatorBtn.classList.add("is-active");
    openCreatorBtn.setAttribute("aria-pressed", "true");
}

function showPresetCharacter() {
    characterImage.classList.remove("hidden");
    customCharacter.classList.add("hidden");
    customCharacter.setAttribute("aria-hidden", "true");
    characterImage.setAttribute("aria-hidden", "false");
}

function showCustomCharacter() {
    characterImage.classList.add("hidden");
    customCharacter.classList.remove("hidden");
    characterImage.setAttribute("aria-hidden", "true");
    customCharacter.setAttribute("aria-hidden", "false");
}

function selectPresetCharacter(characterKey) {
    const config = CHARACTER_CONFIG[characterKey];
    if (!config) {
        return;
    }

    characterImage.src = config.src;
    characterImage.classList.remove(
        "char-traveler",
        "char-sport",
        "char-sunset",
        "char-classic"
    );
    characterImage.classList.add(config.className);
    showPresetCharacter();
    markPresetSelection(characterKey);
}

function applyConfigToFigure(figure, config) {
    figure.setAttribute("data-gender", config.gender);
    figure.setAttribute("data-top", config.top);
    figure.setAttribute("data-bottom", config.bottom);
    figure.setAttribute("data-hat", config.hat);
    figure.setAttribute("data-shoes", config.shoes);
    figure.setAttribute("data-accessory", config.accessory);

    figure.style.setProperty("--skin-color", config.skinColor);
    figure.style.setProperty("--hair-color", config.hairColor);
    figure.style.setProperty("--top-color", config.topColor);
    figure.style.setProperty("--bottom-color", config.bottomColor);
    figure.style.setProperty("--hat-color", config.hatColor);
    figure.style.setProperty("--shoe-color", config.shoeColor);
}

function setObjectImage(figure, part, src) {
    const hasImage = Boolean(src);
    figure.classList.toggle(`use-object-${part}`, hasImage);

    if (part === "shoes") {
        const left = figure.querySelector(".object-shoes-left");
        const right = figure.querySelector(".object-shoes-right");
        [left, right].forEach((img) => {
            if (!img) {
                return;
            }
            img.src = hasImage ? src : "";
            img.classList.toggle("is-visible", hasImage);
        });
        return;
    }

    const img = figure.querySelector(`.object-${part}`);
    if (!img) {
        return;
    }
    img.src = hasImage ? src : "";
    img.classList.toggle("is-visible", hasImage);
}

function applyObjectMapToFigure(figure, objectMap) {
    OBJECT_PARTS.forEach((part) => {
        setObjectImage(figure, part, objectMap[part] || "");
    });
}

function readCreatorConfig() {
    return {
        gender: creatorGender.value,
        top: creatorTop.value,
        bottom: creatorBottom.value,
        hat: creatorHat.value,
        shoes: creatorShoes.value,
        accessory: creatorAccessory.value,
        skinColor: creatorSkinColor.value,
        hairColor: creatorHairColor.value,
        topColor: creatorTopColor.value,
        bottomColor: creatorBottomColor.value,
        hatColor: creatorHatColor.value,
        shoeColor: creatorShoeColor.value
    };
}

function syncCreatorPreview() {
    applyConfigToFigure(creatorFigure, readCreatorConfig());
    applyObjectMapToFigure(creatorFigure, creatorObjectMap);
}

function setCreatorControls(config) {
    creatorGender.value = config.gender;
    creatorTop.value = config.top;
    creatorBottom.value = config.bottom;
    creatorHat.value = config.hat;
    creatorShoes.value = config.shoes;
    creatorAccessory.value = config.accessory;
    creatorSkinColor.value = config.skinColor;
    creatorHairColor.value = config.hairColor;
    creatorTopColor.value = config.topColor;
    creatorBottomColor.value = config.bottomColor;
    creatorHatColor.value = config.hatColor;
    creatorShoeColor.value = config.shoeColor;
    syncCreatorPreview();
}

function openCreatorModal() {
    syncCreatorPreview();
    creatorModal.classList.remove("hidden");
}

function closeCreatorModal() {
    creatorModal.classList.add("hidden");
}

function clearCreatorObjects() {
    creatorObjectMap = {
        wig: "",
        top: "",
        bottom: "",
        dress: "",
        hat: "",
        shoes: "",
        accessory: ""
    };
    Object.values(creatorObjectInputs).forEach((input) => {
        input.value = "";
    });
    syncCreatorPreview();
}

startBtn.addEventListener("click", () => {
    clearInterval(countdown);

    remainingSeconds = readTotalSeconds();
    timeDisplay.textContent = formatTime(remainingSeconds);
    continueBtn.classList.add("hidden");
    startWalking();
    runCountdown();
});

continueBtn.addEventListener("click", () => {
    if (remainingSeconds <= 0 || isRunning) {
        return;
    }

    continueBtn.classList.add("hidden");
    startWalking();
    runCountdown();
});

speedButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const speed = Number(button.getAttribute("data-speed"));
        if (!Number.isFinite(speed) || speed <= 0) {
            return;
        }

        scene.style.setProperty("--bg-speed", `${speed}s`);
        const bob = Math.max(0.35, speed / 20);
        scene.style.setProperty("--bob-speed", `${bob.toFixed(2)}s`);

        if (speed === 12 && isRunning) {
            pauseSession();
            return;
        }

        if (isRunning) {
            scene.classList.remove("character-paused");
        }
    });
});

presetOptions.forEach((option) => {
    option.addEventListener("click", () => {
        selectPresetCharacter(option.getAttribute("data-character"));
    });
});

openCreatorBtn.addEventListener("click", () => {
    openCreatorModal();
});

closeCreatorBtn.addEventListener("click", () => {
    closeCreatorModal();
});

clearObjectsBtn.addEventListener("click", () => {
    clearCreatorObjects();
});

useCreatorBtn.addEventListener("click", () => {
    const customConfig = readCreatorConfig();
    applyConfigToFigure(walkFigure, customConfig);
    appliedObjectMap = { ...creatorObjectMap };
    applyObjectMapToFigure(walkFigure, appliedObjectMap);
    showCustomCharacter();
    activateCustomSelection();
    closeCreatorModal();
});

creatorModal.addEventListener("click", (event) => {
    if (event.target === creatorModal) {
        closeCreatorModal();
    }
});

creatorFields.forEach((field) => {
    field.addEventListener("input", syncCreatorPreview);
    field.addEventListener("change", syncCreatorPreview);
});

OBJECT_PARTS.forEach((part) => {
    const input = creatorObjectInputs[part];
    input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        creatorObjectMap[part] = file ? URL.createObjectURL(file) : "";
        syncCreatorPreview();
    });
});

setCreatorControls(DEFAULT_CUSTOM_CONFIG);
applyConfigToFigure(walkFigure, DEFAULT_CUSTOM_CONFIG);
applyObjectMapToFigure(creatorFigure, creatorObjectMap);
applyObjectMapToFigure(walkFigure, appliedObjectMap);
selectPresetCharacter("traveler");
