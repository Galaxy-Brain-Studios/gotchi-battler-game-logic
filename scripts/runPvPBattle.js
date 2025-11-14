const fs = require('fs')
const path = require('path')
const { battle } = require('..')

// Edit these json files to test different battles
// NOTE: Only the in-game stats (speed, health, crit etc..) are used in the game logic
const team1 = require('./data/immaterialTeam1.json')
const team2 = require('./data/immaterialTeam2.json')

const results = battle(team1, team2, 'randomseed', {
    debug: false,
    type: 'pvp'
})

fs.writeFileSync(path.join(__dirname, 'data', 'pvp', 'pvp-results.json'), JSON.stringify(results, null, '\t'))

// node scripts/runPvPBattle.js