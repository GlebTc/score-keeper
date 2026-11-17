import assert from "node:assert/strict";
import { parseCommand } from "../js/parse.js";
import { currentTarget, gamePointTeams, matchWinner, setWinner } from "../js/rules.js";

const teams = [
  { id: "a", keys: ["red"] },
  { id: "b", keys: ["blue"] },
];

function cmd(text, custom = teams) {
  return parseCommand(text, custom);
}

function expectAdd(text, teamId, amount) {
  const result = cmd(text);
  assert.equal(result.type, "add", `${text} -> ${JSON.stringify(result)}`);
  assert.equal(result.teamId, teamId);
  assert.equal(result.amount, amount);
}

expectAdd("red plus 1", "a", 1);
expectAdd("red plus one", "a", 1);
expectAdd("read plus one", "a", 1);
expectAdd("rad plus 1", "a", 1);
expectAdd("Red + 1", "a", 1);
expectAdd("add 2 to blue", "b", 2);
expectAdd("please add two points to blue", "b", 2);
expectAdd("could you please add two points to blue", "b", 2);
expectAdd("blue point", "b", 1);
expectAdd("point for red", "a", 1);
expectAdd("one point blue", "b", 1);
expectAdd("blew plus one", "b", 1);
expectAdd("increment red", "a", 1);
expectAdd("red 2", "a", 2);
expectAdd("give red two", "a", 2);
expectAdd("left score plus 1", "a", 1);
expectAdd("left score", "a", 1);
expectAdd("right score plus 1", "b", 1);
expectAdd("right plus 1", "b", 1);
assert.equal(cmd("left blue plus 1").reason, "conflict");

assert.equal(cmd("blue minus 1").type, "subtract");
assert.equal(cmd("blue minus 1").amount, 1);
assert.equal(cmd("blue team minus 1").type, "subtract");
assert.equal(cmd("blue team minus 1").teamId, "b");
assert.equal(cmd("blue team minus one point").type, "subtract");
assert.equal(cmd("blue team minors 1").type, "subtract");
assert.equal(cmd("blue team serves").type, "serve");
assert.equal(cmd("blue serves").type, "serve");
assert.equal(cmd("blue is serving").type, "serve");
assert.equal(cmd("service blue").type, "serve");
assert.equal(cmd("take 2 from red").type, "subtract");
assert.equal(cmd("take 2 from red").teamId, "a");
assert.equal(cmd("red down 1").type, "subtract");
assert.equal(cmd("penalty blue").type, "subtract");

assert.equal(cmd("undo").type, "undo");
assert.equal(cmd("take that back").type, "undo");
assert.equal(cmd("what's the score?").type, "announce");
assert.equal(cmd("what is the score").type, "announce");
assert.equal(cmd("new game").type, "reset");
assert.equal(cmd("restart the game").type, "reset");
assert.equal(cmd("restart game").type, "reset");
assert.equal(cmd("restart the score").type, "newSet");
assert.equal(cmd("restart score").type, "newSet");
assert.equal(cmd("reset the score").type, "newSet");
assert.equal(cmd("yes").type, "confirm");
assert.equal(cmd("stop listening").type, "stop");
assert.equal(cmd("red serve").type, "serve");
assert.equal(cmd("red wins the set").type, "awardSet");
assert.equal(cmd("award set to blue").type, "awardSet");
assert.equal(cmd("next set").type, "newSet");

assert.equal(cmd("left color green").type, "color");
assert.equal(cmd("left color green").side, 0);
assert.equal(cmd("left color green").color, "green");
assert.equal(cmd("right colour gold").color, "gold");
assert.equal(cmd("make the left team purple").side, 0);
assert.equal(cmd("make the left team purple").color, "purple");
assert.equal(cmd("change right to teal").color, "teal");
assert.equal(cmd("switch blue team to yellow").type, "color");
assert.equal(cmd("switch blue team to yellow").side, 1);
assert.equal(cmd("switch blue team to yellow").color, "yellow");
assert.equal(cmd("change the blue team to yellow").color, "yellow");
assert.equal(cmd("make blue yellow").side, 1);
assert.equal(cmd("set blue color to yellow").color, "yellow");
assert.equal(cmd("turn the red team gold").side, 0);
assert.equal(cmd("turn the red team gold").color, "gold");
assert.equal(cmd("switch colors").type, "swapColors");
assert.equal(cmd("swap the team colors").type, "swapColors");
assert.equal(cmd("switch sides").type, "switchSides");
assert.equal(cmd("blue plus 1").type, "add");
assert.equal(cmd("change blue to 15").type, "setScore");
assert.equal(cmd("volleyball").preset, "volleyball");
assert.equal(cmd("play volleyball").preset, "volleyball");
assert.equal(cmd("let's play volleyball").preset, "volleyball");
assert.equal(cmd("set the game to volleyball").preset, "volleyball");
assert.equal(cmd("volleyball please").preset, "volleyball");
assert.equal(cmd("switch the sides").type, "switchSides");
assert.equal(cmd("change sides").type, "switchSides");
assert.equal(cmd("left green").type, "color");
assert.equal(cmd("left green").color, "green");
assert.equal(cmd("left team green").side, 0);
assert.equal(cmd("change the color of the left team to green").color, "green");
assert.equal(cmd("make left green").side, 0);
assert.equal(cmd("turn the sound off").enabled, false);
assert.equal(cmd("unmute the sound").enabled, true);
assert.equal(cmd("play to 15 please").points, 15);
assert.equal(cmd("play to 21").type, "pointsTo");
assert.equal(cmd("play to 21").points, 21);
assert.equal(cmd("first to 15").type, "pointsTo");
assert.equal(cmd("first to 15").points, 15);
assert.equal(cmd("first to 2 sets please").sets, 2);
assert.equal(cmd("no win by two points").enabled, false);
assert.equal(cmd("mute").type, "stop");
assert.equal(cmd("table tennis").preset, "tabletennis");
assert.equal(cmd("ping pong").preset, "tabletennis");
assert.equal(cmd("first to 21").preset, "to21");
assert.equal(cmd("free play").preset, "free");
assert.equal(cmd("play to 15").type, "pointsTo");
assert.equal(cmd("play to fifteen").points, 15);
assert.equal(cmd("first to 2 sets").type, "setsTo");
assert.equal(cmd("first to two sets").sets, 2);
assert.equal(cmd("win by 2").enabled, true);
assert.equal(cmd("no win by two").type, "winByTwo");
assert.equal(cmd("no win by two").enabled, false);
assert.equal(cmd("switch sides").type, "switchSides");
assert.equal(cmd("swap teams").type, "switchSides");
assert.equal(cmd("rename left to hawks").type, "rename");
assert.equal(cmd("rename left to hawks").side, 0);
assert.equal(cmd("rename left to hawks").name, "Hawks");
assert.equal(cmd("rename blue to red hawks").name, "Red Hawks");
assert.equal(cmd("sound off").type, "sound");
assert.equal(cmd("sound off").enabled, false);
assert.equal(cmd("turn the sound on").enabled, true);
assert.equal(cmd("keep the screen on").type, "wake");
assert.equal(cmd("keep the screen on").enabled, true);
assert.equal(cmd("screen can sleep").enabled, false);
assert.equal(cmd("how many sets").type, "setsAnnounce");
assert.equal(cmd("nobody serving").type, "clearServe");
assert.equal(cmd("no one is serving").type, "clearServe");
assert.equal(cmd("mute").type, "stop");
assert.equal(cmd("blue plus 1").type, "add");
assert.equal(cmd("what's the score").type, "announce");
assert.equal(cmd("tell me the score").type, "announce");
assert.equal(cmd("read the score").type, "announce");
assert.equal(cmd("say the score").type, "announce");
assert.equal(cmd("repeat the score").type, "announce");
assert.equal(cmd("give me the score").type, "announce");
assert.equal(cmd("current score").type, "announce");
assert.equal(cmd("score please").type, "announce");
assert.equal(cmd("score").type, "announce");
assert.equal(cmd("who's winning").type, "announce");
assert.equal(cmd("who is ahead").type, "announce");
assert.equal(cmd("how many points").type, "announce");
assert.equal(cmd("please tell me the score").type, "announce");
assert.equal(cmd("blue score").type, "add");

assert.equal(cmd("red blue plus 1").reason, "conflict");
assert.equal(cmd("hello there").attempt, false);
assert.equal(cmd("nice point").attempt, false);
assert.equal(cmd("red").attempt, false);
assert.equal(cmd("plus one").reason, "which-team");
expectAdd("red plus 20", "a", 20);
expectAdd("red plus 21", "a", 21);
assert.equal(cmd("red score 21").type, "setScore");
assert.equal(cmd("red score 21").teamId, "a");
assert.equal(cmd("red score 21").amount, 21);
assert.equal(cmd("red score is 21").type, "setScore");
assert.equal(cmd("red's score is twenty one").amount, 21);
assert.equal(cmd("set red score to 21").type, "setScore");
assert.equal(cmd("left score 21").teamId, "a");
assert.equal(cmd("blue score 0").amount, 0);
assert.equal(cmd("change blue to 15").type, "setScore");
assert.equal(cmd("change blue to 15").amount, 15);
assert.equal(cmd("red score plus 5").type, "add");
assert.equal(cmd("red plus 1000").reason, "too-big");
assert.equal(cmd("red banana").reason, "unrecognized");

const hawks = [
  { id: "a", keys: ["red hawks"] },
  { id: "b", keys: ["blue"] },
];
assert.equal(cmd("red hawks plus 1", hawks).teamId, "a");
assert.equal(cmd("read hawks plus 1", hawks).teamId, "a");
expectAdd("reed plus one", "a", 1);
expectAdd("red pluss one", "a", 1);
expectAdd("blu point", "b", 1);
expectAdd("red get a point", "a", 1);
expectAdd("i want one point for red", "a", 1);
expectAdd("nice point red", "a", 1);
expectAdd("one more for red", "a", 1);
assert.equal(cmd("reed plus one").guessed, true);
assert.equal(cmd("red plus 1").guessed, undefined);
assert.equal(cmd("red no point").type, "ignore");
assert.equal(cmd("minos one blue").type, "subtract");
assert.equal(cmd("minos one blue").teamId, "b");

const volleyball = { pointsToWin: 25, winByTwo: true, setsToWin: 2, decidingPoints: 15 };
assert.equal(setWinner([25, 23], [0, 0], volleyball), 0);
assert.equal(setWinner([25, 24], [0, 0], volleyball), null);
assert.equal(setWinner([26, 24], [0, 0], volleyball), 0);
assert.equal(setWinner([24, 0], [0, 0], volleyball), null);
assert.equal(currentTarget([1, 1], volleyball), 15);
assert.equal(setWinner([15, 13], [1, 1], volleyball), 0);
assert.equal(setWinner([15, 14], [1, 1], volleyball), null);
assert.equal(setWinner([30, 10], [0, 0], { pointsToWin: 0, winByTwo: false, setsToWin: 0, decidingPoints: 0 }), null);
assert.equal(matchWinner([2, 1], volleyball), 0);
assert.equal(matchWinner([1, 1], volleyball), null);
assert.equal(matchWinner([1, 0], { ...volleyball, setsToWin: 0 }), null);
assert.deepEqual(gamePointTeams([24, 22], [0, 0], volleyball), [0]);
assert.deepEqual(gamePointTeams([24, 24], [0, 0], volleyball), []);
assert.deepEqual(gamePointTeams([25, 24], [0, 0], volleyball), [0]);
assert.deepEqual(gamePointTeams([14, 12], [1, 1], volleyball), [0]);
assert.deepEqual(gamePointTeams([9, 9], [0, 0], { pointsToWin: 10, winByTwo: false, setsToWin: 1, decidingPoints: 10 }), [0, 1]);
assert.deepEqual(gamePointTeams([20, 19], [0, 0], { pointsToWin: 0, winByTwo: false, setsToWin: 0, decidingPoints: 0 }), []);

console.log("commands.test.js passed");
