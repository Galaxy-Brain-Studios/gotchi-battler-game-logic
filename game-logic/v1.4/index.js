const seedrandom = require('seedrandom')
const ZSchema = require('z-schema')
const validator = new ZSchema()
const { GameError } = require('../../utils/errors')

let {
    PASSIVES,
    BUFF_MULT_EFFECTS, 
    BUFF_FLAT_EFFECTS, 
    DEBUFF_MULT_EFFECTS, 
    DEBUFF_FLAT_EFFECTS,
    DEBUFFS,
    BUFFS,
    MULTS
} = require('./constants')

// Get only alive gotchis in a team
const getAlive = (team, row) => {
    if (row) {
        return team.formation[row].filter(x => x).filter(x => x.health > 0)
    }

    return [...team.formation.front, ...team.formation.back].filter(x => x).filter(x => x.health > 0)
}

/**
 * Get the formation position of a gotchi
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 * @param {Number} gotchiId The id of the gotchi
 * @returns {Object} position The formation position of the gotchi
 * @returns {Number} position.team The team the gotchi is on
 * @returns {String} position.row The row the gotchi is on
 * @returns {Number} position.position The position of the gotchi in the row
 * @returns {null} position null if the gotchi is not found
 **/
const getFormationPosition = (team1, team2, gotchiId) => {
    const team1FrontIndex = team1.formation.front.findIndex(x => x && x.id === gotchiId)

    if (team1FrontIndex !== -1) return {
        team: 1,
        row: 'front',
        position: team1FrontIndex,
        name: team1.formation.front[team1FrontIndex].name
    }

    const team1BackIndex = team1.formation.back.findIndex(x => x && x.id === gotchiId)

    if (team1BackIndex !== -1) return {
        team: 1,
        row: 'back',
        position: team1BackIndex,
        name: team1.formation.back[team1BackIndex].name
    }

    const team2FrontIndex = team2.formation.front.findIndex(x => x && x.id === gotchiId)

    if (team2FrontIndex !== -1) return {
        team: 2,
        row: 'front',
        position: team2FrontIndex,
        name: team2.formation.front[team2FrontIndex].name
    }

    const team2BackIndex = team2.formation.back.findIndex(x => x && x.id === gotchiId)

    if (team2BackIndex !== -1) return {
        team: 2,
        row: 'back',
        position: team2BackIndex,
        name: team2.formation.back[team2BackIndex].name
    }

    return null
}

/**
 * Get the leader gotchi of a team
 * @param {Object} team An in-game team object
 * @returns {Object} gotchi The leader gotchi
 * @returns {Number} leader.id The id of the gotchi
 * @returns {String} leader.special The special object of the gotchi
 * @returns {String} leader.special.class The class of the special
 **/
const getLeaderGotchi = (team) => {
    const leader = [...team.formation.front, ...team.formation.back].find(x => x && x.id === team.leader)

    if (!leader) throw new Error('Leader not found')

    return leader
}

/**
 * Get the next gotchi to act
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 * @param {Function} rng The random number generator
 * @returns {Object} position The formation position of the gotchi
 **/
const getNextToAct = (team1, team2, rng) => {
    const aliveGotchis = [...getAlive(team1), ...getAlive(team2)]

    aliveGotchis.sort((a, b) => a.actionDelay - b.actionDelay)

    let toAct = aliveGotchis.filter(gotchi => gotchi.actionDelay === aliveGotchis[0].actionDelay)

    // If only one gotchi can act then return it
    if (toAct.length === 1) return getFormationPosition(team1, team2, toAct[0].id)

    // Lowest speeds win tiebreaker
    toAct.sort((a, b) => a.speed - b.speed)
    toAct = toAct.filter(gotchi => gotchi.speed === toAct[0].speed)

    // If only one gotchi can act then return it

    if (toAct.length === 1) return getFormationPosition(team1, team2, toAct[0].id)

    // If still tied then randomly choose
    const randomIndex = Math.floor(rng() * toAct.length)

    if (!toAct[randomIndex]) throw new Error(`No gotchi found at index ${randomIndex}`)

    toAct = toAct[randomIndex]
    return getFormationPosition(team1, team2, toAct.id)
}

const getTarget = (defendingTeam, rng) => {
    // Check for taunt gotchis
    const taunt = [...getAlive(defendingTeam, 'front'), ...getAlive(defendingTeam, 'back')].filter(gotchi => gotchi.statuses && gotchi.statuses.includes("taunt"))

    if (taunt.length) {
        if (taunt.length === 1) return taunt[0]

        // If multiple taunt gotchis then randomly choose one
        return taunt[Math.floor(rng() * taunt.length)]
    }

    // Target gotchis in the front row first
    const frontRow = getAlive(defendingTeam, 'front')

    if (frontRow.length) {
        return frontRow[Math.floor(rng() * frontRow.length)]
    }

    // If no gotchis in front row then target back row
    const backRow = getAlive(defendingTeam, 'back')

    if (backRow.length) {
        return backRow[Math.floor(rng() * backRow.length)]
    }

    throw new Error('No gotchis to target')
}

const applySpeedPenalty = (gotchi, penalty) => {
    const speedPenalty = (gotchi.speed - 100) * penalty

    return {
        ...gotchi,
        magic: gotchi.magic - speedPenalty,
        physical: gotchi.physical - speedPenalty
    }
}

/**
 * Get the damage of an attack
 * @param {Object} attackingTeam The attacking team
 * @param {Object} defendingTeam The defending team
 * @param {Object} attackingGotchi The gotchi attacking
 * @param {Object} defendingGotchi The gotchi defending
 * @param {Number} multiplier The damage multiplier
 * @param {Boolean} ignoreArmor Whether to ignore armor
 * @param {Number} speedPenalty The speed penalty to apply
 * @returns {Number} damage The damage of the attack
 **/
const getDamage = (attackingTeam, defendingTeam, attackingGotchi, defendingGotchi, multiplier, ignoreArmor, speedPenalty) => {
    
    const attackerWithSpeedPenalty = speedPenalty ? applySpeedPenalty(attackingGotchi, speedPenalty) : attackingGotchi

    // Apply any status effects
    const modifiedAttackingsGotchi = getModifiedStats(attackerWithSpeedPenalty)
    const modifiedDefendingGotchi = getModifiedStats(defendingGotchi)

    let attackValue = attackingGotchi.attack === 'magic' ? modifiedAttackingsGotchi.magic : modifiedAttackingsGotchi.physical

    // If attacking gotchi is in the front row and physical attack then apply front row physical attack bonus
    if (getFormationPosition(attackingTeam, defendingTeam, attackingGotchi.id).row === 'front' && attackingGotchi.attack === 'physical') {
        attackValue = Math.round(attackValue * MULTS.FRONT_ROW_PHY_ATK)
    }

    let defenseValue = attackingGotchi.attack === 'magic' ? modifiedDefendingGotchi.magic : modifiedDefendingGotchi.physical

    // If defending gotchi is in the front row and the attack is physical then apply front row physical defence penalty
    if (getFormationPosition(attackingTeam, defendingTeam, defendingGotchi.id).row === 'front' && attackingGotchi.attack === 'physical') {
        defenseValue = Math.round(defenseValue * MULTS.FRONT_ROW_PHY_DEF)
    }

    // Add armor to defense value
    if (!ignoreArmor) defenseValue += modifiedDefendingGotchi.armor

    // Calculate damage
    let damage = Math.round((attackValue / defenseValue) * 100)

    // Apply multiplier
    if (multiplier) damage = Math.round(damage * multiplier)

    // check for environment effects
    if (defendingGotchi.environmentEffects && defendingGotchi.environmentEffects.length > 0) {
        damage = Math.round(damage * (1 + (defendingGotchi.environmentEffects.length * 0.5)))
    }

    return damage
}

/**
 * Apply status effects to a gotchi
 * @param {Object} gotchi An in-game gotchi object
 * @returns {Object} gotchi An in-game gotchi object with modified stats
 */
const getModifiedStats = (gotchi) => {
    const statMods = {}

    gotchi.statuses.forEach(status => {
        const statusStatMods = {}

        // apply any modifier from BUFF_MULT_EFFECTS
        if (BUFF_MULT_EFFECTS[status]) {
            Object.keys(BUFF_MULT_EFFECTS[status]).forEach(stat => {
                const modifier = Math.round(gotchi[stat] * BUFF_MULT_EFFECTS[status][stat])

                statusStatMods[stat] = modifier
            })
        }

        // apply any modifier from BUFF_FLAT_EFFECTS
        if (BUFF_FLAT_EFFECTS[status]) {
            Object.keys(BUFF_FLAT_EFFECTS[status]).forEach(stat => {
                if (statusStatMods[stat]) {
                    // If a mod for this status already exists, only add if the new mod is greater
                    if (BUFF_FLAT_EFFECTS[status][stat] > statusStatMods[stat]) statusStatMods[stat] = BUFF_FLAT_EFFECTS[status][stat]
                } else {
                    statusStatMods[stat] = BUFF_FLAT_EFFECTS[status][stat]
                }
            })
        }

        // apply any modifier from DEBUFF_MULT_EFFECTS
        if (DEBUFF_MULT_EFFECTS[status]) {
            Object.keys(DEBUFF_MULT_EFFECTS[status]).forEach(stat => {
                const modifier = Math.round(gotchi[stat] * DEBUFF_MULT_EFFECTS[status][stat])

                statusStatMods[stat] = -modifier
            })
        }

        // apply any modifier from DEBUFF_FLAT_EFFECTS
        if (DEBUFF_FLAT_EFFECTS[status]) {
            Object.keys(DEBUFF_FLAT_EFFECTS[status]).forEach(stat => {
                if (statusStatMods[stat]) {
                    // If a mod for this status already exists, only add if the new mod is greater
                    if (DEBUFF_FLAT_EFFECTS[status][stat] < statusStatMods[stat]) statusStatMods[stat] = DEBUFF_FLAT_EFFECTS[status][stat]
                } else {
                    statusStatMods[stat] = -DEBUFF_FLAT_EFFECTS[status][stat]
                }
            })
        }

        // apply status mods
        Object.keys(statusStatMods).forEach(stat => {
            statMods[stat] = statMods[stat] ? statMods[stat] + statusStatMods[stat] : statusStatMods[stat]
        })
    })

    const modifiedGotchi = {
        ...gotchi
    }

    // apply stat mods
    Object.keys(statMods).forEach(stat => {
        if (statMods[stat] < 0) {
            modifiedGotchi[stat] = modifiedGotchi[stat] + statMods[stat] < 0 ? 0 : modifiedGotchi[stat] + statMods[stat]
        } else {
            modifiedGotchi[stat] += statMods[stat]
        }
        
    })

    return modifiedGotchi
}

const calculateActionDelay = (gotchi) => {
    // Calculate action delay and round to 3 decimal places
    return Math.round(((100 / getModifiedStats(gotchi).speed) + Number.EPSILON) * 1000) / 1000
}

const getNewActionDelay = (gotchi) => {
    // Calculate new action delay and round to 3 decimal places
    return Math.round((gotchi.actionDelay + calculateActionDelay(gotchi) + Number.EPSILON) * 1000) / 1000
}

/**
 * Simplify a team object for storage
 * @param {Object} team An in-game team object
 * @returns {Object} simplifiedTeam A simplified team object 
 */
const simplifyTeam = (team) => {
    return {
        name: team.name,
        owner: team.owner,
        leaderId: team.leader,
        rows: [
            {
                slots: team.formation.front.map((x) => {
                    return {
                        isActive: x ? true : false,
                        id: x ? x.id : null
                    }
                })
            },
            {
                slots: team.formation.back.map((x) => {
                    return {
                        isActive: x ? true : false,
                        id: x ? x.id : null
                    }
                })
            }
        ],
        uiOrder: getUiOrder(team)
    }
}

/**
 * Get the UI order of a team (used for the front end)
 * @param {Object} team An in-game team object
 * @returns {Array} uiOrder An array of gotchi ids in the order they should be displayed 
 **/
const getUiOrder = (team) => {
    const uiOrder = []

    if (team.formation.front[0]) uiOrder.push(team.formation.front[0].id)
    if (team.formation.back[0]) uiOrder.push(team.formation.back[0].id)
    if (team.formation.front[1]) uiOrder.push(team.formation.front[1].id)
    if (team.formation.back[1]) uiOrder.push(team.formation.back[1].id)
    if (team.formation.front[2]) uiOrder.push(team.formation.front[2].id)
    if (team.formation.back[2]) uiOrder.push(team.formation.back[2].id)
    if (team.formation.front[3]) uiOrder.push(team.formation.front[3].id)
    if (team.formation.back[3]) uiOrder.push(team.formation.back[3].id)
    if (team.formation.front[4]) uiOrder.push(team.formation.front[4].id)
    if (team.formation.back[4]) uiOrder.push(team.formation.back[4].id)

    return uiOrder
}

/**
 * Add the leader statuses to a team
 * @param {Object} team An in-game team object
 **/
const addLeaderToTeam = (team) => {
    // Add passive leader abilities
    const teamLeader = getLeaderGotchi(team)

    team.leaderPassive = teamLeader.special.id

    // Apply leader passive statuses
    switch (team.leaderPassive) {
        case 1:
            // Sharpen blades - all allies gain 'sharp_blades' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 2:
            // Cloud of Zen - Leader get 'cloud_of_zen' status
            teamLeader.statuses.push(PASSIVES[team.leaderPassive - 1])
            break
        case 3:
            // Frenzy - all allies get 'frenzy' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 4:
            // All allies get 'fortify' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })

            break
        case 5:
            // Spread the fear - all allies get 'spread_the_fear' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 6:
            // Cleansing aura - every healer ally and every tank ally gets 'cleansing_aura' status
            getAlive(team).forEach(x => {
                if (x.special.id === 6 || x.special.id === 4) x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 7:
            // Arcane thunder - every mage ally gets 'arcane_thunder' status
            getAlive(team).forEach(x => {
                if (x.special.id === 7) x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 8:
            // Clan momentum - every Troll ally gets 'clan_momentum' status
            getAlive(team).forEach(x => {
                if (x.special.id === 8) x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
    }
}

const removeLeaderPassivesFromTeam = (team) => {
    let statusesRemoved = []
    if (!team.leaderPassive) return statusesRemoved

    // Remove leader passive statuses from team
    getAlive(team).forEach(x => {
        // add effects for each status removed
        x.statuses.forEach(status => {
            if (status === PASSIVES[team.leaderPassive - 1]) {
                statusesRemoved.push({
                    target: x.id,
                    status: status
                })
            }
        })

        x.statuses = x.statuses.filter(x => x !== PASSIVES[team.leaderPassive - 1])
    })

    team.leaderPassive = null

    return statusesRemoved
}

const getExpiredStatuses = (team1, team2) => {
    // If leader is dead, remove leader passive
    let statusesExpired = []
    if (team1.leaderPassive && !getAlive(team1).find(x => x.id === team1.leader)) {
        // Remove leader passive statuses
        statusesExpired = removeLeaderPassivesFromTeam(team1)
    }
    if (team2.leaderPassive && !getAlive(team2).find(x => x.id === team2.leader)) {
        // Remove leader passive statuses
        statusesExpired = removeLeaderPassivesFromTeam(team2)
    }

    return statusesExpired
}

/**
 * Add a status to a gotchi
 * @param {Object} gotchi An in-game gotchi object
 * @param {String} status The status to add
 * @returns {Boolean} success A boolean to determine if the status was added
 **/
const addStatusToGotchi = (gotchi, status) => {
    // Check that gotchi doesn't already have max number of statuses
    if (gotchi.statuses.filter(item => item === status).length >= MULTS.MAX_STATUSES) return false

    gotchi.statuses.push(status)

    return true
}

const scrambleGotchiIds = (allAliveGotchis, team1, team2) => {
    // check there's no duplicate gotchis
    const gotchiIds = allAliveGotchis.map(x => x.id)

    if (gotchiIds.length !== new Set(gotchiIds).size) {
            // scramble gotchi ids
            allAliveGotchis.forEach(x => {
                const newId = Math.floor(Math.random() * 10000000)

                // find gotchi in team1 or team2
                const position = getFormationPosition(team1, team2, x.id)

                // change gotchi id
                if (position) {
                    if (position.team === 1) {
                        if (x.id === team1.leader) team1.leader = newId
                        team1.formation[position.row][position.position].id = newId
                    } else {
                        if (x.id === team2.leader) team2.leader = newId
                        team2.formation[position.row][position.position].id = newId
                    }
                } else {
                    throw new Error('Gotchi not found in team1 or team2')
                }
            })

            // check again
            const newGotchiIds = allAliveGotchis.map(x => x.id)
            if (newGotchiIds.length !== new Set(newGotchiIds).size) {
                // Scramble again
                scrambleGotchiIds(allAliveGotchis, team1, team2)
            }
    }
}

/**
 * Prepare teams for battle
 * @param {Array} allAliveGotchis An array of all alive gotchis
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 **/
const prepareTeams = (allAliveGotchis, team1, team2) => {
    // check there's no duplicate gotchis
    scrambleGotchiIds(allAliveGotchis, team1, team2);

    allAliveGotchis.forEach(x => {
        // Add statuses property to all gotchis
        x.statuses = []

        // Calculate initial action delay for all gotchis
        x.actionDelay = calculateActionDelay(x)

        // Calculate attack type
        x.attack = x.magic > x.physical ? 'magic' : 'physical'

        // Add original stats to all gotchis
        // Do a deep copy of the gotchi object to avoid modifying the original object
        x.originalStats = JSON.parse(JSON.stringify(x)) 

        // Add environmentEffects to all gotchis
        x.environmentEffects = []
    })

    // Add leader passive to team
    addLeaderToTeam(team1)
    addLeaderToTeam(team2);
}

/**
 * Get log gotchi object for battle logs
 * @param {Array} allAliveGotchis An array of all alive gotchis
 * @returns {Array} logGotchis An array of gotchi objects for logs
 */
const getLogGotchis = (allAliveGotchis) => {
    const logGotchis = JSON.parse(JSON.stringify(allAliveGotchis))

    logGotchis.forEach(x => {
        // Change gotchi.special.class to gotchi.special.gotchiClass to avoid conflicts with class keyword
        x.special.gotchiClass = x.special.class

        // Remove unnecessary properties to reduce log size
        delete x.special.class
        delete x.snapshotBlock
        delete x.onchainId
        delete x.brs
        delete x.nrg
        delete x.agg
        delete x.spk
        delete x.brn
        delete x.eyc
        delete x.eys
        delete x.kinship
        delete x.xp
        delete x.actionDelay
        delete x.attack
        delete x.originalStats
        delete x.environmentEffects
    })

    return logGotchis
}

/**
 * Run a battle between two teams 
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 * @param {String} seed A seed for the random number generator
 * @param {Boolean} debug A boolean to determine if the logs should include debug information
 * @returns {Object} logs The battle logs
 */
const gameLoop = (team1, team2, seed, debug) => {
    if (!team1) throw new Error("Team 1 not found")
    if (!team2) throw new Error("Team 2 not found")
    if (!seed) throw new Error("Seed not found")

        // Validate team objects
    const team1Validation = validator.validate(team1, teamSchema)
    if (!team1Validation) {
        console.error('Team 1 validation failed: ', JSON.stringify(validator.getLastErrors(), null, 2))
        throw new Error(`Team 1 validation failed`)
    }
    const team2Validation = validator.validate(team2, teamSchema)
    if (!team2Validation) {
        console.error('Team 2 validation failed: ', JSON.stringify(validator.getLastErrors(), null, 2))
        throw new Error(`Team 2 validation failed`)
    }

    const rng = seedrandom(seed)

    const allAliveGotchis = [...getAlive(team1), ...getAlive(team2)]

    prepareTeams(allAliveGotchis, team1, team2)

    const logs = {
        gotchis: getLogGotchis(allAliveGotchis),
        layout: {
            teams: [
                simplifyTeam(team1),
                simplifyTeam(team2)
            ]
        },
        turns: []
    };

    // Used for turn by turn health and status summaries
    // Deleted if not in development or no errors
    logs.debug = []

    let turnCounter = 0
    let draw = false

    try {
        while (getAlive(team1).length && getAlive(team2).length) {
            // Check if turnCounter is ready for environment effects (99,149,199, etc)
            let isEnvironmentTurn = [99, 149, 199, 249, 299].includes(turnCounter)
            if (isEnvironmentTurn) {
                allAliveGotchis.forEach(x => {
                    x.environmentEffects.push('damage_up')
                })
            }

            const turnLogs = executeTurn(team1, team2, rng)

            // Check if turnCounter is ready for environment effects (99,149,199, etc)
            if (isEnvironmentTurn) turnLogs.environmentEffects = ['damage_up']

            if (MULTS.EXPIRE_LEADERSKILL) {
                turnLogs.statusesExpired = [...turnLogs.statusesExpired, ...getExpiredStatuses(team1, team2)]
            }

            logs.turns.push({index: turnCounter, ...turnLogs})

            if (debug) {
            logs.debug.push({
                turn: turnCounter,
                user: logs.turns[logs.turns.length - 1].action.user,
                move: logs.turns[logs.turns.length - 1].action.name,
                team1: getAlive(team1).map((x) => {
                    return `Id: ${x.id}, Name: ${x.name}, Health: ${x.health}, Statuses: ${x.statuses}`
                }),
                team2: getAlive(team2).map((x) => {
                    return `Id: ${x.id}, Name: ${x.name}, Health: ${x.health}, Statuses: ${x.statuses}`
                })
            })
            }

            turnCounter++
        }
    } catch (e) {
        console.error(e)
        throw new GameError('Game loop failed', logs)
    }

    if (draw) {
        logs.result = {
            winner: 0,
            loser: 0,
            winningTeam: [],
            numOfTurns: logs.turns.length
        }
    } else {
        logs.result = {
            winner: getAlive(team1).length ? 1 : 2,
            loser: getAlive(team1).length ? 2 : 1,
            winningTeam: getAlive(team1).length ? getAlive(team1) : getAlive(team2),
            numOfTurns: logs.turns.length
        }

        // trim winning team objects
        logs.result.winningTeam = logs.result.winningTeam.map((gotchi) => {
            return {
                id: gotchi.id,
                name: gotchi.name,
                brs: gotchi.brs,
                health: gotchi.health
            }
        })
    }

    if (!debug) delete logs.debug

    return logs
}

/**
 * Attack one or more gotchis. This mutates the defending gotchis health
 * @param {Object} attackingGotchi The attacking gotchi object
 * @param {Array} attackingTeam A team object for the attacking team
 * @param {Array} defendingTeam A team object for the defending team
 * @param {Array} defendingTargets An array of gotchis to attack
 * @param {Function} rng The random number generator
 * @param {Object} options An object of options
 * @param {Boolean} options.ignoreArmor Ignore the defending gotchi's defense
 * @param {Boolean} options.multiplier A multiplier to apply to the damage
 * @param {Boolean} options.statuses An array of status effects to apply
 * @param {Boolean} options.cannotBeEvaded A boolean to determine if the attack can be evaded
 * @param {Boolean} options.cannotBeResisted A boolean to determine if the attack can be resisted
 * @param {Boolean} options.cannotBeCountered A boolean to determine if the attack can be countered
 * @param {Boolean} options.inflictPassiveStatuses A boolean to determine if passive statuses should be inflicted
 * @returns {Array} effects An array of effects to apply
 */
const attack = (attackingGotchi, attackingTeam, defendingTeam, defendingTargets, rng, options = {
    ignoreArmor: false,
    multiplier: 1,
    statuses: [],
    cannotBeEvaded: false,
    critCannotBeEvaded: false,
    cannotBeResisted: false,
    cannotBeCountered: false,
    inflictPassiveStatuses: true,
    speedPenalty: 0,
    noResistSpeedPenalty: false
}) => {
    const effects = []
    if (!options.ignoreArmor) options.ignoreArmor = false
    if (!options.multiplier) options.multiplier = 1
    if (!options.statuses) options.statuses = []
    if (!options.cannotBeEvaded) options.cannotBeEvaded = false
    if (!options.critCannotBeEvaded) options.critCannotBeEvaded = false
    if (!options.cannotBeResisted) options.cannotBeResisted = false
    if (!options.cannotBeCountered) options.cannotBeCountered = false
    if (!options.inflictPassiveStatuses) options.inflictPassiveStatuses = false
    if (!options.speedPenalty) options.speedPenalty = 0
    if (!options.noResistSpeedPenalty) options.noResistSpeedPenalty = false

    // If inflictPassiveStatuses then add leaderPassive status effects to attackingGotchi
    if (options.inflictPassiveStatuses) {
        // If attacking gotchi has 'sharp_blades' status, add 'bleed' to statuses
        if (attackingGotchi.statuses.includes('sharp_blades')) {
            if (rng() < MULTS.SHARP_BLADES_BLEED_CHANCE) options.statuses.push('bleed')
        }

        // If attacking gotchi has 'spread_the_fear' status, add 'fear' to statuses
        if (attackingGotchi.statuses.includes('spread_the_fear')) {
            // Reduce the chance to spread the fear if attacking gotchi has speed over 100
            const spreadTheFearChance = attackingGotchi.speed > 100 ? MULTS.SPREAD_THE_FEAR_CHANCE - MULTS.SPREAD_THE_FEAR_SPEED_PENALTY : MULTS.SPREAD_THE_FEAR_CHANCE
            if (rng() < spreadTheFearChance) options.statuses.push('fear')
        }
    }

    defendingTargets.forEach((defendingGotchi) => {
        // Check attacking gotchi hasn't been killed by a counter
        if (attackingGotchi.health <= 0) return

        const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)
        const modifiedDefendingGotchi = getModifiedStats(defendingGotchi)

        // Check for crit
        const isCrit = rng() < modifiedAttackingGotchi.crit / 100
        if (isCrit) {
            // Apply different crit multipliers for -nrg and +nrg gotchis
            if (attackingGotchi.speed <= 100) {
                options.multiplier *= MULTS.CRIT_MULTIPLIER_SLOW
            } else {
                options.multiplier *= MULTS.CRIT_MULTIPLIER_FAST
            }
        }

        let canEvade = true
        if (options.cannotBeEvaded) canEvade = false
        if (isCrit && options.critCannotBeEvaded) canEvade = false

        const damage = getDamage(attackingTeam, defendingTeam, attackingGotchi, defendingGotchi, options.multiplier, options.ignoreArmor, options.speedPenalty)

        let effect = {
            target: defendingGotchi.id,
        }

        // Check for miss
        if (rng() > modifiedAttackingGotchi.accuracy / 100) {
            effect.outcome = 'miss'
            effects.push(effect)
        } else if (canEvade && rng() < modifiedDefendingGotchi.evade / 100){
            effect.outcome = 'evade'
            effects.push(effect)
        } else {
            if (!options.cannotBeResisted) {
                // Check for status effect from the move
                options.statuses.forEach((status) => {
                    if (rng() > modifiedDefendingGotchi.resist / 100) {
                        // Attempt to add status to defending gotchi
                        if (addStatusToGotchi(defendingGotchi, status)) {
                            // If status added, add to effect
                            if (!effect.statuses) {
                                effect.statuses = [status]
                            } else {
                                effect.statuses.push(status)
                            }
                        }
                    }
                })
            }

            // Handle damage
            defendingGotchi.health -= damage
            effect.damage = damage
            effect.outcome = isCrit ? 'critical' : 'success'
            effects.push(effect)

            // Check for counter attack
            if (
                defendingGotchi.statuses.includes('taunt')
                && defendingGotchi.health > 0
                && !options.cannotBeCountered) {

                // Chance to counter based on speed over 100
                let chanceToCounter = defendingGotchi.speed - 100

                if (chanceToCounter < MULTS.COUNTER_CHANCE_MIN) chanceToCounter = MULTS.COUNTER_CHANCE_MIN

                // Add a higher chance to counter if gotchi has 'fortify' status
                if (defendingGotchi.statuses.includes('fortify')) chanceToCounter += MULTS.FORTIFY_COUNTER_CHANCE
                
                if (rng() < chanceToCounter / 100) {
                    const counterDamage = getDamage(defendingTeam, attackingTeam, defendingGotchi, attackingGotchi, MULTS.COUNTER_DAMAGE, false, 0)

                    attackingGotchi.health -= counterDamage

                    effects.push({
                        target: attackingGotchi.id,
                        source: defendingGotchi.id,
                        damage: counterDamage,
                        outcome: 'counter'
                    })
                }
            }
        }
    })

    return effects
}

// Deal with start of turn status effects
const handleStatusEffects = (attackingGotchi, attackingTeam, defendingTeam, rng) => {
    const statusEffects = []
    const passiveEffects = []

    const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)

    // Check for cleansing_aura
    // if (attackingGotchi.statuses.includes('cleansing_aura')) {
    //     // Remove all debuffs from all allies
    //     const aliveAllies = getAlive(attackingTeam)
    //     aliveAllies.forEach((ally) => {
    //         ally.statuses.forEach((status) => {
    //             if (DEBUFFS.includes(status)) {
    //                 passiveEffects.push({
    //                     source: attackingGotchi.id,
    //                     target: ally.id,
    //                     status,
    //                     damage: 0,
    //                     remove: true
    //                 })
    //             }
    //         })

    //         // Remove status effects
    //         ally.statuses = ally.statuses.filter((status) => !DEBUFFS.includes(status))
    //     })
    // }

    // Check for global status effects
    const allAliveGotchis = [...getAlive(attackingTeam), ...getAlive(defendingTeam)]

    allAliveGotchis.forEach((gotchi) => {
        if (gotchi.statuses && gotchi.statuses.length) {
            gotchi.statuses.forEach((status) => {
                // Handle cleansing_aura (health regen)
                if (status === 'cleansing_aura') {
                    let amountToHeal

                    // Check if healer
                    if (gotchi.special.id === 6) {
                        amountToHeal = Math.round(gotchi.resist * MULTS.CLEANSING_AURA_REGEN)
                    } else {
                        amountToHeal = MULTS.CLEANSING_AURA_NON_HEALER_REGEN
                    }

                    // Don't allow amountToHeal to be more than the difference between current health and max health
                    if (amountToHeal > gotchi.originalStats.health - gotchi.health) {
                        amountToHeal = gotchi.originalStats.health - gotchi.health
                    }

                    // if amountToHeal > 0, add status effect
                    if (amountToHeal) {
                        // Add status effect
                        statusEffects.push({
                            target: gotchi.id,
                            status,
                            damage: -Math.abs(amountToHeal),
                            remove: false
                        })

                        gotchi.health += amountToHeal
                    }
                }

                /* 
                * Handle damage effect at the bottom of the loop
                */

                // Handle bleed
                if (status === 'bleed') {
                    let damage = MULTS.BLEED_DAMAGE

                    gotchi.health -= damage
                    if (gotchi.health <= 0) gotchi.health = 0

                    // Add status effect
                    statusEffects.push({
                        target: gotchi.id,
                        status,
                        damage,
                        remove: false
                    })
                }
            })
        }
    })

    let skipTurn = null

    // Check if gotchi is dead
    if (attackingGotchi.health <= 0) {
        return {
            statusEffects,
            passiveEffects,
            skipTurn: 'ATTACKER_DEAD'
        }
    }

    // Check if a whole team is dead
    if (getAlive(attackingTeam).length === 0 || getAlive(defendingTeam).length === 0) {
        return {
            statusEffects,
            passiveEffects,
            skipTurn: 'TEAM_DEAD'
        }
    }

    // Check for turn skipping statuses
    for (let i = 0; i < attackingGotchi.statuses.length; i++) {
        const status = attackingGotchi.statuses[i]
        // Fear - skip turn
        if (status === 'fear') {
            // Skip turn
            statusEffects.push({
                target: attackingGotchi.id,
                status,
                damage: 0,
                remove: true
            })

            skipTurn = 'FEAR'

            // Remove fear first instance of fear
            attackingGotchi.statuses.splice(i, 1)

            break
        }

        // Stun
        if (status === 'stun') {
            // Skip turn
            statusEffects.push({
                target: attackingGotchi.id,
                status,
                damage: 0,
                remove: true
            })

            skipTurn = 'STUN'

            // Remove first instance of stun
            attackingGotchi.statuses.splice(i, 1)

            break
        }
    }

    return {
        statusEffects,
        passiveEffects,
        skipTurn
    }
}

const executeTurn = (team1, team2, rng) => {
    const nextToAct = getNextToAct(team1, team2, rng)

    const attackingTeam = nextToAct.team === 1 ? team1 : team2
    const defendingTeam = nextToAct.team === 1 ? team2 : team1

    const attackingGotchi = attackingTeam.formation[nextToAct.row][nextToAct.position]

    let { statusEffects, passiveEffects, skipTurn } = handleStatusEffects(attackingGotchi, attackingTeam, defendingTeam, rng)
    let statusesExpired = []

    let effects = []
    if (skipTurn) {
        // Increase actionDelay
        attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)

        return {
            skipTurn,
            action: {
                user: attackingGotchi.id,
                name: 'auto',
                effects
            },
            passiveEffects,
            statusEffects,
            statusesExpired
        }
    }

    let specialDone = false
    // Check if special attack is ready
    if (attackingGotchi.special.cooldown === 0) {
        // TODO: Check if special attack should be used

        // Execute special attack
        const specialResults = specialAttack(attackingGotchi, attackingTeam, defendingTeam, rng)

        effects = specialResults.effects
        statusesExpired = specialResults.statusesExpired

        // Reset cooldown
        attackingGotchi.special.cooldown = 2

        if (specialResults.specialNotDone) {
            // Do nothing which will lead to an auto attack
        } else {
            specialDone = true
        }
        
    } else {
        // Decrease cooldown
        attackingGotchi.special.cooldown--
    }

    if (!specialDone) {
        // Do an auto attack
        const target = getTarget(defendingTeam, rng)

        effects = attack(attackingGotchi, attackingTeam, defendingTeam, [target], rng)
    }

    // Increase actionDelay
    attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)

    return {
        skipTurn,
        action: {
            user: attackingGotchi.id,
            name: specialDone ? attackingGotchi.special.name : 'auto',
            effects
        },
        passiveEffects,
        statusEffects,
        statusesExpired
    }
}

/**
 * Execute a special attack
 * @param {Object} attackingGotchi The attacking gotchi object
 * @param {Array} attackingTeam An array of gotchis to attack
 * @param {Array} defendingTeam An array of gotchis to attack
 * @param {Function} rng The random number generator
 * @returns {Array} effects An array of effects to apply
 **/
const specialAttack = (attackingGotchi, attackingTeam, defendingTeam, rng) => {
    const specialId = attackingGotchi.special.id
    let effects = []
    let statusesExpired = []
    let specialNotDone = false

    const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)

    switch (specialId) {
        case 1:
            // Spectral Strike - ignore armor and appply bleed status
            // get single target
            const ssTarget = getTarget(defendingTeam, rng)

            effects = attack(attackingGotchi, attackingTeam, defendingTeam, [ssTarget], rng, { 
                multiplier: MULTS.SPECTRAL_STRIKE_DAMAGE, 
                ignoreArmor: true, 
                statuses: ['bleed'],
                cannotBeCountered: true, 
                cannotBeEvaded: true,
                inflictPassiveStatuses: false,
                noResistSpeedPenalty: true
            })
            break
        case 2:
            // Meditate - Boost own speed, magic, physical by 30%
            // If gotchi already has 2 power_up statuses, do nothing
            if (!addStatusToGotchi(attackingGotchi, 'power_up_2')) {
                specialNotDone = true
                break
            }

            effects = [
                {
                    target: attackingGotchi.id,
                    outcome: 'success',
                    statuses: ['power_up_2']
                }
            ]

            // Check for leaderPassive 'Cloud of Zen'
            if (attackingGotchi.statuses.includes(PASSIVES[specialId - 1])) {
                // Increase allies speed, magic and physical by 15% of the original value

                const cloudOfZenGotchis = getAlive(attackingTeam)

                cloudOfZenGotchis.forEach((gotchi) => {
                    if (addStatusToGotchi(gotchi, 'power_up_1')) {
                        effects.push({
                            target: gotchi.id,
                            outcome: 'success',
                            statuses: ['power_up_1']
                        })
                    }
                })
            }

            break
        case 3:
            // Cleave - attack all enemies in a row (that have the most gotchis) for 75% damage
            // Find row with most gotchis
            const cleaveRow = getAlive(defendingTeam, 'front').length > getAlive(defendingTeam, 'back').length ? 'front' : 'back'

            // Attack all gotchis in that row for 75% damage
            effects = attack(attackingGotchi, attackingTeam, defendingTeam, getAlive(defendingTeam, cleaveRow), rng, { 
                multiplier: MULTS.CLEAVE_DAMAGE, 
                cannotBeCountered: true, 
                inflictPassiveStatuses: false
            })
            break
        case 4:
            // Taunt - add taunt status to self

            // Check if gotchi already has taunt status
            if (attackingGotchi.statuses.includes('taunt')) {
                specialNotDone = true
                break
            }

            if (!addStatusToGotchi(attackingGotchi, 'taunt')) {
                specialNotDone = true
                break
            }

            effects = [
                {
                    target: attackingGotchi.id,
                    outcome: 'success',
                    statuses: ['taunt']
                }
            ]
            break
        case 5:
            // Curse - attack random enemy for 50% damage, apply fear status and remove all buffs

            const curseTarget = getTarget(defendingTeam, rng)

            const curseTargetStatuses = ['fear']

            effects = attack(attackingGotchi, attackingTeam, defendingTeam, [curseTarget], rng, { 
                multiplier: MULTS.CURSE_DAMAGE, 
                statuses: curseTargetStatuses, 
                cannotBeCountered: true,
                inflictPassiveStatuses: false,
                speedPenalty: MULTS.CURSE_SPEED_PENALTY,
                noResistSpeedPenalty: true
            })

            const removeRandomBuff = (target) => {
                const modifiedTarget = getModifiedStats(target)

                if (rng() > modifiedTarget.resist / 100) {
                    const buffsToRemove = target.statuses.filter((status) => BUFFS.includes(status))

                    if (buffsToRemove.length) {
                        const randomBuff = buffsToRemove[Math.floor(rng() * buffsToRemove.length)]
                        statusesExpired.push({
                            target: target.id,
                            status: randomBuff
                        })
                    
                        // Remove first instance of randomBuff (there may be multiple)
                        const index = target.statuses.indexOf(randomBuff)
                        target.statuses.splice(index, 1)
                    }
                }
            }

            if (effects[0] && effects[0].outcome === 'success') {
                // 1 chance to remove a random buff
                removeRandomBuff(curseTarget)

            } else if (effects[0] && effects[0].outcome === 'critical') {
                // 2 chances to remove a random buff
                removeRandomBuff(curseTarget)
                removeRandomBuff(curseTarget)
            }

            break
        case 6:
            // Blessing - Heal all non-healer allies and remove all debuffs

            // Get all alive non-healer allies on the attacking team
            const gotchisToHeal = getAlive(attackingTeam).filter(x => x.special.id !== 6)

            // Heal all allies for multiple of healers resistance
            gotchisToHeal.forEach((gotchi) => {
                let amountToHeal
                
                // If gotchi has 'cleansing_aura' status, increase heal amount
                if (attackingGotchi.statuses.includes('cleansing_aura')) {
                    amountToHeal = Math.round(modifiedAttackingGotchi.resist * MULTS.CLEANSING_AURA_HEAL)
                } else {
                    amountToHeal = Math.round(modifiedAttackingGotchi.resist * MULTS.BLESSING_HEAL)
                }

                // Check for crit
                const isCrit = rng() < modifiedAttackingGotchi.crit / 100
                if (isCrit) {
                    amountToHeal = Math.round(amountToHeal * MULTS.BLESSING_HEAL_CRIT_MULTIPLIER)
                }

                // Apply speed penalty
                const speedPenalty = (modifiedAttackingGotchi.speed - 100) * MULTS.BLESSING_HEAL_SPEED_PENALTY
                if (speedPenalty > 0) amountToHeal -= speedPenalty

                // Don't allow amountToHeal to be more than the difference between current health and max health
                if (amountToHeal > gotchi.originalStats.health - gotchi.health) {
                    amountToHeal = gotchi.originalStats.health - gotchi.health
                }

                gotchi.health += amountToHeal

                if (amountToHeal) {
                    effects.push({
                        target: gotchi.id,
                        outcome: isCrit ? 'critical' : 'success',
                        damage: -Math.abs(amountToHeal)
                    })
                }

                // Remove all debuffs
                // Add removed debuffs to statusesExpired
                gotchi.statuses.forEach((status) => {
                    if (DEBUFFS.includes(status)) {
                        statusesExpired.push({
                            target: gotchi.id,
                            status
                        })
                    }
                })

                // Remove all debuffs from gotchi
                gotchi.statuses = gotchi.statuses.filter((status) => !DEBUFFS.includes(status))
            })

            // If no allies have been healed and no debuffs removed, then special attack not done
            if (!effects.length && !statusesExpired.length) {
                specialNotDone = true
                break
            }

            break
        case 7:
            // Thunder - Attack all enemies for 50% damage and apply stun status

            const thunderTargets = getAlive(defendingTeam)

            // Check if leader passive is 'arcane_thunder' then apply stun status
            if (attackingGotchi.statuses.includes(PASSIVES[specialId - 1])) {
                const stunStatuses = ['stun']

                effects = attack(attackingGotchi, attackingTeam, defendingTeam, thunderTargets, rng, { 
                    multiplier: modifiedAttackingGotchi.speed > 100 ? MULTS.CHANNEL_THE_COVEN_DAMAGE_FAST : MULTS.CHANNEL_THE_COVEN_DAMAGE_SLOW, 
                    statuses: stunStatuses, 
                    cannotBeCountered: true, 
                    inflictPassiveStatuses: false
                })
            } else {
                effects = attack(attackingGotchi, attackingTeam, defendingTeam, thunderTargets, rng, { 
                    multiplier: modifiedAttackingGotchi.speed > 100 ? MULTS.THUNDER_DAMAGE_FAST : MULTS.THUNDER_DAMAGE_SLOW, 
                    cannotBeCountered: true, 
                    inflictPassiveStatuses: false
                })
            }

            break
        case 8:
            // Devestating Smash - Attack random enemy for 200% damage

            const smashTarget = getTarget(defendingTeam, rng)

            effects = attack(attackingGotchi, attackingTeam, defendingTeam, [smashTarget], rng, {  
                multiplier: MULTS.DEVESTATING_SMASH_DAMAGE, 
                cannotBeCountered: true,
                inflictPassiveStatuses: false
            })

            // If crit then attack again
            if (effects[0].outcome === 'critical') {
                const aliveEnemies = getAlive(defendingTeam)

                if (aliveEnemies.length) {
                    const target = getTarget(defendingTeam, rng)

                    effects.push(...attack(attackingGotchi, attackingTeam, defendingTeam, [target], rng, { 
                        multiplier: MULTS.DEVESTATING_SMASH_DAMAGE, 
                        cannotBeCountered: true,
                        inflictPassiveStatuses: false
                    }))
                }
            }

            // If leader passive is 'Clan momentum', attack again
            if (attackingGotchi.statuses.includes(PASSIVES[specialId - 1])) {
                // Check if any enemies are alive
                const aliveEnemies = getAlive(defendingTeam)

                if (aliveEnemies.length) {
                    // Do an extra devestating smash
                    const target = getTarget(defendingTeam, rng)

                    effects.push(...attack(attackingGotchi, attackingTeam, defendingTeam, [target], rng, { 
                        multiplier: MULTS.CLAN_MOMENTUM_DAMAGE, 
                        cannotBeCountered: true,
                        inflictPassiveStatuses: false
                    }))
                }
            }

            break
    }

    return {
        effects,
        statusesExpired,
        specialNotDone
    }
}

module.exports = {
    getFormationPosition,
    getModifiedStats,
    gameLoop
}