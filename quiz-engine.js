(async () => {
  "use strict";

  const QUESTION_HUB = "../question emoji.html";
  const APP_HOME = "../Program Mental Health.html";

  const numbered = (prefix, start = 1, end = 10, suffix = ".html") => {
    return Array.from({ length: end - start + 1 }, (_, index) => {
      return `${prefix}${start + index}${suffix}`;
    });
  };

  let QUIZ_SETS = {};

  const normalizeQuizSets = (config) => {
    const sourceSets = config && typeof config === "object" ? config.sets : null;
    const defaultDoneUrl =
      config && typeof config.questionHub === "string" && config.questionHub.trim()
        ? config.questionHub.trim()
        : QUESTION_HUB;

    if (!sourceSets || typeof sourceSets !== "object") {
      return {};
    }

    const out = {};
    Object.entries(sourceSets).forEach(([folder, raw]) => {
      if (!raw || typeof raw !== "object") {
        return;
      }

      let pages = [];
      if (Array.isArray(raw.pages)) {
        pages = raw.pages.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
      } else if (raw.pattern && typeof raw.pattern === "object") {
        const prefix = String(raw.pattern.prefix || "");
        const start = Number(raw.pattern.start || 1);
        const end = Number(raw.pattern.end || 10);
        const suffix = String(raw.pattern.suffix || ".html");
        if (prefix && Number.isInteger(start) && Number.isInteger(end) && start <= end) {
          pages = numbered(prefix, start, end, suffix);
        }
      }

      const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : "";
      if (!id || !pages.length) {
        return;
      }

      out[folder] = {
        id,
        pages,
        doneUrl: typeof raw.doneUrl === "string" && raw.doneUrl.trim() ? raw.doneUrl.trim() : defaultDoneUrl,
      };
    });

    return out;
  };

  const loadQuizSets = async () => {
    try {
      const response = await fetch("/api/quiz/config");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load quiz config");
      }
      QUIZ_SETS = normalizeQuizSets(data);
      return Object.keys(QUIZ_SETS).length > 0;
    } catch (error) {
      console.error("Failed to load quiz config:", error);
      return false;
    }
  };

  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const parseCurrentPage = () => {
    const cleanPath = decode(window.location.pathname).replace(/\\/g, "/");
    const parts = cleanPath.split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return {
      folder: parts[parts.length - 2],
      file: parts[parts.length - 1],
    };
  };

  const shuffle = (items) => {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const loadState = (key) => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveState = (key, state) => {
    sessionStorage.setItem(key, JSON.stringify(state));
  };

  const makeFreshState = (pages) => {
    return {
      order: shuffle(pages),
      index: 0,
      score: 0,
      answered: {},
    };
  };

  const isValidState = (state, pages) => {
    if (!state || typeof state !== "object") {
      return false;
    }
    if (!Array.isArray(state.order) || state.order.length !== pages.length) {
      return false;
    }
    const allUnique = new Set(state.order);
    if (allUnique.size !== pages.length) {
      return false;
    }
    if (!state.order.every((name) => pages.includes(name))) {
      return false;
    }
    if (!Number.isInteger(state.index) || state.index < 0 || state.index >= pages.length) {
      return false;
    }
    if (!Number.isInteger(state.score) || state.score < 0 || state.score > pages.length) {
      return false;
    }
    if (!state.answered || typeof state.answered !== "object") {
      return false;
    }
    return true;
  };

  const goToFile = (fileName) => {
    window.location.href = encodeURI(fileName);
  };

  const ensureResultModalStyles = () => {
    if (document.getElementById("quiz-result-modal-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "quiz-result-modal-styles";
    style.textContent = `
      .quiz-result-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(16, 2, 28, 0.62);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9999;
        animation: quizOverlayIn 180ms ease-out;
      }

      .quiz-result-card {
        width: min(460px, 100%);
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.32);
        color: #fff;
        background:
          radial-gradient(circle at 12% 20%, rgba(255, 106, 213, 0.34), transparent 40%),
          radial-gradient(circle at 90% 10%, rgba(192, 132, 252, 0.34), transparent 35%),
          linear-gradient(145deg, rgba(68, 14, 104, 0.96), rgba(127, 29, 127, 0.94));
        box-shadow: 0 16px 40px rgba(8, 2, 18, 0.5);
        padding: 22px 18px 18px;
        text-align: center;
        animation: quizCardIn 230ms ease-out;
      }

      .quiz-result-badge {
        width: 68px;
        height: 68px;
        margin: 0 auto 12px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-size: 28px;
        font-weight: 800;
        color: #fff;
        background: linear-gradient(135deg, #f97316, #facc15);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
      }

      .quiz-result-title {
        margin: 0;
        font-size: 1.35rem;
        letter-spacing: 0.02em;
      }

      .quiz-result-score {
        margin: 10px 0 0;
        font-size: 1.05rem;
        color: #f8ddff;
        line-height: 1.5;
      }

      .quiz-result-actions {
        margin-top: 16px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .quiz-result-btn {
        border: none;
        border-radius: 10px;
        padding: 11px 12px;
        font-size: 0.98rem;
        font-weight: 700;
        cursor: pointer;
        transition: transform 120ms ease, filter 120ms ease;
      }

      .quiz-result-btn:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
      }

      .quiz-result-btn:active {
        transform: translateY(0);
      }

      .quiz-result-btn:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.92);
        outline-offset: 2px;
      }

      .quiz-result-btn-ok {
        color: #2f1146;
        background: linear-gradient(135deg, #fdf2ff, #f8ddff);
      }

      .quiz-result-btn-next {
        color: #fff;
        background: linear-gradient(135deg, #d946ef, #a855f7);
      }

      @keyframes quizOverlayIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes quizCardIn {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureTopNavStyles = () => {
    if (document.getElementById("quiz-top-nav-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "quiz-top-nav-styles";
    style.textContent = `
      .quiz-top-nav {
        position: fixed;
        top: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 9998;
        pointer-events: none;
      }

      .quiz-nav-btn {
        pointer-events: auto;
        width: 48px;
        height: 48px;
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.2), rgba(148, 163, 184, 0.08));
        color: #fff;
        font-size: 22px;
        font-weight: 700;
        display: grid;
        place-items: center;
        cursor: pointer;
        box-shadow: 0 8px 22px rgba(16, 2, 28, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }

      .quiz-nav-btn:hover {
        transform: translateY(-1px) scale(1.03);
        border-color: rgba(255, 106, 213, 0.95);
        box-shadow: 0 0 0 4px rgba(255, 106, 213, 0.18), 0 10px 24px rgba(16, 2, 28, 0.45);
      }

      .quiz-nav-btn:active {
        transform: scale(0.97);
      }

      .quiz-nav-btn:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.95);
        outline-offset: 2px;
      }

      @media (max-width: 768px) {
        .quiz-top-nav {
          top: 10px;
          left: 10px;
          right: 10px;
        }

        .quiz-nav-btn {
          width: 44px;
          height: 44px;
          font-size: 20px;
        }
      }
    `;

    document.head.appendChild(style);
  };

  const mountTopNav = ({ homeUrl, fallbackBackUrl }) => {
    if (document.querySelector(".quiz-top-nav")) {
      return;
    }

    ensureTopNavStyles();

    const topNav = document.createElement("div");
    topNav.className = "quiz-top-nav";
    topNav.innerHTML = `
      <button type="button" class="quiz-nav-btn quiz-nav-back" aria-label="Back" title="Back">&#x2190;</button>
      <button type="button" class="quiz-nav-btn quiz-nav-home" aria-label="Home" title="Home">&#x2302;</button>
    `;

    const backBtn = topNav.querySelector(".quiz-nav-back");
    const homeBtn = topNav.querySelector(".quiz-nav-home");

    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = fallbackBackUrl;
    });

    homeBtn.addEventListener("click", () => {
      window.location.href = homeUrl;
    });

    document.body.appendChild(topNav);
  };

  const showResultModal = ({ score, total, onOk, onNext }) => {
    ensureResultModalStyles();

    const overlay = document.createElement("div");
    overlay.className = "quiz-result-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Quiz result");

    overlay.innerHTML = `
      <div class="quiz-result-card">
        <div class="quiz-result-badge">10</div>
        <h3 class="quiz-result-title">Quiz Completed</h3>
        <p class="quiz-result-score">You got <strong>${score}/${total}</strong> correct.</p>
        <div class="quiz-result-actions">
          <button type="button" class="quiz-result-btn quiz-result-btn-ok">OK</button>
          <button type="button" class="quiz-result-btn quiz-result-btn-next">Next</button>
        </div>
      </div>
    `;

    const okBtn = overlay.querySelector(".quiz-result-btn-ok");
    const nextBtn = overlay.querySelector(".quiz-result-btn-next");

    const removeModal = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    okBtn.addEventListener("click", () => {
      removeModal();
      if (typeof onOk === "function") {
        onOk();
      }
    });

    nextBtn.addEventListener("click", () => {
      removeModal();
      if (typeof onNext === "function") {
        onNext();
      }
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        removeModal();
        if (typeof onOk === "function") {
          onOk();
        }
      }
    });

    document.body.appendChild(overlay);
    okBtn.focus();
  };

  const current = parseCurrentPage();
  if (!current) {
    return;
  }

  const configLoaded = await loadQuizSets();
  if (!configLoaded) {
    return;
  }

  const quiz = QUIZ_SETS[current.folder];
  if (!quiz || !quiz.pages.includes(current.file)) {
    return;
  }

  mountTopNav({
    homeUrl: APP_HOME,
    fallbackBackUrl: quiz.doneUrl,
  });

  const params = new URLSearchParams(window.location.search);
  const startRequested = params.get("start") === "1";
  const stateKey = `emotion-quiz:${quiz.id}`;
  const total = quiz.pages.length;

  let state = loadState(stateKey);
  if (!isValidState(state, quiz.pages) || startRequested) {
    state = makeFreshState(quiz.pages);
    saveState(stateKey, state);
  }

  const currentIndexInOrder = state.order.indexOf(current.file);
  if (currentIndexInOrder === -1) {
    state = makeFreshState(quiz.pages);
    saveState(stateKey, state);
    goToFile(state.order[0]);
    return;
  }

  if (startRequested && state.order[0] !== current.file) {
    goToFile(state.order[0]);
    return;
  }

  if (state.index !== currentIndexInOrder) {
    state.index = currentIndexInOrder;
    saveState(stateKey, state);
  }

  if (startRequested) {
    window.history.replaceState({}, "", encodeURI(current.file));
  }

  const heading = document.querySelector(".quiz-box h1");
  if (heading) {
    const fallbackPrefix = heading.textContent.replace(/Question\s*\d+/i, "").trim();
    const nextLabel = `Question ${state.index + 1}`;
    if (/Question\s*\d+/i.test(heading.textContent)) {
      heading.textContent = heading.textContent.replace(/Question\s*\d+/i, nextLabel);
    } else if (fallbackPrefix) {
      heading.textContent = `${fallbackPrefix} ${nextLabel}`;
    } else {
      heading.textContent = nextLabel;
    }
  }

  const options = document.querySelectorAll(".option");
  const submitBtn = document.querySelector(".submit-btn");
  if (!options.length || !submitBtn) {
    return;
  }

  let selectedOption = null;

  options.forEach((option) => {
    option.addEventListener("click", () => {
      if (selectedOption) {
        return;
      }

      options.forEach((btn) => btn.classList.remove("selected"));
      option.classList.add("selected");
      selectedOption = option;

      options.forEach((opt) => {
        if (opt.dataset.correct === "true") {
          opt.classList.add("correct");
        } else {
          opt.classList.add("wrong");
        }
      });
    });
  });

  submitBtn.addEventListener("click", () => {
    if (!selectedOption) {
      alert("Please select an answer before submitting!");
      return;
    }

    const alreadyAnswered = Object.prototype.hasOwnProperty.call(state.answered, current.file);
    if (!alreadyAnswered) {
      const isCorrect = selectedOption.dataset.correct === "true";
      state.answered[current.file] = isCorrect;
      if (isCorrect) {
        state.score += 1;
      }
    }

    const nextIndex = state.index + 1;
    if (nextIndex >= total) {
      saveState(stateKey, state);
      showResultModal({
        score: state.score,
        total,
        onOk: () => {},
        onNext: () => {
          sessionStorage.removeItem(stateKey);
          window.location.href = quiz.doneUrl;
        },
      });
      return;
    }

    state.index = nextIndex;
    saveState(stateKey, state);
    goToFile(state.order[nextIndex]);
  });
})();
