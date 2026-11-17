import { normalize, parseCommand, sharedVoiceKeys } from "./parse.js";
import { PRESETS, currentTarget, gamePointTeams, matchWinner, setWinner } from "./rules.js";

const STORAGE_KEY = "score-keeper-v1";
const COLOR_NAMES = new Set(["red", "blue", "green", "orange", "purple", "gold", "pink", "teal"]);

const $ = (id) => document.getElementById(id);

const RULE_HINTS = {
  free: "Just a score. A set is awarded only when you say a team wins the set.",
  volleyball: "Sets to 25, must win by 2. The deciding set is to 15. First team to 2 sets wins.",
  tabletennis: "Games to 11, must win by 2. First team to 3 games wins.",
  to21: "One game to 21, must win by 2.",
  custom: "Custom target. A set ends on the next point that reaches it.",
};

const HINTS = {
  "which-team": "Say which team, like “red plus 1”.",
  conflict: "Name one team at a time.",
  ambiguous: "Try a simpler phrase, like “red plus 1”.",
  unrecognized: "Try “red plus 1”.",
  "too-big": "Add or remove up to 10 points at a time.",
  zero: "Say a number from 1 to 10.",
};

let state;
let confirmOpen = false;
let confirmTimer = 0;
let toastTimer = 0;
let recognition = null;
let listening = false;
let micWanted = false;
let micStarts = 0;
let restartTimer = 0;
let lastHandled = { text: "", at: 0 };
let ignoreUntil = 0;
let wakeLock = null;
let deferredInstall = null;
let audioCtx = null;

function isIOS() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : fallback;
}

function defaultState() {
  return {
    teams: [
      { name: "Red", voice: "red", color: "#ff4d4d" },
      { name: "Blue", voice: "blue", color: "#4c8dff" },
    ],
    scores: [0, 0],
    sets: [0, 0],
    server: null,
    rules: { ...PRESETS.free, preset: "free" },
    sound: true,
    wake: true,
    keepListening: !isIOS(),
    history: [],
  };
}

function loadState() {
  const blank = defaultState();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || !Array.isArray(raw.teams) || raw.teams.length !== 2) return blank;
    const teams = [0, 1].map((index) => {
      const team = raw.teams[index] || {};
      const fallback = blank.teams[index];
      const voice = normalize(team.voice).slice(0, 24) || fallback.voice;
      const name = String(team.name || "").replace(/\s+/g, " ").trim().slice(0, 24) || fallback.name;
      return { name, voice, color: cleanColor(team.color, fallback.color) };
    });
    const pair = (value, max) => {
      const list = Array.isArray(value) ? value : [0, 0];
      return [clamp(list[0], 0, max), clamp(list[1], 0, max)];
    };
    const history = (Array.isArray(raw.history) ? raw.history : [])
      .filter((entry) => Array.isArray(entry?.scores) && Array.isArray(entry?.sets))
      .slice(-40)
      .map((entry) => ({
        label: String(entry.label || "Change"),
        scores: pair(entry.scores, 999),
        sets: pair(entry.sets, 99),
        server: entry.server === 0 || entry.server === 1 ? entry.server : null,
      }));
    const rules = { ...blank.rules, ...(raw.rules || {}) };
    rules.pointsToWin = clamp(rules.pointsToWin, 0, 99);
    rules.setsToWin = clamp(rules.setsToWin, 0, 9);
    rules.decidingPoints = clamp(rules.decidingPoints, 0, 99);
    rules.winByTwo = Boolean(rules.winByTwo);
    if (!PRESETS[rules.preset] && rules.preset !== "custom") rules.preset = "custom";
    return {
      teams,
      scores: pair(raw.scores, 999),
      sets: pair(raw.sets, 99),
      server: raw.server === 0 || raw.server === 1 ? raw.server : null,
      rules,
      sound: raw.sound !== false,
      wake: raw.wake !== false,
      keepListening: typeof raw.keepListening === "boolean" ? raw.keepListening : blank.keepListening,
      history,
    };
  } catch {
    return blank;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Private mode can refuse storage; the match still works in memory. */
  }
}

function voiceTeams() {
  return state.teams.map((team, index) => ({
    id: String(index),
    keys: [team.voice, team.name, index === 0 ? "left" : "right"].filter(Boolean),
  }));
}

function scoringLocked() {
  return matchWinner(state.sets, state.rules) != null;
}

function scoreAnnouncement() {
  return `${state.teams[0].name} ${state.scores[0]}, ${state.teams[1].name} ${state.scores[1]}.`;
}

function announce(text) {
  const live = $("live");
  live.textContent = "";
  live.textContent = text;
}

function setDetail(text) {
  $("listen-detail").textContent = text;
}

function setStatus(text) {
  $("listen-status").textContent = text;
}

function toast(message) {
  const el = $("toast");
  el.hidden = false;
  el.textContent = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 2400);
}

function flash(index) {
  const el = $(`score-${index}`);
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function chime(up) {
  if (!state.sound) return;
  ignoreUntil = performance.now() + 280;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  audioCtx.resume?.();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = up ? 880 : 420;
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function vibrate() {
  navigator.vibrate?.(12);
}

function celebrate(x, y, colors, count) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = $("celebrate");
  const pieces = [];
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("i");
    const angle = Math.random() * Math.PI * 2;
    const distance = 28 + Math.random() * (count > 20 ? 170 : 78);
    piece.className = "confetti";
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--dy", `${Math.sin(angle) * distance - 24}px`);
    piece.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);
    layer.appendChild(piece);
    pieces.push(piece);
  }
  window.setTimeout(() => pieces.forEach((piece) => piece.remove()), 900);
}

function celebrateTeam(index, count) {
  const card = $(`card-${index}`);
  const rect = card.getBoundingClientRect();
  const colors = [state.teams[index].color, "#fff7ea"];
  celebrate(rect.left + rect.width / 2, rect.top + rect.height * 0.38, colors, count);
}

function pushHistory(label) {
  state.history.push({
    label,
    scores: [...state.scores],
    sets: [...state.sets],
    server: state.server,
  });
  if (state.history.length > 40) state.history.shift();
}

function commit() {
  persist();
  render();
}

function render() {
  const locked = scoringLocked();
  const target = currentTarget(state.sets, state.rules);
  const showSets = target > 0 || state.rules.setsToWin > 0 || state.sets.some(Boolean);
  document.body.style.setProperty("--c0", state.teams[0].color);
  document.body.style.setProperty("--c1", state.teams[1].color);
  document.title = locked
    ? `${state.teams[matchWinner(state.sets, state.rules)].name} wins`
    : `${state.teams[0].name} ${state.scores[0]} – ${state.teams[1].name} ${state.scores[1]}`;

  $("kicker").textContent = kickerText(target, locked);
  $("undo").disabled = state.history.length === 0;

  state.teams.forEach((team, index) => {
    const card = $(`card-${index}`);
    card.style.setProperty("--team", team.color);
    card.classList.toggle("is-serving", state.server === index);
    $(`name-${index}`).textContent = team.name;
    $(`hint-${index}`).textContent = `Say “${team.voice} plus 1”`;
    const score = $(`score-${index}`);
    score.textContent = String(state.scores[index]);
    score.classList.toggle("compact", state.scores[index] >= 100);
    const meter = $(`meter-${index}`);
    meter.hidden = !(target > 0) || locked;
    if (target > 0) {
      $(`meter-bar-${index}`).style.width = `${Math.min(100, (state.scores[index] / target) * 100)}%`;
    }
    const sets = $(`sets-${index}`);
    sets.hidden = !showSets;
    sets.textContent = `Sets ${state.sets[index]}`;
    $(`add-${index}`).disabled = locked;
    $(`sub-${index}`).disabled = locked;
    $(`add-${index}`).setAttribute("aria-label", `Add a point to ${team.name}`);
    $(`sub-${index}`).setAttribute("aria-label", `Remove a point from ${team.name}`);
    const serve = $(`serve-${index}`);
    serve.textContent = state.server === index ? "Serving" : "Serve";
    serve.setAttribute("aria-pressed", String(state.server === index));
    serve.setAttribute("aria-label", state.server === index ? `${team.name} is serving` : `Give serve to ${team.name}`);
  });

  const winner = matchWinner(state.sets, state.rules);
  const overlay = $("match-overlay");
  overlay.hidden = winner == null;
  if (winner != null) {
    $("match-title").textContent = `${state.teams[winner].name} wins`;
    $("match-sub").textContent = `Sets ${state.sets[0]} to ${state.sets[1]}`;
  }
  $("confirm").hidden = !confirmOpen;

  const mic = $("mic");
  mic.classList.toggle("live", listening);
  mic.setAttribute("aria-pressed", String(listening));
  mic.setAttribute("aria-label", listening ? "Stop listening" : "Start listening");

  const duplicates = sharedVoiceKeys(voiceTeams());
  const warning = $("voice-warning");
  warning.hidden = duplicates.length === 0;
  warning.textContent = duplicates.length
    ? `Both teams answer to “${duplicates.join(", ")}”. Change a voice word so commands stay clear.`
    : "";

  if ($("settings").open) syncOpenScoreFields();
}

function kickerText(target, locked) {
  if (locked) return "Match over";
  const played = state.sets[0] + state.sets[1];
  if (!target && played === 0 && !state.rules.setsToWin) return "Free play";
  const bits = [`Set ${played + 1}`];
  if (target) bits.push(`first to ${target}`);
  if (target && state.rules.winByTwo) bits.push("win by 2");
  return bits.join(" · ");
}

function syncOpenScoreFields() {
  for (let index = 0; index < 2; index += 1) {
    const points = $(`points-input-${index}`);
    const sets = $(`sets-input-${index}`);
    if (document.activeElement !== points) points.value = state.scores[index];
    if (document.activeElement !== sets) sets.value = state.sets[index];
  }
}

function addPoints(index, amount) {
  if (scoringLocked()) {
    toast("The match is over. Start a new game or undo the last point.");
    return;
  }
  const name = state.teams[index].name;
  pushHistory(`${name} +${amount}`);
  state.scores[index] += amount;
  state.server = index;
  const setWon = setWinner(state.scores, state.sets, state.rules);
  if (setWon != null) {
    const winnerName = state.teams[setWon].name;
    state.sets[setWon] += 1;
    state.scores = [0, 0];
    confirmOpen = false;
    commit();
    flash(index);
    chime(true);
    vibrate();
    const message = `${winnerName} takes the set`;
    setDetail(message);
    announce(`${message}. Sets ${state.sets[0]} to ${state.sets[1]}.`);
    if (!scoringLocked()) toast(message);
    celebrateTeam(index, scoringLocked() ? 42 : 26);
    return;
  }
  confirmOpen = false;
  commit();
  flash(index);
  chime(true);
  vibrate();
  celebrateTeam(index, 12);
  const call = gamePointCall();
  setDetail(call || `${name} +${amount}`);
  if (call) speak(call);
  else announce(scoreAnnouncement());
}

function gamePointCall() {
  const teams = gamePointTeams(state.scores, state.sets, state.rules);
  if (teams.length === 1) return `Game point, ${state.teams[teams[0]].name}.`;
  if (teams.length > 1) return "Game point.";
  return "";
}

function subPoints(index, amount) {
  if (scoringLocked()) {
    toast("The match is over. Undo the last point or start a new game.");
    return;
  }
  const name = state.teams[index].name;
  if (state.scores[index] <= 0) {
    toast(`${name} is already at 0`);
    setDetail(`${name} is already at 0`);
    return;
  }
  pushHistory(`${name} -${amount}`);
  state.scores[index] = Math.max(0, state.scores[index] - amount);
  confirmOpen = false;
  commit();
  flash(index);
  chime(false);
  setDetail(`${name} -${amount}`);
  announce(scoreAnnouncement());
}

function setServer(index, { toggle = true } = {}) {
  const name = state.teams[index].name;
  const next = toggle && state.server === index ? null : index;
  if (next === state.server) {
    setDetail(`${name} serving`);
    return;
  }
  pushHistory(next == null ? "Serve cleared" : `${name} serve`);
  state.server = next;
  commit();
  setDetail(next == null ? "Serve cleared" : `${name} serving`);
}

function awardSet(index) {
  if (scoringLocked()) {
    toast("The match is over. Start a new game or undo the last point.");
    return;
  }
  const name = state.teams[index].name;
  pushHistory(`${name} wins the set`);
  state.sets[index] += 1;
  state.scores = [0, 0];
  confirmOpen = false;
  commit();
  const message = `${name} takes the set`;
  setDetail(message);
  announce(`${message}. Sets ${state.sets[0]} to ${state.sets[1]}.`);
  if (!scoringLocked()) toast(message);
  chime(true);
  celebrateTeam(index, scoringLocked() ? 42 : 26);
}

function clearPoints() {
  if (scoringLocked()) {
    toast("The match is over. Start a new game or undo the last point.");
    return;
  }
  if (state.scores[0] === 0 && state.scores[1] === 0) {
    toast("Points are already 0");
    return;
  }
  pushHistory("New set");
  state.scores = [0, 0];
  confirmOpen = false;
  commit();
  setDetail("New set");
  announce("Points cleared for the next set.");
  toast("New set");
}

function askReset() {
  confirmOpen = true;
  render();
  setDetail("Say “yes” to reset, or “no” to keep playing.");
  window.clearTimeout(confirmTimer);
  confirmTimer = window.setTimeout(() => {
    if (!confirmOpen) return;
    confirmOpen = false;
    render();
    setDetail("Reset cancelled");
  }, 7000);
}

function doReset() {
  pushHistory("New game");
  state.scores = [0, 0];
  state.sets = [0, 0];
  state.server = null;
  confirmOpen = false;
  commit();
  setDetail("New game");
  announce("New game. Scores cleared.");
  toast("New game");
}

function undo() {
  const prev = state.history.pop();
  if (!prev) return;
  state.scores = [...prev.scores];
  state.sets = [...prev.sets];
  state.server = prev.server === 0 || prev.server === 1 ? prev.server : null;
  confirmOpen = false;
  commit();
  setDetail(`Undid ${prev.label}`);
  announce(`Undid ${prev.label}. ${scoreAnnouncement()}`);
  toast(`Undid ${prev.label}`);
}

function speak(text) {
  announce(text);
  if (!state.sound || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1.02;
  ignoreUntil = performance.now() + 2800;
  utterance.onend = () => {
    ignoreUntil = performance.now() + 300;
  };
  window.speechSynthesis.speak(utterance);
}

function sayScore() {
  const text = scoreAnnouncement();
  setDetail(text);
  speak(text);
}

function applyCommand(command, transcript) {
  if (command.type === "ignore") {
    if (command.attempt) setDetail(`Heard “${transcript}”. ${HINTS[command.reason] || "Try “red plus 1”."}`);
    return;
  }
  if (command.type === "stop") {
    stopListening();
    if (confirmOpen) {
      confirmOpen = false;
      render();
    }
    setDetail("Microphone off");
    return;
  }
  if (command.type === "confirm") {
    if (confirmOpen || ! $("match-overlay").hidden) doReset();
    return;
  }
  if (command.type === "cancel") {
    if (!confirmOpen) return;
    confirmOpen = false;
    render();
    setDetail("Reset cancelled");
    return;
  }
  if (command.type === "undo") {
    undo();
    return;
  }
  if (command.type === "announce") {
    sayScore();
    return;
  }
  if (command.type === "reset") {
    if (!$("match-overlay").hidden) doReset();
    else askReset();
    return;
  }
  if (command.type === "newSet") {
    clearPoints();
    return;
  }
  const index = Number(command.teamId);
  if (command.type === "add") addPoints(index, command.amount);
  else if (command.type === "subtract") subPoints(index, command.amount);
  else if (command.type === "serve") setServer(index, { toggle: false });
  else if (command.type === "awardSet") awardSet(index);
}

function handleTranscript(input, { typed = false } = {}) {
  const list = (Array.isArray(input) ? input : [input]).map((item) => String(item).trim()).filter(Boolean);
  if (!list.length) return;
  if (!typed && performance.now() < ignoreUntil) return;
  const key = normalize(list[0]);
  const now = Date.now();
  if (!typed && key && key === lastHandled.text && now - lastHandled.at < 700) return;
  if (!typed) lastHandled = { text: key, at: now };

  let use = null;
  for (const text of list) {
    const command = parseCommand(text, voiceTeams());
    const rank = command.type === "ignore" ? 0 : command.explicit ? 2 : 1;
    if (!use || rank > use.rank) use = { text, command, rank };
  }
  if (use?.command && use.text !== list[0] && use.command.type !== "ignore") use.command.guessed = true;
  applyCommand(use.command, use.text);
  if (use?.command?.guessed && use.command.type !== "ignore") {
    const action = $("listen-detail").textContent;
    setDetail(`Guessed “${use.text}” → ${action}`);
  }
}

function refreshListenStatus() {
  if (!speechCtor()) {
    setStatus("Type a command, or use the + buttons.");
    return;
  }
  if (listening) {
    setStatus(state.keepListening ? "Listening…" : "Listening for one command…");
    return;
  }
  setStatus(state.keepListening ? "Tap the mic, then say “red plus 1”." : "Tap the mic once for each point.");
}

function toggleMic() {
  if (!speechCtor()) {
    $("command-input").focus();
    return;
  }
  if (listening) stopListening();
  else startListening();
}

function speechCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function releaseRecognizer() {
  const rec = recognition;
  recognition = null;
  if (!rec) return;
  rec.onresult = null;
  rec.onerror = null;
  rec.onend = null;
  try {
    rec.abort();
  } catch {
    /* the session was already closed, which is what happens after a reload */
  }
}

function micGaveUp(message) {
  window.clearTimeout(restartTimer);
  micWanted = false;
  listening = false;
  releaseRecognizer();
  render();
  setStatus(message);
}

function attachRecognizer() {
  const Ctor = speechCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = !!state.keepListening && !isIOS();
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  let heard = false;
  rec.onresult = (event) => {
    if (performance.now() < ignoreUntil) return;
    let interim = "";
    const finals = [];
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) finals.push(result);
      else interim += result[0].transcript;
    }
    if (interim && !finals.length) {
      setDetail(interim);
      return;
    }
    heard = true;
    micStarts = 0;
    for (const result of finals) {
      const alternatives = [...result].slice(0, 5).map((alt) => alt.transcript);
      handleTranscript(alternatives);
    }
    if (micWanted && !state.keepListening) stopListening();
  };
  rec.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      micGaveUp("Microphone is blocked. Allow the mic for this site, then tap the button again.");
      return;
    }
    if (event.error === "network") {
      micGaveUp("Voice needs an internet connection. Tap the mic to try again.");
      return;
    }
    if (event.error === "audio-capture") {
      micGaveUp("No microphone found. Type a command or tap the + buttons.");
    }
  };
  rec.onend = () => {
    if (recognition !== rec) return;
    if (!micWanted) {
      listening = false;
      render();
      refreshListenStatus();
      return;
    }
    if (!state.keepListening || isIOS()) {
      const missed = !heard;
      micWanted = false;
      listening = false;
      render();
      if (missed) setStatus("Tap the mic and say the point.");
      else refreshListenStatus();
      return;
    }
    window.clearTimeout(restartTimer);
    micStarts += 1;
    if (micStarts > 3) {
      micGaveUp("Mic paused. Tap it to listen again.");
      return;
    }
    restartTimer = window.setTimeout(() => {
      if (!micWanted) return;
      const next = attachRecognizer();
      if (!next) return;
      try {
        next.start();
      } catch {
        micGaveUp("Tap the mic to listen again.");
      }
    }, 300);
  };
  recognition = rec;
  return rec;
}

function startListening() {
  if (!speechCtor()) return;
  window.clearTimeout(restartTimer);
  micStarts = 0;
  micWanted = true;
  listening = true;
  render();
  refreshListenStatus();
  releaseRecognizer();
  const rec = attachRecognizer();
  try {
    rec.start();
  } catch {
    micGaveUp("Tap the mic to listen again.");
  }
}

function stopListening() {
  window.clearTimeout(restartTimer);
  micWanted = false;
  listening = false;
  releaseRecognizer();
  render();
  refreshListenStatus();
}

function setupRecognition() {
  if (!speechCtor()) {
    $("mic").disabled = true;
    $("support").hidden = false;
    $("support").textContent = "This browser can’t hear commands. Use Chrome, Edge, or Safari — or type a command.";
    refreshListenStatus();
    return;
  }
  refreshListenStatus();
}

function pauseMic() {
  window.clearTimeout(restartTimer);
  releaseRecognizer();
  listening = false;
  if (!state.keepListening || isIOS()) micWanted = false;
  render();
  refreshListenStatus();
}

function resumeMic() {
  if (!micWanted || !state.keepListening || isIOS()) {
    listening = false;
    render();
    refreshListenStatus();
    return;
  }
  if (listening && recognition) return;
  startListening();
}

async function updateWake() {
  if (!("wakeLock" in navigator)) return;
  if (!state.wake || document.visibilityState !== "visible") {
    try {
      await wakeLock?.release();
    } catch {
      /* already released */
    }
    wakeLock = null;
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

function fillForm() {
  state.teams.forEach((team, index) => {
    $(`name-input-${index}`).value = team.name;
    $(`voice-input-${index}`).value = team.voice;
    $(`color-input-${index}`).value = team.color;
    $(`points-input-${index}`).value = state.scores[index];
    $(`sets-input-${index}`).value = state.sets[index];
  });
  $("points-to-win").value = state.rules.pointsToWin;
  $("sets-to-win").value = state.rules.setsToWin;
  $("deciding-points").value = state.rules.decidingPoints;
  $("win-by-two").checked = state.rules.winByTwo;
  $("sound-toggle").checked = state.sound;
  $("wake-toggle").checked = state.wake;
  $("keep-toggle").checked = state.keepListening;
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.preset === state.rules.preset));
  });
  document.querySelectorAll(".swatch").forEach((button) => {
    const team = state.teams[Number(button.dataset.team)];
    button.setAttribute("aria-pressed", String(team.color.toLowerCase() === button.dataset.color.toLowerCase()));
  });
  $("rules-hint").textContent = RULE_HINTS[state.rules.preset] || RULE_HINTS.custom;
  $("winby-row").hidden = !(state.rules.pointsToWin > 0);
  $("deciding-row").hidden = !(state.rules.setsToWin >= 2);
}

function markCustomRules() {
  state.rules.preset = "custom";
  fillForm();
}

function applySwatch(index, voice, color) {
  const team = state.teams[index];
  const voiceWasColor = COLOR_NAMES.has(team.voice);
  const nameWasColor = team.name.trim().toLowerCase() === team.voice;
  team.color = color;
  if (voiceWasColor) team.voice = voice;
  if (nameWasColor && voiceWasColor) team.name = voice.charAt(0).toUpperCase() + voice.slice(1);
  commit();
  fillForm();
}

function applyPreset(name) {
  state.rules = { ...PRESETS[name], preset: name };
  commit();
  fillForm();
}

function bindSettings() {
  for (let index = 0; index < 2; index += 1) {
    $(`name-input-${index}`).addEventListener("input", (event) => {
      state.teams[index].name = event.target.value.replace(/\s+/g, " ").slice(0, 24) || state.teams[index].name;
      commit();
    });
    $(`name-input-${index}`).addEventListener("change", (event) => {
      const clean = event.target.value.replace(/\s+/g, " ").trim().slice(0, 24) || `Team ${index + 1}`;
      state.teams[index].name = clean;
      event.target.value = clean;
      commit();
    });
    $(`voice-input-${index}`).addEventListener("change", (event) => {
      const clean = normalize(event.target.value).slice(0, 24);
      if (!clean) {
        event.target.value = state.teams[index].voice;
        return;
      }
      state.teams[index].voice = clean;
      event.target.value = clean;
      commit();
    });
    $(`color-input-${index}`).addEventListener("input", (event) => {
      state.teams[index].color = event.target.value;
      commit();
      fillForm();
    });
    $(`points-input-${index}`).addEventListener("change", (event) => {
      const next = clamp(event.target.value, 0, 999);
      event.target.value = next;
      if (next === state.scores[index]) return;
      pushHistory("Edit points");
      state.scores[index] = next;
      commit();
      announce(scoreAnnouncement());
    });
    $(`sets-input-${index}`).addEventListener("change", (event) => {
      const next = clamp(event.target.value, 0, 99);
      event.target.value = next;
      if (next === state.sets[index]) return;
      pushHistory("Edit sets");
      state.sets[index] = next;
      commit();
    });
  }

  document.querySelectorAll(".swatch").forEach((button) => {
    button.addEventListener("click", () => {
      applySwatch(Number(button.dataset.team), button.dataset.voice, button.dataset.color);
    });
  });
  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  $("points-to-win").addEventListener("input", (event) => {
    state.rules.pointsToWin = clamp(event.target.value, 0, 99);
    markCustomRules();
  });
  $("sets-to-win").addEventListener("input", (event) => {
    state.rules.setsToWin = clamp(event.target.value, 0, 9);
    markCustomRules();
  });
  $("deciding-points").addEventListener("input", (event) => {
    state.rules.decidingPoints = clamp(event.target.value, 0, 99);
    markCustomRules();
  });
  $("win-by-two").addEventListener("change", (event) => {
    state.rules.winByTwo = event.target.checked;
    markCustomRules();
  });
  $("sound-toggle").addEventListener("change", (event) => {
    state.sound = event.target.checked;
    persist();
  });
  $("wake-toggle").addEventListener("change", (event) => {
    state.wake = event.target.checked;
    persist();
    updateWake();
  });
  $("keep-toggle").addEventListener("change", (event) => {
    state.keepListening = event.target.checked;
    persist();
    if (!event.target.checked) stopListening();
    else refreshListenStatus();
  });
}

function bindUi() {
  $("add-0").addEventListener("click", () => addPoints(0, 1));
  $("add-1").addEventListener("click", () => addPoints(1, 1));
  $("sub-0").addEventListener("click", () => subPoints(0, 1));
  $("sub-1").addEventListener("click", () => subPoints(1, 1));
  $("serve-0").addEventListener("click", () => setServer(0));
  $("serve-1").addEventListener("click", () => setServer(1));
  $("undo").addEventListener("click", undo);
  $("reset-match").addEventListener("click", () => {
    if (!$("match-overlay").hidden) doReset();
    else askReset();
  });
  $("confirm-yes").addEventListener("click", doReset);
  $("confirm-no").addEventListener("click", () => {
    confirmOpen = false;
    render();
    setDetail("Reset cancelled");
  });
  $("match-new").addEventListener("click", doReset);
  $("match-undo").addEventListener("click", undo);
  $("mic").addEventListener("click", toggleMic);
  $("settings-open").addEventListener("click", () => {
    fillForm();
    $("settings").showModal();
  });
  $("settings-close").addEventListener("click", () => $("settings").close());
  $("settings").addEventListener("click", (event) => {
    if (event.target === $("settings")) $("settings").close();
  });
  const submitTypedCommand = () => {
    const input = $("command-input");
    const text = input.value.trim();
    if (!text) return;
    handleTranscript(text, { typed: true });
    input.value = "";
  };
  $("command-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitTypedCommand();
  });
  $("command-input").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitTypedCommand();
  });
  $("install-btn").addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    $("install-btn").hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if ($("settings").open) $("settings").close();
      else if (confirmOpen) {
        confirmOpen = false;
        render();
        setDetail("Reset cancelled");
      }
      return;
    }
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
    if ($("settings").open || event.repeat) return;
    if ((tag === "BUTTON" || tag === "A") && (event.key === " " || event.key === "Enter")) return;
    if (event.code === "Digit1") {
      event.preventDefault();
      if (event.shiftKey) subPoints(0, 1);
      else addPoints(0, 1);
    } else if (event.code === "Digit2") {
      event.preventDefault();
      if (event.shiftKey) subPoints(1, 1);
      else addPoints(1, 1);
    } else if (event.key.toLowerCase() === "u") {
      undo();
    } else if (event.key.toLowerCase() === "m" || event.key === " ") {
      event.preventDefault();
      toggleMic();
    }
  });

  document.addEventListener("visibilitychange", () => {
    updateWake();
    if (document.visibilityState === "hidden") pauseMic();
    else resumeMic();
  });
  window.addEventListener("pagehide", pauseMic);
  window.addEventListener("pageshow", resumeMic);
  document.addEventListener("pointerdown", () => updateWake(), { once: true });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    $("install-btn").hidden = false;
  });
}

function boot() {
  state = loadState();
  if (location.protocol === "file:") {
    $("support").hidden = false;
    $("support").textContent = "Open this page from a website or a local server so the microphone can be used. The buttons still work here.";
  }
  const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isIOS() && !standalone) $("ios-hint").hidden = false;
  setupRecognition();
  bindUi();
  bindSettings();
  render();
  refreshListenStatus();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
