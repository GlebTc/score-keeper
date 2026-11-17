const MISHEARS = {
  red: ["read", "rad", "redd"],
  blue: ["blew", "bloo"],
  green: ["greene"],
  gold: ["goald"],
  white: ["wight"],
  black: ["blak"],
  pink: ["pinc"],
  orange: ["orenge"],
  purple: ["purpel"],
  teal: ["teil"],
};

const ONES = {
  zero: 0,
  oh: 0,
  one: 1,
  won: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

const FILLERS = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "from",
  "team",
  "side",
  "please",
  "and",
  "of",
  "on",
  "by",
  "go",
  "goes",
  "got",
  "me",
  "my",
  "their",
  "that",
  "this",
  "now",
  "just",
  "hey",
  "i",
  "im",
  "we",
  "you",
  "want",
  "wanted",
  "should",
  "let",
  "lets",
  "put",
  "make",
  "makes",
  "have",
  "has",
  "had",
  "get",
  "gets",
  "getting",
  "some",
  "it",
  "its",
  "is",
  "are",
  "was",
  "be",
  "been",
  "do",
  "did",
  "does",
  "can",
  "will",
  "need",
  "needs",
  "wanna",
  "gonna",
  "like",
  "really",
  "very",
  "so",
  "um",
  "uh",
  "ah",
  "think",
  "maybe",
]);

const PLUS_WORDS = [
  "plus",
  "add",
  "added",
  "up",
  "point",
  "points",
  "score",
  "scores",
  "scored",
  "increment",
  "increments",
  "more",
  "another",
  "extra",
];

const MINUS_WORDS = [
  "minus",
  "minos",
  "minas",
  "minors",
  "miners",
  "menus",
  "minues",
  "minuss",
  "negative",
  "subtract",
  "subtracted",
  "down",
  "remove",
  "removed",
  "deduct",
  "deducted",
  "decrement",
  "decrements",
  "dock",
  "docked",
  "penalty",
];

const AWARD_WORDS = ["win", "wins", "won", "award", "awarded", "give", "takes", "took", "take"];
const SERVE_WORDS = ["serve", "serves", "serving", "server", "service", "services"];
const PLUS_NOUNS = new Set(["point", "points", "score", "scores", "scored"]);
const STRONG_WORDS = new Set([
  "plus",
  "minus",
  "add",
  "added",
  "subtract",
  "subtracted",
  "increment",
  "increments",
  "decrement",
  "decrements",
  "remove",
  "removed",
  "deduct",
  "dock",
  "penalty",
]);

const KNOWN = new Set([
  ...PLUS_WORDS,
  ...MINUS_WORDS,
  ...AWARD_WORDS,
  ...SERVE_WORDS,
  "away",
  "off",
  "set",
]);

const COLORS = ["red", "blue", "green", "orange", "purple", "gold", "pink", "teal"];
const COLOR_PATTERN = COLORS.join("|");
const MAX_POINTS = 10;
const NEGATIONS = new Set(["no", "not", "dont", "never"]);
const GUESS_WORDS = new Set([
  ...PLUS_WORDS,
  ...MINUS_WORDS,
  ...AWARD_WORDS,
  ...SERVE_WORDS,
  "set",
  "away",
  "off",
  "undo",
  "stop",
  "yes",
  "yeah",
  "reset",
  "restart",
  "game",
  "match",
  "next",
  "clear",
  "zero",
  "points",
  "score",
  "volleyball",
  "rename",
  "nobody",
  "orange",
  "purple",
  "screen",
]);

function editDistance(left, right) {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const saved = row[j];
      row[j] = left[i - 1] === right[j - 1] ? previous : 1 + Math.min(previous, row[j], row[j - 1]);
      previous = saved;
    }
  }
  return row[right.length];
}

function allowedDistance(token, candidate) {
  const length = Math.max(token.length, candidate.length);
  if (Math.abs(token.length - candidate.length) > 2) return 0;
  if (length <= 2) return 0;
  if (length === 3) return token[0] === candidate[0] ? 1 : 0;
  if (length >= 7) return 2;
  return 1;
}

function snapToken(token, targets) {
  if (FILLERS.has(token) || targets.has(token)) return { token, snapped: false };
  let best = null;
  let bestDistance = Infinity;
  let tie = false;
  for (const candidate of targets) {
    const allowed = allowedDistance(token, candidate);
    if (!allowed) continue;
    const distance = editDistance(token, candidate);
    if (!distance || distance > allowed) continue;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tie = false;
    } else if (distance === bestDistance && candidate !== best) {
      tie = true;
    }
  }
  if (!best || tie) return { token, snapped: false };
  return { token: best, snapped: true };
}

function snapTokens(tokens, targets) {
  let snapped = false;
  const next = tokens.map((token) => {
    const result = snapToken(token, targets);
    snapped = snapped || result.snapped;
    return result.token;
  });
  return { tokens: next, snapped };
}

export function normalize(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefix(text) {
  const prefix = /^(please|hey|ok|okay|computer|scorekeeper|can you|could you|would you|will you)\b\s+/;
  let next = text;
  for (let i = 0; i < 4; i += 1) {
    const stripped = next.replace(prefix, "");
    if (stripped === next) break;
    next = stripped;
  }
  return next;
}

function expandKey(key) {
  const tokens = normalize(key).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const variants = new Set([tokens.join(" ")]);
  tokens.forEach((token, index) => {
    for (const alt of MISHEARS[token] || []) {
      const copy = tokens.slice();
      copy[index] = alt;
      variants.add(copy.join(" "));
    }
  });
  return [...variants];
}

function teamKeys(team) {
  const variants = [];
  for (const key of team.keys || []) {
    for (const variant of expandKey(key)) {
      if (!variants.includes(variant)) variants.push(variant);
    }
  }
  return variants;
}

export function sharedVoiceKeys(teams) {
  const owner = new Map();
  const duplicates = new Set();
  for (const team of teams) {
    const seen = new Set();
    for (const key of teamKeys(team)) {
      if (seen.has(key)) continue;
      seen.add(key);
      if (owner.has(key) && owner.get(key) !== team.id) duplicates.add(key);
      else owner.set(key, team.id);
    }
  }
  return [...duplicates];
}

function sideKeys(index) {
  if (index === 0) return ["left"];
  if (index === 1) return ["right"];
  return [];
}

function findTeam(tokens, teams) {
  const hits = [];
  teams.forEach((team, teamIndex) => {
    const keys = teamKeys(team);
    for (const side of sideKeys(teamIndex)) {
      if (!keys.includes(side)) keys.push(side);
    }
    for (const key of keys) {
      const keyTokens = key.split(" ");
      for (let i = 0; i <= tokens.length - keyTokens.length; i += 1) {
        const matches = keyTokens.every((part, offset) => tokens[i + offset] === part);
        if (matches) hits.push({ team, index: i, length: keyTokens.length });
      }
    }
  });
  if (!hits.length) return null;
  const ids = new Set(hits.map((hit) => hit.team.id));
  if (ids.size > 1) return { conflict: true };
  hits.sort((a, b) => b.length - a.length || a.index - b.index);
  return hits[0];
}

function pullNumber(tokens) {
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^\d{1,2}$/.test(token)) {
      return { value: Number(token), rest: tokens.filter((_, index) => index !== i) };
    }
    if (token in TENS) {
      const next = tokens[i + 1];
      if (next in ONES && ONES[next] < 10) {
        return {
          value: TENS[token] + ONES[next],
          rest: tokens.filter((_, index) => index !== i && index !== i + 1),
        };
      }
      return { value: TENS[token], rest: tokens.filter((_, index) => index !== i) };
    }
    if (token in ONES) {
      return { value: ONES[token], rest: tokens.filter((_, index) => index !== i) };
    }
  }
  return { value: null, rest: tokens };
}

function metaCommand(text) {
  if (/^(undo|undo that|take that back|go back|scratch that|never mind|nevermind)$/.test(text)) {
    return { type: "undo" };
  }
  if (/^(stop|stop listening|mute|quiet)$/.test(text)) return { type: "stop" };
  if (/^(yes|yeah|yep|confirm|do it)$/.test(text)) return { type: "confirm" };
  if (/^(no|nope|cancel)$/.test(text)) return { type: "cancel" };
  if (/^(next set|new set|reset points|reset the points|clear points|clear the points|zero points|zero the points|reset score|reset the score|clear score|clear the score|restart score|restart the score|restart points|restart the points)$/.test(text)) {
    return { type: "newSet" };
  }
  if (/^(new game|new match|start over|reset|reset game|reset match|reset the game|reset the match|reset everything|clear game|clear the game|clear match|clear the match|restart game|restart the game|restart match|restart the match)$/.test(text)) {
    return { type: "reset" };
  }
  if (/^(how many sets|how many sets are there|what are the sets|whats the sets)$/.test(text)) {
    return { type: "setsAnnounce" };
  }
  if (text.split(" ").length <= 8 && /\b(what|whats|tell|current|how)\b.*\bscore\b/.test(text)) {
    return { type: "announce" };
  }
  return null;
}

function readSmallNumber(phrase) {
  const tokens = phrase.trim().split(" ").filter(Boolean);
  if (tokens.length === 1 && /^\d{1,2}$/.test(tokens[0])) return Number(tokens[0]);
  if (tokens.length === 1 && tokens[0] in ONES) return ONES[tokens[0]];
  if (tokens.length === 1 && tokens[0] in TENS) return TENS[tokens[0]];
  if (tokens.length === 2 && tokens[0] in TENS && tokens[1] in ONES && ONES[tokens[1]] < 10) {
    return TENS[tokens[0]] + ONES[tokens[1]];
  }
  return null;
}

function titleName(raw) {
  const clean = String(raw || "").replace(/\s+/g, " ").trim().slice(0, 24);
  if (!clean || !/[a-z0-9]/.test(clean)) return "";
  return clean.replace(/\b[a-z0-9]/g, (letter) => letter.toUpperCase());
}

function teamSide(label, teams) {
  const text = normalize(label);
  if (!text) return null;
  if (text === "left") return 0;
  if (text === "right") return 1;
  const hits = [];
  teams.forEach((team, index) => {
    const keys = [...(team.keys || [])];
    if (index === 0) keys.push("left");
    if (index === 1) keys.push("right");
    if (keys.some((key) => normalize(key) === text)) hits.push(index);
  });
  return hits.length === 1 ? hits[0] : null;
}

function settingsCommand(text, teams) {
  const preset = text.match(/^(volleyball|volley ball)$/)
    ? "volleyball"
    : text.match(/^(table tennis|tabletennis|ping pong|pingpong)$/)
      ? "tabletennis"
      : text.match(/^(first to 21|first to twenty one)$/)
        ? "to21"
        : text.match(/^(free play|freeplay)$/)
          ? "free"
          : null;
  if (preset) return { type: "preset", preset };

  const playTo = text.match(/^play to (.+?)(?: points)?$/);
  if (playTo) {
    const points = readSmallNumber(playTo[1]);
    if (points >= 1 && points <= 99) return { type: "pointsTo", points };
  }
  const setsTo = text.match(/^first to (.+?) sets?$/);
  if (setsTo && !/^21$|^twenty one$/.test(setsTo[1])) {
    const sets = readSmallNumber(setsTo[1]);
    if (sets >= 1 && sets <= 9) return { type: "setsTo", sets };
  }
  if (/^(?:must )?win by (?:2|two)$/.test(text)) return { type: "winByTwo", enabled: true };
  if (/^(?:no|not|dont|do not) (?:must )?win by (?:2|two)$/.test(text)) return { type: "winByTwo", enabled: false };

  const color = text.match(new RegExp(`^(left|right) colou?r (${COLOR_PATTERN})$`))
    || text.match(new RegExp(`^(?:make|change|set|turn) (?:the )?(left|right)(?: team)?(?: colou?r)?(?: to)? (${COLOR_PATTERN})$`));
  if (color) return { type: "color", side: color[1] === "left" ? 0 : 1, color: color[2] };

  const renameSide = text.match(/^rename (?:the )?(left|right)(?: team)? to (.+)$/);
  if (renameSide) {
    const name = titleName(renameSide[2]);
    if (name) return { type: "rename", side: renameSide[1] === "left" ? 0 : 1, name };
  }
  const renameNamed = text.match(/^rename (.+) to (.+)$/);
  if (renameNamed) {
    const side = teamSide(renameNamed[1], teams);
    const name = titleName(renameNamed[2]);
    if (side != null && name) return { type: "rename", side, name };
  }

  if (/^(switch|swap|change) (sides|side|teams|ends)$/.test(text)) return { type: "switchSides" };
  const sound = text.match(/^(?:turn )?(?:the )?sounds? (on|off)$/);
  if (sound) return { type: "sound", enabled: sound[1] === "on" };
  if (/^keep (?:the )?screen on$/.test(text)) return { type: "wake", enabled: true };
  if (/^(?:let (?:the )?screen sleep|screen can sleep|screen can turn off)$/.test(text)) return { type: "wake", enabled: false };
  if (/^(nobody(?: is)? serving|no one(?: is)? serving|noone serving|clear(?: the)? serve|stop serving)$/.test(text)) {
    return { type: "clearServe" };
  }
  return null;
}

function interpret(remaining, amount) {
  const unknown = remaining.filter((token) => !KNOWN.has(token));
  if (unknown.length) {
    const known = remaining.filter((token) => KNOWN.has(token));
    const hasAction = known.some((token) => PLUS_WORDS.includes(token) || MINUS_WORDS.includes(token) || SERVE_WORDS.includes(token) || AWARD_WORDS.includes(token) || token === "set");
    if (hasAction) {
      const retry = interpret(known, amount);
      if (retry.type !== "ignore") return { ...retry, guessed: true };
    }
    const tried = remaining.some((token) => STRONG_WORDS.has(token));
    return { type: "ignore", attempt: tried, reason: "unrecognized" };
  }

  const wantsAward =
    amount == null &&
    remaining.includes("set") &&
    remaining.some((token) => AWARD_WORDS.includes(token));
  const wantsServe = remaining.some((token) => SERVE_WORDS.includes(token));
  const wantsMinus =
    remaining.some((token) => MINUS_WORDS.includes(token)) ||
    remaining.includes("away") ||
    remaining.includes("off") ||
    (remaining.includes("take") && amount != null && !remaining.includes("set"));
  const plusVerb = remaining.some((token) => PLUS_WORDS.includes(token) && !PLUS_NOUNS.has(token));
  const plusNoun = remaining.some((token) => PLUS_NOUNS.has(token));
  const wantsPlus = plusVerb || (plusNoun && !wantsMinus) || (remaining.includes("give") && !remaining.includes("set"));

  const kinds = [wantsAward && "award", wantsServe && "serve", wantsMinus && "minus", wantsPlus && "plus"].filter(Boolean);
  if (kinds.length > 1 || (wantsServe && amount != null)) {
    return { type: "ignore", attempt: true, reason: "ambiguous" };
  }
  if (amount === 0) return { type: "ignore", attempt: true, reason: "zero" };
  if (amount != null && amount > MAX_POINTS) return { type: "ignore", attempt: true, reason: "too-big" };

  if (wantsAward) return { type: "awardSet", explicit: true };
  if (wantsServe && amount == null) return { type: "serve", explicit: true };
  if (wantsMinus) return { type: "subtract", amount: amount ?? 1, explicit: true };
  if (wantsPlus || amount != null) return { type: "add", amount: amount ?? 1, explicit: wantsPlus };
  return { type: "ignore", attempt: false, reason: "no-action" };
}

export function parseCommand(raw, teams) {
  const text = stripPrefix(normalize(raw));
  if (!text) return { type: "ignore", attempt: false, reason: "empty" };

  const meta = metaCommand(text) || settingsCommand(text, teams);
  if (meta) return meta;
  if (text.split(" ").length > 14) return { type: "ignore", attempt: false, reason: "too-long" };

  const targets = new Set(GUESS_WORDS);
  targets.add("left");
  targets.add("right");
  for (const team of teams) {
    for (const key of team.keys || []) {
      normalize(key).split(" ").filter(Boolean).forEach((part) => targets.add(part));
    }
  }
  const snappedTokens = snapTokens(text.split(" "), targets);
  const tokens = snappedTokens.tokens;
  if (snappedTokens.snapped) {
    const guessedMeta = metaCommand(tokens.join(" ")) || settingsCommand(tokens.join(" "), teams);
    if (guessedMeta) return { ...guessedMeta, guessed: true };
  }
  if (tokens.some((token) => NEGATIONS.has(token))) {
    return { type: "ignore", attempt: false, reason: "negated" };
  }
  const match = findTeam(tokens, teams);
  if (match?.conflict) return { type: "ignore", attempt: true, reason: "conflict" };
  if (!match) {
    const hinted = tokens.some((token) => STRONG_WORDS.has(token));
    return hinted
      ? { type: "ignore", attempt: true, reason: "which-team" }
      : { type: "ignore", attempt: false, reason: "no-team" };
  }

  const withoutTeam = tokens.filter((_, index) => index < match.index || index >= match.index + match.length);
  const withoutFillers = withoutTeam.filter((token) => !FILLERS.has(token));
  const first = pullNumber(withoutFillers);
  const second = pullNumber(first.rest);
  if (second.value != null) return { type: "ignore", attempt: true, reason: "ambiguous" };

  const action = interpret(first.rest, first.value);
  if (action.type === "ignore") return action;
  return { ...action, teamId: match.team.id, guessed: action.guessed || snappedTokens.snapped || undefined };
}
