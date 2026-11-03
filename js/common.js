(function () {
  "use strict";

  const STORAGE_KEY = "proseka-song-sorter-state-v2";
  const SKIP_BONUS = 6;
  const MAX_SKIP_BONUS = 18;
  const STAGE_WEIGHT = 120;
  const REFINEMENT_QUESTIONS = 20;
  const DISCOVERY_QUESTIONS = 20;
  const BOUNDARY_QUESTIONS = 15;
  const TOP_TWELVE_QUESTIONS = 24;
  const SONGS = Array.isArray(window.PROSEKA_SONGS) ? window.PROSEKA_SONGS : [];
  const SONG_MAP = new Map(SONGS.map((song) => [song.id, song]));
  const ROUND_ONE_QUESTIONS = Math.ceil(SONGS.length / 2);
  const ROUND_TWO_COUNT = Math.ceil(ROUND_ONE_QUESTIONS / 2);
  const ROUND_TWO_QUESTIONS = ROUND_TWO_COUNT;
  const FINAL_ACTIVE_COUNT = ROUND_TWO_COUNT;
  const INITIAL_RANKING_QUESTIONS =
    DISCOVERY_QUESTIONS + BOUNDARY_QUESTIONS + TOP_TWELVE_QUESTIONS;
  const INITIAL_TOTAL_QUESTIONS =
    ROUND_ONE_QUESTIONS + ROUND_TWO_QUESTIONS + INITIAL_RANKING_QUESTIONS;

  const UNIT_COLORS = {
    "Leo/need": "#4fa5ff",
    "MORE MORE JUMP!": "#65ed9a",
    "Vivid BAD SQUAD": "#ff5c79",
    "ワンダーランズ×ショウタイム": "#ffcb46",
    "25時、ナイトコードで。": "#a889ff",
    "混合ユニット（ワールドリンク第3弾）": "#45d9d5",
  };

  function createRating() {
    return {
      rating: 1500,
      comparisons: 0,
      rankingComparisons: 0,
      wins: 0,
      losses: 0,
      stageLevel: 0,
      skipBonus: 0,
    };
  }

  function createInitialState() {
    const ratings = {};
    SONGS.forEach((song) => {
      ratings[song.id] = createRating();
    });
    return {
      version: window.PROSEKA_SOURCE_VERSION,
      ratings,
      stage: "round1",
      stagePool: SONGS.map((song) => song.id),
      nextPool: [],
      activeIds: [],
      answeredQuestions: 0,
      rankingQuestions: 0,
      rankingTarget: INITIAL_RANKING_QUESTIONS,
      targetQuestions: INITIAL_TOTAL_QUESTIONS,
      comparedPairs: [],
      skippedPairs: [],
      skipRewardedPairs: [],
      history: [],
      currentPair: null,
      complete: false,
      updatedAt: Date.now(),
    };
  }

  function normalizeRating(rating) {
    const fallback = createRating();
    if (!rating || !Number.isFinite(rating.rating)) return fallback;
    Object.keys(fallback).forEach((key) => {
      if (!Number.isFinite(rating[key])) rating[key] = fallback[key];
    });
    return rating;
  }

  function normalizeState(candidate) {
    if (!candidate || candidate.version !== window.PROSEKA_SOURCE_VERSION) {
      return createInitialState();
    }
    const state = candidate;
    state.ratings = state.ratings || {};
    SONGS.forEach((song) => {
      state.ratings[song.id] = normalizeRating(state.ratings[song.id]);
    });
    state.stage = ["round1", "round2", "ranking", "complete"].includes(state.stage)
      ? state.stage
      : "round1";
    state.stagePool = Array.isArray(state.stagePool) ? state.stagePool : [];
    state.nextPool = Array.isArray(state.nextPool) ? state.nextPool : [];
    state.activeIds = Array.isArray(state.activeIds) ? state.activeIds : [];
    state.answeredQuestions = Number.isFinite(state.answeredQuestions)
      ? state.answeredQuestions
      : 0;
    state.rankingQuestions = Number.isFinite(state.rankingQuestions)
      ? state.rankingQuestions
      : 0;
    state.rankingTarget = Number.isFinite(state.rankingTarget)
      ? state.rankingTarget
      : INITIAL_RANKING_QUESTIONS;
    state.targetQuestions = Number.isFinite(state.targetQuestions)
      ? state.targetQuestions
      : INITIAL_TOTAL_QUESTIONS;
    state.comparedPairs = Array.isArray(state.comparedPairs) ? state.comparedPairs : [];
    state.skippedPairs = Array.isArray(state.skippedPairs) ? state.skippedPairs : [];
    state.skipRewardedPairs = Array.isArray(state.skipRewardedPairs)
      ? state.skipRewardedPairs
      : [];
    state.history = Array.isArray(state.history) ? state.history : [];
    state.currentPair = Array.isArray(state.currentPair) ? state.currentPair : null;
    state.complete = state.stage === "complete" || Boolean(state.complete);
    return state;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
    } catch (error) {
      console.warn("Unable to load saved progress", error);
      return createInitialState();
    }
  }

  function saveState(state) {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    const state = createInitialState();
    saveState(state);
    return state;
  }

  function pairKey(firstId, secondId) {
    return [firstId, secondId].sort().join("::");
  }

  function videoIdFor(songOrId) {
    const song = typeof songOrId === "string" ? SONG_MAP.get(songOrId) : songOrId;
    return song ? song.videoId || song.id : songOrId;
  }

  function rankingScore(rating) {
    return rating.rating + rating.stageLevel * STAGE_WEIGHT + rating.skipBonus;
  }

  function getRankingPhase(state) {
    const answered = state.rankingQuestions || 0;
    if (answered < DISCOVERY_QUESTIONS) return "discovery";
    if (answered < DISCOVERY_QUESTIONS + BOUNDARY_QUESTIONS) return "boundary";
    return "top12";
  }

  function getRankedSongs(state) {
    return [...SONGS].sort((left, right) => {
      const a = state.ratings[left.id] || createRating();
      const b = state.ratings[right.id] || createRating();
      return (
        rankingScore(b) - rankingScore(a) ||
        b.stageLevel - a.stageLevel ||
        b.wins - a.wins ||
        a.losses - b.losses ||
        left.title.localeCompare(right.title, "ja")
      );
    });
  }

  function getStage(state) {
    return state.stage;
  }

  function getProgress(state) {
    const totalQuestions = state.targetQuestions || INITIAL_TOTAL_QUESTIONS;
    const answeredQuestions = Math.min(state.answeredQuestions || 0, totalQuestions);
    const percent = totalQuestions
      ? Math.round((answeredQuestions / totalQuestions) * 100)
      : 0;
    const labels = {
      round1: "全曲比較",
      round2: "喜好確認",
      ranking:
        state.targetQuestions > INITIAL_TOTAL_QUESTIONS
          ? "繼續精排"
          : {
              discovery: "候選探索",
              boundary: "前 12 名邊界確認",
              top12: "前 12 名精排",
            }[getRankingPhase(state)],
      complete: "排序完成",
    };
    return {
      percent,
      label: labels[state.stage] || labels.round1,
      detail: `${answeredQuestions} / ${totalQuestions} 題`,
      answeredQuestions,
      totalQuestions,
    };
  }

  function extendSorting(state) {
    state.stage = "ranking";
    state.complete = false;
    state.currentPair = null;
    state.rankingTarget += REFINEMENT_QUESTIONS;
    state.targetQuestions += REFINEMENT_QUESTIONS;
    saveState(state);
    return state;
  }

  function embedUrl(videoId) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?playsinline=1&rel=0`;
  }

  function thumbnailUrls(videoId) {
    const id = encodeURIComponent(videoId);
    return [
      `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${id}/0.jpg`,
    ];
  }

  function setThumbnailFallback(image, videoId) {
    const candidates = thumbnailUrls(videoId);
    let index = 0;
    const tryNext = () => {
      if (index < candidates.length) image.src = candidates[index];
    };
    const advance = () => {
      index += 1;
      tryNext();
    };
    image.addEventListener("error", advance);
    image.addEventListener("load", () => {
      const isTinyPlaceholder = image.naturalWidth <= 120 || image.naturalHeight <= 90;
      if (isTinyPlaceholder && index < candidates.length - 1) advance();
    });
    tryNext();
  }

  function unitColor(unit) {
    return UNIT_COLORS[unit] || "#35e2ec";
  }

  function hasProgress(state) {
    return state.answeredQuestions > 0 || state.skipRewardedPairs.length > 0;
  }

  window.ProsekaApp = {
    SONGS,
    SONG_MAP,
    SKIP_BONUS,
    MAX_SKIP_BONUS,
    ROUND_ONE_QUESTIONS,
    ROUND_TWO_QUESTIONS,
    FINAL_ACTIVE_COUNT,
    INITIAL_RANKING_QUESTIONS,
    INITIAL_TOTAL_QUESTIONS,
    REFINEMENT_QUESTIONS,
    DISCOVERY_QUESTIONS,
    BOUNDARY_QUESTIONS,
    TOP_TWELVE_QUESTIONS,
    createInitialState,
    loadState,
    saveState,
    resetState,
    pairKey,
    videoIdFor,
    rankingScore,
    getRankedSongs,
    getRankingPhase,
    getStage,
    getProgress,
    extendSorting,
    embedUrl,
    thumbnailUrls,
    setThumbnailFallback,
    unitColor,
    hasProgress,
  };
})();
