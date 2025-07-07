const axios = require('axios')
const axiosRetry = require('axios-retry').default
axiosRetry(axios, { 
    retries: 3, 
    retryDelay: axiosRetry.exponentialDelay
})

const { GameError, ValidationError } = require('../utils/errors')
const { logToInGameTeams } = require('../utils/transforms')
const { compareLogs } = require('../utils/validations')
const gameVersions = require('../game-logic')

const main = async (battleId, seed, gameLogicVersion) => {

    if (!gameLogicVersion) gameLogicVersion = gameVersions.current
    if (!gameVersions[gameLogicVersion]) throw new Error('Invalid game logic version')
        
    const gameLoop = gameVersions[gameLogicVersion].gameLoop
    
    const res = await axios.get(`https://storage.googleapis.com/gotchi-battler-live_battles/v1/${battleId}.json`)

    if (!res || !res.data || !res.data.layout) {
        console.error('Battle not found')
        return
    }

    // Transform the logs to in-game teams
    const teams = logToInGameTeams(res.data)

    // If the game logic has a removeStatItems function, call it
    // This is so the item buffs don't get applied twice
    const helpers = require(`../game-logic/${gameLogicVersion}/helpers`)

    if (helpers.removeStatItems) {
        helpers.removeStatItems(helpers.getAlive(teams[0]))
        helpers.removeStatItems(helpers.getAlive(teams[1]))
    }

    try {
        // Run the game loop
        const logs = await gameLoop(teams[0], teams[1], seed, true)

        // fs.writeFileSync(path.join(__dirname, 'output', `${battleId}_${Date.now()}.json`), JSON.stringify(logs, null, '\t'))

        // Validate the results
        compareLogs(res.data, logs)

        return logs
    } catch (error) {
        if (error instanceof GameError) {
            console.error('Errored game logs: ', error.logs)
        }

        throw error
    }
}

module.exports = main

// node scripts/validateBattle.js 19566507-bafe-4a97-a5ee-0926ac9efcd8 86621513544048786694066938490119673052266855523096067323796322823978866460212
if (require.main === module) {
    const battleId = process.argv[2]
    const seed = process.argv[3]
    const gameLogicVersion = process.argv[4]

    main(battleId, seed, gameLogicVersion)
        .then(() => {
            console.log('Results from game logic match the logs ✅')
            console.log('Done')
            process.exit(0)
        })
        .catch((error) => {
            if (error instanceof ValidationError) {
                console.error('Results from game logic do not match the logs ❌')
            }
            
            console.error('Error: ', error.message)

            process.exit(1)
        })
}
