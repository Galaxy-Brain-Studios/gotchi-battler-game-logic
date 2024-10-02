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

    try {
        // Run the game loop
        const logs = await gameLoop(teams[0], teams[1], seed)

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

// node scripts/validateBattle.js 4d0f3c5c-08a0-42db-bd34-dee44300685a 82807311112923564712218359337695919195403960526804010606215202651499586140469
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
