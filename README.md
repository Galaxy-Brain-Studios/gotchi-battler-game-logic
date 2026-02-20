# Galaxy Brain Studios - Gotchi Battler Game Logic

This npm module contains the game logic for the Gotchi Battler game developed by Galaxy Brain Studios.

It has been split out into an npm module for two reasons:
1. So that it can be used in both the frontend and backend of the Gotchi Battler game. This allows heavy simulations and training to be done on the frontend (users browser), to reduce server load, and in the backend when provable randomness is needed.
2. So that users can verify game results by rerunning the exact same version of the game logic that produced a battle log. Battle logs include `meta.gameLogicVersion`, which matches the npm package version (and GitHub tag, e.g. `v4.0.26`).

## Installation

To install the module, run the following command:

```
npm install gotchi-battler-game-logic
```

## Usage

To use the module in your project, import it as follows:

```javascript
const { battle } = require('gotchi-battler-game-logic')

// team1 and team2 an in-game team objects (see below)
// seed is a random seed for the game
const result = battle(team1, team2, seed)
```
The schema for the in-game team object can be found in `/schemas/team.json`

Examples of the in-game team object can be found in `/scripts/data/team1.json` and `/scripts/data/team2.json`

## Development
To reproduce a battle log, check out the matching GitHub tag for the log’s `meta.gameLogicVersion` (for example `v4.0.26`), install dependencies, and rerun the battle locally.