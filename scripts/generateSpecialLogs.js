// Generate logs which test the sequences for all special attacks
const fs = require('fs')
const path = require('path')
const seedrandom = require('seedrandom')
const { attack } = require('../game-logic/v2.0')
const { getAlive, prepareTeams, getLogGotchis, simplifyTeam } = require('../game-logic/v2.0/helpers')
const ninjaSpecials = require('../../gotchi-battler-backend/data/specials_ninja.json')
const enlightenedSpecials = require('../../gotchi-battler-backend/data/specials_enlightened.json')
const cleaverSpecials = require('../../gotchi-battler-backend/data/specials_cleaver.json')
const tankSpecials = require('../../gotchi-battler-backend/data/specials_tank.json')
const cursedSpecials = require('../../gotchi-battler-backend/data/specials_cursed.json')
const healerSpecials = require('../../gotchi-battler-backend/data/specials_healer.json')
const mageSpecials = require('../../gotchi-battler-backend/data/specials_mage.json')
const trollSpecials = require('../../gotchi-battler-backend/data/specials_troll.json')

const specials = [
    ...ninjaSpecials, ...enlightenedSpecials, 
    ...cleaverSpecials, ...tankSpecials, 
    ...cursedSpecials, ...healerSpecials, 
    ...mageSpecials, ...trollSpecials
]

const main = async () => {
    for (const special of specials) {
        // Mock the game loop
        let team1 = require('./data/oggyMaxi.json')
        let team2 = require('./data/wagdiddly.json')

        team1 = JSON.parse(JSON.stringify(team1))
        team2 = JSON.parse(JSON.stringify(team2))

        const seed = 'randomseed'
        const rng = seedrandom(seed)

        // Give all gotchis 100000 health for testing
        const allAliveGotchis = [...getAlive(team1), ...getAlive(team2)]
        allAliveGotchis.forEach(x => {
            x.health = 1000000
        })

        prepareTeams(allAliveGotchis, team1, team2)

        const logs = {
            meta: {
                seed,
                timestamp: new Date(),
                type: 'pvp',
                campaign: {},
                isBoss: false
            },
            gotchis: getLogGotchis(allAliveGotchis),
            layout: {
                teams: [
                    simplifyTeam(team1),
                    simplifyTeam(team2)
                ]
            },
            turns: [],
            result: {},
            debug: []
        }
        
        let turnCounter = 0

        // Do the special attack 10 times in a row
        for (let i = 0; i < 10; i++) {
            const specialResults = attack({
                ...allAliveGotchis[0],
                special: special.code, 
                specialExpanded: special
            }, team1, team2, rng, true)

            logs.turns.push({
                index: turnCounter,
                skipTurn: null,
                action: {
                    user: allAliveGotchis[0].id,
                    name: special.code,
                    actionEffects: specialResults.actionEffects,
                    additionalEffects: specialResults.additionalEffects
                },
                statusEffects: [],
                statusesExpired: specialResults.statusesExpired
            })
            turnCounter++
        }

        // Save logs to file
        fs.writeFileSync(path.join(__dirname, 'output', 'specials', `${special.code}.json`), JSON.stringify(logs, null, 2))
    }
}

// node scripts/generateSpecialLogs.js
main()