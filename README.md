# Score Keeper

A volleyball-style scoreboard that runs in the browser. Say “red plus 1” and that team gets a point. Scores stay on this device. There are no accounts.

## Run it

```bash
npm start
```

Open http://localhost:3000. The `+` and `-` buttons work in any browser. Voice needs Chrome, Edge, or Safari, and the page must be on `localhost` or `https://`. Opening the file directly will not enable the microphone.

Chrome sends the audio to Google, so voice needs an internet connection. On an iPhone or iPad, tap the mic once per point. On a computer, it keeps listening.

## Commands

A few ways to say the same thing all count.

- “Red plus 1”, “blue minus 1”, “left score plus 1”, “right plus 1”
- “Red score 21” sets that team’s score. “Red plus 21” adds 21
- “Blue serve”
- “What’s the score?”, “who’s winning?”
- “Red wins the set”
- “Restart the score” clears the points and keeps the sets
- “Restart the game”, then “yes”
- “Play volleyball”, “table tennis”, “first to 21”, “free play”
- “Play to 15”, “first to 2 sets”, “win by 2”, “no win by 2”
- “Switch blue team to yellow”, “left green”, “switch colors”
- “Switch the sides”, “rename left to Hawks”
- “Sound off”, “keep the screen on”, “how many sets?”, “nobody serving”
- “Undo”
- “Stop” turns the mic off

When a team wins, the app says that team’s name. The set count stays on the screen.

## Install

On Android, open the site in Chrome and choose **Install app**. On iPhone, use **Share**, then **Add to Home Screen**. The public site needs to be on `https://` for that.

Netlify can publish this folder as it is. The build command is `npm test`, and the publish directory is `.`.
