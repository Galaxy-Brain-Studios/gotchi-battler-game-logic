const axios = require('axios')
const axiosRetry = require('axios-retry').default
axiosRetry(axios, { 
    retries: 3, 
    retryDelay: axiosRetry.exponentialDelay
})
const fs = require('fs')
const path = require('path')

const { webappTeamToInGameTeam } = require('../utils/transforms')
const { battle } = require('..')

const main = async (battleId) => {

    const battleRes = await axios.get(`https://gotchi-battler-backend-blmom6tkla-ew.a.run.app/api/v1/battles/${battleId}`)

    if (!battleRes || !battleRes.data || !battleRes.data.seed || !battleRes.data.team1 || !battleRes.data.team2) {
        console.error('Battle not found')
        return
    }

    const seed = battleRes.data.seed

    // Transform the logs to in-game teams
    const team1 = webappTeamToInGameTeam(battleRes.data.team1Snapshot || battleRes.data.team1)
    const team2 = webappTeamToInGameTeam(battleRes.data.team2Snapshot || battleRes.data.team2)

    // Run the game loop
    const logs = await battle(team1, team2, seed, true)

    // Write the logs to a file
    fs.writeFileSync(path.join(__dirname, 'output', `${battleId}.json`), JSON.stringify(logs, null, '\t'))

    return logs
}

module.exports = main

// node scripts/runRealBattle.js 19566507-bafe-4a97-a5ee-0926ac9efcd8
if (require.main === module) {
    const battleId = process.argv[2]

    main(battleId)
        .then(() => {
            console.log('Done')
            process.exit(0)
        })
        .catch((error) => {
            console.error('Error: ', error)
            process.exit(1)
        })
}
