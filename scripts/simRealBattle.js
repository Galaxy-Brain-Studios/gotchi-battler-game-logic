const axios = require('axios')
const axiosRetry = require('axios-retry').default
axiosRetry(axios, { 
    retries: 3, 
    retryDelay: axiosRetry.exponentialDelay
})

const { webappTeamToInGameTeam } = require('../utils/transforms')
const { mapTeam } = require('../utils/mapGotchi')
const { battle } = require('..')

const main = async (battleId) => {

    const battleRes = await axios.get(`https://gotchi-battler-backend-blmom6tkla-ew.a.run.app/api/v1/battles/${battleId}`)

    if (!battleRes || !battleRes.data || !battleRes.data.team1 || !battleRes.data.team2) {
        console.error('Battle not found')
        return
    }

    // Transform the logs to in-game teams
    const team1 = webappTeamToInGameTeam(battleRes.data.team1Snapshot || battleRes.data.team1)
    const team2 = webappTeamToInGameTeam(battleRes.data.team2Snapshot || battleRes.data.team2)

    console.log('Team 1', team1.formation.front.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    }).concat(team1.formation.back.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    })))
    console.log('Team 2', team2.formation.front.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    }).concat(team2.formation.back.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    })))

    mapTeam(team1)
    mapTeam(team2)

    console.log('Team 1', team1.formation.front.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    }).concat(team1.formation.back.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    })))
    console.log('Team 2', team2.formation.front.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    }).concat(team2.formation.back.filter(g => g).map(g => {
        return {
            name: g.name,
            health: g.health,
            magic: g.magic,
            physical: g.physical
        }
    })))

    // Run 1000 sims to get the average stats
    let team1Wins = 0
    let team2Wins = 0
    for (let i = 0; i < 1000; i++) {
        const logs = await battle(team1, team2, `${Math.random()}`, false)
        if (logs.result.winner === 1) {
            team1Wins++
        } else {
            team2Wins++
        }
    }

    console.log(`Team 1 wins: ${team1Wins}`)
    console.log(`Team 2 wins: ${team2Wins}`)
}

module.exports = main

// node scripts/simRealBattle.js 19566507-bafe-4a97-a5ee-0926ac9efcd8
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
