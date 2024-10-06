require('dotenv').config()
const path = require('path')
const crypto = require('crypto')
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()
const classes = ['Ninja','Enlightened','Cleaver','Tank','Cursed','Healer', 'Mage', 'Troll']

/**
 * Create teams from all the possible trait combinations from the class combination
 * @param {Array} classCombo The class combinations
 * @param {Array} classTraitCombos The trait combinations for each class
 * @param {Array} powerLevels The power levels
 * @returns {Object} A team object
 */
const createTeamIndexes = (classCombos, classTraitCombos, powerLevels, trainingGotchis) => {

    const teams = []

    classCombos.forEach(classCombo => {
        powerLevels.forEach(powerLevel => {
            // Loop over how many trait sets there are in the classTraitCombos array
            classTraitCombos[0].forEach((x, i) => {
                const team = []
                classCombo.forEach(classIndex => {
                    const gotchiName = `${powerLevel} ${classTraitCombos[classIndex - 1][i]} ${classes[classIndex - 1]}`
                    const gotchi = trainingGotchis.find(gotchi => {
                        return gotchi.name === gotchiName
                    })

                    if (!gotchi) throw new Error(`Gotchi not found: "${gotchiName}"`)
                    
                    team.push(gotchi.id)
                })
                teams.push(team)
            })
        })
    })

    return teams
}

/**
 * Creates an in game team object from a team index
 * @param {Array} teamIndex An array of gotchi ids
 * @returns {Object} An in game team object
 */
const createTeamFromTeamIndex = (teamIndex, trainingGotchis, setTeamPositions) => {
    const team = {
        formation: {
            front: [null, null, null, null, null],
            back: [null, null, null, null, null],
        },
        leader: null,
        name: null,
        owner: null
    }

    // Put all in the back row for now
    team.formation.back = teamIndex.map(gotchiId => {
        const gotchi = trainingGotchis.find(gotchi => gotchi.id === gotchiId)

        if (!gotchi) throw new Error(`Gotchi not found with id: "${gotchiId}"`)

        return gotchi
    })

    team.leader = team.formation.back[0].id
    team.name = `${team.formation.back[0].name[0]} ${teamIndex}` // e.g. "M 1,2,3,4,5"
    team.owner = '0x0000000000000000000000000000000000000000'

    // Set the team positions for each gotchi being in the front or back row
    setTeamPositions(team)

    return team
}

const getGotchisSimNameFromTeam = (team) => {
    const names = [];

    [0,1,2,3,4].forEach(i => {
        const gotchi = team.formation.back[i] || team.formation.front[i]
        const position  = !!team.formation.back[i] ? 'B' : 'F'

        const nameParts = gotchi.name.split(' ')
        // Return e.g. "R|++++|1_B"
        names.push(`${nameParts[0][0]}|${nameParts[1]}|${classes.indexOf(nameParts[2]) + 1}_${position}`)
    })  
    return names
}

const runSims = async (simsVersion, gameLogicVersion, simsPerMatchup) => {
    const trainingGotchis = require(`./${simsVersion}/training_gotchis.json`)
    const classCombos = require(`./${simsVersion}/class_combos.json`)
    const classTraitCombos = require(`./${simsVersion}/trait_combos.json`)
    const setTeamPositions = require(`./${simsVersion}/setTeamPositions`)
    const gameLogic = require("../../game-logic")[gameLogicVersion].gameLoop

    const attackingPowerLevels = ['Mythical']
    const defendingPowerLevels = ['Mythical', 'Legendary', 'Rare']
    
    const attackingTeamIndexes = createTeamIndexes(classCombos, classTraitCombos, attackingPowerLevels, trainingGotchis)
    const defendingTeamIndexes = createTeamIndexes(classCombos, classTraitCombos, defendingPowerLevels, trainingGotchis)

    // Which attacking team are we running the sims on?
    // If running on Cloud Run, use the task index
    // If running locally, use the command line argument or default to 0
    const attackingTeamIndex = process.env.CLOUD_RUN_TASK_INDEX ? parseInt(process.env.CLOUD_RUN_TASK_INDEX) : parseInt(process.argv[2]) || 0

    // Get the attacking team
    const attackingTeam = createTeamFromTeamIndex(attackingTeamIndexes[attackingTeamIndex], trainingGotchis, setTeamPositions)
    const gotchiSimNames = getGotchisSimNameFromTeam(attackingTeam)
    // Run the sims for each defending team
    const results = {
        id: attackingTeamIndex,
        slot1: gotchiSimNames[0],
        slot2: gotchiSimNames[1],
        slot3: gotchiSimNames[2],
        slot4: gotchiSimNames[3],
        slot5: gotchiSimNames[4],
        wins: 0,
        draws: 0,
        losses: 0,
        winsMythical: 0,
        drawsMythical: 0,
        lossesMythical: 0,
        winsLegendary: 0,
        drawsLegendary: 0,
        lossesLegendary: 0,
        winsRare: 0,
        drawsRare: 0,
        lossesRare: 0
    }
    defendingTeamIndexes.forEach((defendingTeamIndex, i) => {
        const defendingTeam = createTeamFromTeamIndex(defendingTeamIndex, trainingGotchis, setTeamPositions)
        
        let matchupWins = 0
        let matchupDraws = 0
        let matchupLosses = 0

        // Run the sims
        Array(simsPerMatchup).fill(null).forEach(() => {
            // Quit early if result is already determined
            if (matchupWins >= simsPerMatchup / 2 || 
                matchupLosses >= simsPerMatchup / 2 || 
                matchupDraws >= simsPerMatchup / 2) return

            const logs = gameLogic(attackingTeam, defendingTeam, crypto.randomBytes(32).toString('hex'))

            if (logs.result.winner === 1) matchupWins++
            if (logs.result.winner === 0) matchupDraws++
            if (logs.result.winner === 2) matchupLosses++
        })

        // Get first letter of oppeonent team name to determine power level
        const powerLevel = defendingTeam.name[0]

        if (matchupWins >= simsPerMatchup / 2) {
            results.wins++
            if (powerLevel === 'M') results.winsMythical++
            if (powerLevel === 'L') results.winsLegendary++
            if (powerLevel === 'R') results.winsRare++
        }

        if (matchupDraws >= simsPerMatchup / 2) {
            results.draws++
            if (powerLevel === 'M') results.drawsMythical++
            if (powerLevel === 'L') results.drawsLegendary++
            if (powerLevel === 'R') results.drawsRare++
        }

        if (matchupLosses >= simsPerMatchup / 2) {
            results.losses++
            if (powerLevel === 'M') results.lossesMythical++
            if (powerLevel === 'L') results.lossesLegendary++
            if (powerLevel === 'R') results.lossesRare++
        }
    })

    // Check total wins, draws, losses to make sure they add up to number of defending teams
    const totalMatchups = results.wins + results.draws + results.losses
    if (totalMatchups !== defendingTeamIndexes.length) {
        throw new Error(`Total matchups (${totalMatchups}) does not match number of defending teams (${defendingTeamIndexes.length})`)
    }

    // Check power level wins, draws, losses to make sure they add up to number of defending teams
    const totalMythicalMatchups = results.winsMythical + results.drawsMythical + results.lossesMythical
    const totalLegendaryMatchups = results.winsLegendary + results.drawsLegendary + results.lossesLegendary
    const totalRareMatchups = results.winsRare + results.drawsRare + results.lossesRare
    const totalPowerLevelMatchups = totalMythicalMatchups + totalLegendaryMatchups + totalRareMatchups
    if (totalPowerLevelMatchups !== defendingTeamIndexes.length) {
        throw new Error(`Total power level matchups (${totalPowerLevelMatchups}) does not match number of defending teams (${defendingTeamIndexes.length})`)
    }

    if (process.env.CLOUD_RUN_JOB && process.env.SIMS_BUCKET) {
        // Save as JSON to GCS
        try {
            await storage.bucket(process.env.SIMS_BUCKET).file(`${process.env.CLOUD_RUN_EXECUTION}_${attackingTeamIndex}.json`).save(JSON.stringify(results))
        } catch (err) {
            throw err
        }
        
    } else {
       console.log('Results', results)

        // Test saving to GCS
        if (false) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../../keyfile.json')
            try {
                await storage.bucket(process.env.SIMS_BUCKET).file(`${Date.now}_${attackingTeamIndex}.json`).save(JSON.stringify(results))
            } catch (err) {
                throw err
            }
        }
    }
}

module.exports = runSims

// If running from the command line, run the sims
// 1st argument is the attacking team index
// 2nd argument is the sims version
// 3rd argument is the game logic version
// 4th argument is the number of sims per matchup
// node scripts/balancing/sims.js 0 v1.6 v1.6 3
if (require.main === module) {
    const simsVersion = process.env.SIMS_VERSION || process.argv[3] || 'v1.6'
    const gameLogicVersion = process.env.GAME_LOGIC_VERSION || process.argv[4] || 'v1.6'
    const simsPerMatchup = process.env.SIMS_PER_MATCHUP || process.argv[5] || 3

    runSims(simsVersion, gameLogicVersion, simsPerMatchup)
        .then(() => {
            console.log('Done')
            process.exit(0)
        })
        .catch((err) => {
            console.error(err)
            process.exit(1)
        })
}
