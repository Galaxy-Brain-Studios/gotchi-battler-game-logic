const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { getTournamentContract } = require('../utils/contracts')
const { ValidationError } = require('../utils/errors')
const tournaments = require('./data/tournaments.json')
const validateBattle = require('./validateBattle')

const main = async (tournamentId) => {

    console.log(`Getting tournament config for id  ${tournamentId}...`)

    const tournamentConfig = tournaments.find(t => `${t.id}` === `${tournamentId}`)

    if (!tournamentConfig || !tournamentConfig.gameLogicVersion) {
        console.error('Tournament config not found with id:', tournamentId)
        return
    }

    console.log(`Found, using game logic version "${tournamentConfig.gameLogicVersion}" ✅`)
    console.log(`Getting tournament data for id: ${tournamentId}...`)

    const tournament = await axios.get(`https://gotchi-battler-backend-blmom6tkla-ew.a.run.app/api/v1/tournaments/${tournamentId}`)

    if (!tournament || !tournament.data || !tournament.data.address) {
        console.error('Tournament not found with id:', tournamentId)
        return
    }

    const onchainAddress = tournament.data.address

    const brackets = await axios.get(`https://gotchi-battler-backend-blmom6tkla-ew.a.run.app/api/v1/tournaments/${tournamentId}/brackets`)

    if (!brackets || !brackets.data || !brackets.data.length) {
        console.error('Brackets not found')
        return
    }

    console.log(`Tournament data for id ${tournamentId} found ✅`)
    console.log(`Validating "${tournament.data.name}"...`)
    console.log('(This process can take up to 20 minutes for large tournaments)')
    for (const bracket of brackets.data) {
        console.log(`Validating "${bracket.name}"...`)
        for (const round of bracket.rounds) {
            for (const battle of round.battles) {
                // If battle is a BYE then skip
                if (!battle.team1Id || !battle.team2Id) {
                    continue
                }

                // Get seed for the battle
                const tournamentContract = getTournamentContract(onchainAddress)
                const seed = await tournamentContract.roundSeeds(round.roundStage)

                try {
                    await validateBattle(battle.id, seed.toString(), tournamentConfig.gameLogicVersion)
                } catch (error) {
                    if (error instanceof ValidationError) {
                        console.error(`Battle ${battle.id} failed validation ❌`)
                        console.error(`Seed: "${seed.toString()}"`)

                        // Write original logs to file
                        const originalLogsFilename = `${battle.id}-originalLogs.json`
                        fs.writeFileSync(path.join(__dirname, 'output', originalLogsFilename), JSON.stringify(error.originalLogs, null, '\t'))

                        // Write new logs to file
                        const newLogsFilename = `${battle.id}-newLogs.json`
                        fs.writeFileSync(path.join(__dirname, 'output', newLogsFilename), JSON.stringify(error.newLogs, null, '\t'))

                        console.error(`Original logs written to ${path.join(__dirname, 'output', originalLogsFilename)}`)
                        console.error(`New logs written to ${path.join(__dirname, 'output', newLogsFilename)}`)
                    }

                    throw error
                }
                
            }
            console.log(`Round ${round.roundStage} validated ✅`)
        }
        console.log(`"${bracket.name}" validated ✅`)
    }
    console.log(`"${tournament.data.name}" validated ✅`)
}

module.exports = main

// node scripts/validateTournament.js 15
if (require.main === module) {
    const tournamentId = process.argv[2]

    main(tournamentId)
    .then(() => {
        console.log('Done')
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)

        process.exit(1)
    })
}
