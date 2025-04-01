# Galaxy Brain Studios - Gotchi Battler Game Logic

This npm module contains the game logic for the Gotchi Battler game developed by Galaxy Brain Studios.

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

### Validate Tournament

The validate tournament script does the following:
- Fetches the data of a tournament from the Gotchi Battler website
- Loops through all the battles in the tournament, bracket by bracket, round by round
- For each battle, the logs are fetched from the Gotchi Battler website
- The battle is then simulated locally using the game logic
- The result of this simulation is then compared to the logs from the Gotchi Battler website

To validate the battles from the RF8 100K Tournament, run the following command:

```bash
node scripts/validateTournament.js 15
```

Get the tournament id from the URL of the tournament page on the Gotchi Battler website.


PLEASE NOTE:
- Currently, only the tournaments from Rarity Farming season 8 and 9 are supported (Tournament IDs 13-15 + 18)
- The script can take a while to run, in local testing it took around 20 minutes