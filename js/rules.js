export const PRESETS = {
  free: { pointsToWin: 0, winByTwo: false, setsToWin: 0, decidingPoints: 15 },
  volleyball: { pointsToWin: 25, winByTwo: true, setsToWin: 2, decidingPoints: 15 },
  tabletennis: { pointsToWin: 11, winByTwo: true, setsToWin: 3, decidingPoints: 11 },
  to21: { pointsToWin: 21, winByTwo: true, setsToWin: 1, decidingPoints: 21 },
};

export function currentTarget(sets, rules) {
  const goal = Number(rules.pointsToWin) || 0;
  if (!goal) return 0;
  const need = Number(rules.setsToWin) || 0;
  if (need >= 2 && sets[0] === need - 1 && sets[1] === need - 1) {
    return Number(rules.decidingPoints) || goal;
  }
  return goal;
}

export function gamePointTeams(scores, sets, rules) {
  const target = currentTarget(sets, rules);
  if (!target) return [];
  return [0, 1].filter((index) => {
    const next = scores.slice();
    next[index] += 1;
    return setWinner(next, sets, rules) === index;
  });
}

export function setWinner(scores, sets, rules) {
  const target = currentTarget(sets, rules);
  if (!target) return null;
  const qualified = [0, 1].filter((index) => {
    const lead = scores[index] - scores[1 - index];
    return scores[index] >= target && (!rules.winByTwo || lead >= 2);
  });
  return qualified.length === 1 ? qualified[0] : null;
}

export function matchWinner(sets, rules) {
  const need = Number(rules.setsToWin) || 0;
  if (!need) return null;
  for (let index = 0; index < 2; index += 1) {
    if (sets[index] >= need) return index;
  }
  return null;
}
