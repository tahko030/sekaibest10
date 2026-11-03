(function () {
  "use strict";

  const app = window.ProsekaApp;
  let state = app.loadState();

  const elements = {
    stage: document.querySelector("#progress-stage"),
    detail: document.querySelector("#progress-detail"),
    bar: document.querySelector("#progress-bar"),
    leftFrame: document.querySelector("#left-player"),
    rightFrame: document.querySelector("#right-player"),
    leftCard: document.querySelector("#left-card"),
    rightCard: document.querySelector("#right-card"),
    leftUnit: document.querySelector("#left-unit"),
    rightUnit: document.querySelector("#right-unit"),
    leftTitle: document.querySelector("#left-title"),
    rightTitle: document.querySelector("#right-title"),
    leftMeta: document.querySelector("#left-meta"),
    rightMeta: document.querySelector("#right-meta"),
    leftChoose: document.querySelector("#left-choose"),
    rightChoose: document.querySelector("#right-choose"),
    bothLike: document.querySelector("#both-like-button"),
    skip: document.querySelector("#skip-button"),
    bothDislike: document.querySelector("#both-dislike-button"),
    undo: document.querySelector("#undo-button"),
    status: document.querySelector("#sorter-status"),
  };
  const players = { left: null, right: null };

  function copyRating(rating) {
    return { ...rating };
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function createHistoryEntry(type, pair) {
    return {
      type,
      pair: [...pair],
      previousRatings: {
        [pair[0]]: copyRating(state.ratings[pair[0]]),
        [pair[1]]: copyRating(state.ratings[pair[1]]),
      },
      stage: state.stage,
      stagePool: [...state.stagePool],
      nextPool: [...state.nextPool],
      activeIds: [...state.activeIds],
      answeredQuestions: state.answeredQuestions,
      rankingQuestions: state.rankingQuestions,
      comparedPairsLength: state.comparedPairs.length,
      skippedPairsLength: state.skippedPairs.length,
      skipRewardedPairsLength: state.skipRewardedPairs.length,
      complete: state.complete,
    };
  }

  function advanceStageIfNeeded() {
    if (state.stage === "round1" && state.stagePool.length === 0) {
      state.stage = "round2";
      state.stagePool = [...state.nextPool];
      state.nextPool = [];
    }
    if (state.stage === "round2" && state.stagePool.length === 0) {
      state.stage = "ranking";
      state.activeIds = [...state.nextPool];
      state.stagePool = [];
      state.nextPool = [];
    }
    if (state.stage === "ranking" && state.rankingQuestions >= state.rankingTarget) {
      state.stage = "complete";
      state.complete = true;
      state.currentPair = null;
    }
  }

  function eliminationPair() {
    const pool = state.stagePool;
    if (pool.length < 2) return null;
    const firstId = randomItem(pool);
    const others = pool.filter((id) => id !== firstId);
    const compared = new Set(state.comparedPairs);
    const skipped = new Set(state.skippedPairs);
    const unseen = others.filter((id) => {
      const key = app.pairKey(firstId, id);
      return !compared.has(key) && !skipped.has(key);
    });
    const notSkipped = others.filter((id) => !skipped.has(app.pairKey(firstId, id)));
    const secondId = randomItem(unseen.length ? unseen : notSkipped.length ? notSkipped : others);
    return Math.random() < 0.5 ? [firstId, secondId] : [secondId, firstId];
  }

  function rankingPair() {
    const rankedActiveIds = [...state.activeIds].sort((leftId, rightId) => {
      const left = state.ratings[leftId];
      const right = state.ratings[rightId];
      return (
        app.rankingScore(right) - app.rankingScore(left) ||
        right.wins - left.wins ||
        left.losses - right.losses
      );
    });
    const phase = app.getRankingPhase(state);
    const pool =
      phase === "boundary"
        ? rankedActiveIds.slice(6, 18)
        : phase === "top12"
          ? rankedActiveIds.slice(0, 12)
          : rankedActiveIds;
    if (pool.length < 2) return null;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    shuffled.sort(
      (leftId, rightId) =>
        state.ratings[leftId].rankingComparisons -
        state.ratings[rightId].rankingComparisons,
    );
    const firstId = shuffled[0];
    const skipped = new Set(state.skippedPairs);
    const compared = new Set(state.comparedPairs);
    const candidates = pool
      .filter((id) => id !== firstId)
      .map((id) => {
        const key = app.pairKey(firstId, id);
        const first = state.ratings[firstId];
        const second = state.ratings[id];
        return {
          id,
          skipped: skipped.has(key),
          score:
            Math.abs(first.rankingComparisons - second.rankingComparisons) * 400 +
            Math.abs(app.rankingScore(first) - app.rankingScore(second)) +
            (compared.has(key) ? 1200 : 0) +
            Math.random(),
        };
      });
    const available = candidates.filter((candidate) => !candidate.skipped);
    const selected = (available.length ? available : candidates).sort(
      (left, right) => left.score - right.score,
    )[0];
    if (!selected) return null;
    return Math.random() < 0.5 ? [firstId, selected.id] : [selected.id, firstId];
  }

  function nextPair() {
    advanceStageIfNeeded();
    if (state.stage === "complete") return null;
    return state.stage === "ranking" ? rankingPair() : eliminationPair();
  }

  function ensurePair() {
    const pairIsValid =
      Array.isArray(state.currentPair) &&
      state.currentPair.length === 2 &&
      app.SONG_MAP.has(state.currentPair[0]) &&
      app.SONG_MAP.has(state.currentPair[1]);
    if (!pairIsValid) state.currentPair = nextPair();
    if (!state.currentPair) {
      advanceStageIfNeeded();
      app.saveState(state);
      window.location.href = "./results.html";
      return false;
    }
    return true;
  }

  function renderSong(side, song) {
    const color = app.unitColor(song.unit);
    const videoId = app.videoIdFor(song);
    elements[`${side}Card`].style.setProperty("--unit-color", color);
    elements[`${side}Unit`].textContent = song.unit;
    elements[`${side}Title`].textContent = song.title;
    elements[`${side}Meta`].textContent = `${song.creator}｜${song.event}`;
    const player = players[side];
    if (player && typeof player.cueVideoById === "function") {
      player.cueVideoById(videoId);
      player.getIframe().title = `${song.title} YouTube 播放器`;
    } else {
      elements[`${side}Frame`].dataset.videoId = videoId;
    }
  }

  function createPlayer(side, song) {
    const videoId = app.videoIdFor(song);
    const playerVars = { playsinline: 1, rel: 0 };
    if (window.location.protocol === "https:" || window.location.protocol === "http:") {
      playerVars.origin = window.location.origin;
    }
    return new window.YT.Player(`${side}-player`, {
      videoId,
      playerVars,
      events: {
        onReady(event) {
          event.target.getIframe().title = `${song.title} YouTube 播放器`;
        },
        onStateChange(event) {
          if (event.data !== window.YT.PlayerState.PLAYING) return;
          const otherSide = side === "left" ? "right" : "left";
          const otherPlayer = players[otherSide];
          if (otherPlayer && typeof otherPlayer.pauseVideo === "function") otherPlayer.pauseVideo();
        },
        onError(event) {
          if (event.data === 153) {
            elements.status.textContent =
              window.location.protocol === "file:"
                ? "YouTube 無法辨識直接開啟的本機 HTML。請發布到 GitHub Pages，或使用 localhost 預覽。"
                : "YouTube 無法辨識目前網站來源（錯誤 153）。請確認瀏覽器沒有封鎖 Referer，並重新整理頁面。";
          }
        },
      },
    });
  }

  function initializeYouTubePlayers() {
    if (!state.currentPair || players.left || players.right) return;
    players.left = createPlayer("left", app.SONG_MAP.get(state.currentPair[0]));
    players.right = createPlayer("right", app.SONG_MAP.get(state.currentPair[1]));
  }

  window.onYouTubeIframeAPIReady = initializeYouTubePlayers;

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) {
      initializeYouTubePlayers();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  }

  function render() {
    if (!ensurePair()) return;
    const [leftId, rightId] = state.currentPair;
    renderSong("left", app.SONG_MAP.get(leftId));
    renderSong("right", app.SONG_MAP.get(rightId));
    const progress = app.getProgress(state);
    elements.stage.textContent = progress.label;
    elements.detail.textContent = progress.detail;
    elements.bar.style.width = `${progress.percent}%`;
    elements.bar.parentElement.setAttribute("aria-valuenow", String(progress.percent));
    elements.bar.parentElement.setAttribute(
      "aria-valuetext",
      `已完成 ${progress.answeredQuestions} 題，共 ${progress.totalQuestions} 題`,
    );
    elements.undo.disabled = state.history.length === 0;
    elements.undo.setAttribute("aria-disabled", String(state.history.length === 0));
    elements.status.textContent = "";
  }

  function removeFromStagePool(ids) {
    const removed = new Set(ids);
    state.stagePool = state.stagePool.filter((id) => !removed.has(id));
  }

  function applyChoice(winnerId, loserId) {
    const pair = [...state.currentPair];
    state.history.push(createHistoryEntry("choice", pair));
    const winner = state.ratings[winnerId];
    const loser = state.ratings[loserId];
    const rankingPhase = state.stage === "ranking" ? app.getRankingPhase(state) : null;
    const expectedWinner = 1 / (1 + 10 ** ((loser.rating - winner.rating) / 400));
    const expectedLoser = 1 - expectedWinner;
    const k = state.stage === "ranking" ? 32 : 48;
    winner.rating += k * (1 - expectedWinner);
    loser.rating += k * (0 - expectedLoser);
    if (rankingPhase === "top12" && app.rankingScore(winner) <= app.rankingScore(loser)) {
      winner.rating += app.rankingScore(loser) - app.rankingScore(winner) + 1;
    }
    winner.comparisons += 1;
    loser.comparisons += 1;
    winner.wins += 1;
    loser.losses += 1;
    state.comparedPairs.push(app.pairKey(winnerId, loserId));

    if (state.stage === "round1" || state.stage === "round2") {
      const level = state.stage === "round1" ? 1 : 2;
      winner.stageLevel = Math.max(winner.stageLevel, level);
      removeFromStagePool(pair);
      state.nextPool.push(winnerId);
    } else {
      winner.rankingComparisons += 1;
      loser.rankingComparisons += 1;
      state.rankingQuestions += 1;
    }

    state.answeredQuestions += 1;
    state.currentPair = null;
    advanceStageIfNeeded();
    state.currentPair = nextPair();
    app.saveState(state);
    if (state.complete) {
      window.location.href = "./results.html";
    } else {
      render();
    }
  }

  function deferPair(type, adjustment) {
    const pair = [...state.currentPair];
    const key = app.pairKey(pair[0], pair[1]);
    state.history.push(createHistoryEntry(type, pair));
    if (adjustment !== 0 && !state.skipRewardedPairs.includes(key)) {
      pair.forEach((id) => {
        const rating = state.ratings[id];
        rating.skipBonus = Math.max(
          -app.MAX_SKIP_BONUS,
          Math.min(app.MAX_SKIP_BONUS, rating.skipBonus + adjustment),
        );
      });
      state.skipRewardedPairs.push(key);
    }
    if (!state.skippedPairs.includes(key)) state.skippedPairs.push(key);
    state.currentPair = null;
    state.currentPair = nextPair();
    app.saveState(state);
    render();
  }

  function bothLikePair() {
    deferPair("both-like", app.SKIP_BONUS);
  }

  function skipPair() {
    deferPair("skip", 0);
  }

  function bothDislikePair() {
    deferPair("both-dislike", -app.SKIP_BONUS);
  }

  function undoLast() {
    const entry = state.history.pop();
    if (!entry) return;
    Object.entries(entry.previousRatings).forEach(([id, rating]) => {
      state.ratings[id] = rating;
    });
    state.stage = entry.stage;
    state.stagePool = entry.stagePool;
    state.nextPool = entry.nextPool;
    state.activeIds = entry.activeIds;
    state.answeredQuestions = entry.answeredQuestions;
    state.rankingQuestions = entry.rankingQuestions;
    state.comparedPairs.length = entry.comparedPairsLength;
    state.skippedPairs.length = entry.skippedPairsLength;
    state.skipRewardedPairs.length = entry.skipRewardedPairsLength;
    state.currentPair = entry.pair;
    state.complete = entry.complete;
    app.saveState(state);
    render();
  }

  elements.leftChoose.addEventListener("click", () => {
    applyChoice(state.currentPair[0], state.currentPair[1]);
  });
  elements.rightChoose.addEventListener("click", () => {
    applyChoice(state.currentPair[1], state.currentPair[0]);
  });
  elements.bothLike.addEventListener("click", bothLikePair);
  elements.skip.addEventListener("click", skipPair);
  elements.bothDislike.addEventListener("click", bothDislikePair);
  elements.undo.addEventListener("click", undoLast);

  render();
  loadYouTubeApi();
})();
