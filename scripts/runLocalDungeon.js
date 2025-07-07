const fs = require('fs')
const path = require('path')
const { battle } = require('..')

// Edit these json files to test different battles
// NOTE: Only the in-game stats (speed, health, crit etc..) are used in the game logic
const team1 = require('./data/team1.json')
const mob1 = require('./data/dungeon_mob_1.json')
const mob2 = require('./data/dungeon_mob_2.json')

const mobs = {
    'DUNGEON_1_MOB_1': mob1,
    'DUNGEON_1_MOB_2': mob2,
}

const scenario = {
    'id': 'scenario123',
    'name': 'Dungeon 1',
    'battles': [
        {
            'id': 'battle1',
            'environment': 'DUNGEON_1_1',
            'mob': 'DUNGEON_1_MOB_1',
        },
        {
            'id': 'battle2',
            'environment': 'DUNGEON_1_2',
            'mob': 'DUNGEON_1_MOB_2',
        }
    ]
}

for (let i = 0; i < scenario.battles.length; i++) {
    const scenarioBattle = scenario.battles[i]
    const logs = battle(team1, mobs[scenarioBattle.mob], 'arandomseed', true)

    scenarioBattle.logs = logs
    
    if (logs.result.winner === 1) {
        team1.startingState = logs.result.winningTeam
    } else {
        break
    }
}

const timestamp = new Date().getTime()
const resultsFilename = `results-${timestamp}.json`
fs.writeFileSync(path.join(__dirname, 'output', resultsFilename), JSON.stringify(scenario, null, '\t'))

console.log(`Results written to ${path.join(__dirname, 'output', resultsFilename)}`)

// node scripts/runLocalDungeon.js