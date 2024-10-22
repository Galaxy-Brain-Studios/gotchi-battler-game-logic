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
 * @param {Array} trainingGotchis The training gotchis
 * @param {Boolean} useTraitSets If false then exhaustive search is done, if true then only the trait sets are used
 * @returns {Object} A team object
 */
const createTeamIndexes = (classCombos, classTraitCombos, powerLevels, trainingGotchis, useTraitSets) => {

    const teams = []

    if (!useTraitSets) {
        classCombos.forEach(classCombo => {
            powerLevels.forEach(powerLevel => {
                // Loop over each class in the classCombo
                for(let i = 0; i < classCombo.length; i++) {
                    classTraitCombos[classCombo[i] - 1].forEach(traitSet1 => {
                        for (let j = i + 1; j < classCombo.length; j++) {
                            classTraitCombos[classCombo[j] - 1].forEach(traitSet2 => {
                                for (let k = j + 1; k < classCombo.length; k++) {
                                    classTraitCombos[classCombo[k] - 1].forEach(traitSet3 => {
                                        for (let l = k + 1; l < classCombo.length; l++) {
                                            classTraitCombos[classCombo[l] - 1].forEach(traitSet4 => {
                                                for (let m = l + 1; m < classCombo.length; m++) {
                                                    classTraitCombos[classCombo[m] - 1].forEach(traitSet5 => {
                                                        const team = [];

                                                        [traitSet1, traitSet2, traitSet3, traitSet4, traitSet5].forEach((traitSet, index) => {
                                                            const gotchiName = `${powerLevel} ${traitSet} ${classes[classCombo[index] - 1]}`
                                                            const gotchi = trainingGotchis.find(gotchi => {
                                                                return gotchi.name === gotchiName
                                                            })

                                                            if (!gotchi) throw new Error(`Gotchi not found: "${gotchiName}"`)

                                                            team.push(gotchi.id)
                                                        })

                                                        teams.push(team)
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        })
    } else {
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
    }

    

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
    const classCombos = require(`./${simsVersion}/class_combos.js`)
    const classTraitCombos = require(`./${simsVersion}/trait_combos.json`)
    const setTeamPositions = require(`./${simsVersion}/setTeamPositions`)
    const gameLogic = require("../../game-logic")[gameLogicVersion].gameLoop

    const attackingPowerLevels = ['Godlike']
    const defendingPowerLevels = ['Godlike', 'Mythical', 'Legendary']
    
    const attackingTeamIndexes = createTeamIndexes(classCombos, classTraitCombos, attackingPowerLevels, trainingGotchis, true)

    // console.log(`Running sims for ${attackingTeamIndexes.length} attacking teams`)

    const defendingTeamIndexes = createTeamIndexes(classCombos, classTraitCombos, defendingPowerLevels, trainingGotchis, true)

    // console.log(`Against ${defendingTeamIndexes.length} defending teams`)

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
        losses: 0
    }

    defendingPowerLevels.forEach(powerLevel => {
        results[`wins${powerLevel}`] = 0
        results[`draws${powerLevel}`] = 0
        results[`losses${powerLevel}`] = 0
    })

    console.time(`Sims for ${attackingTeam.name}`)

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
        const powerLevel = defendingPowerLevels.find(name => name[0] === defendingTeam.name[0]) 

        if (matchupWins >= simsPerMatchup / 2) {
            results.wins++
            results[`wins${powerLevel}`]++
        }

        if (matchupDraws >= simsPerMatchup / 2) {
            results.draws++
            results[`draws${powerLevel}`]++
        }

        if (matchupLosses >= simsPerMatchup / 2) {
            results.losses++
            results[`losses${powerLevel}`]++
        }
    })

    console.timeEnd(`Sims for ${attackingTeam.name}`)

    // Check total wins, draws, losses to make sure they add up to number of defending teams
    const totalMatchups = results.wins + results.draws + results.losses
    if (totalMatchups !== defendingTeamIndexes.length) {
        throw new Error(`Total matchups (${totalMatchups}) does not match number of defending teams (${defendingTeamIndexes.length})`)
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
                await storage.bucket(process.env.SIMS_BUCKET).file(`avg-sims-znw68_${attackingTeamIndex}.json`).save(JSON.stringify(results))
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
// node scripts/balancing/sims.js 0 v1.7.1 v1.7 3 true
if (require.main === module) {
    const simsVersion = process.env.SIMS_VERSION || process.argv[3] || 'v1.7'
    const gameLogicVersion = process.env.GAME_LOGIC_VERSION || process.argv[4] || 'v1.7'
    const simsPerMatchup = parseInt(process.env.SIMS_PER_MATCHUP) || parseInt(process.argv[5]) || 3
    const useAvg = process.env.USE_AVG || process.argv[6] === 'true' || false

    runSims(simsVersion, gameLogicVersion, simsPerMatchup, useAvg)
        .then(() => {
            console.log('Done')
            process.exit(0)
        })
        .catch((err) => {
            console.error(err)
            process.exit(1)
        })
}
