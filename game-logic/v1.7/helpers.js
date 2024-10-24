const {
    PASSIVES,
    BUFF_MULT_EFFECTS, 
    BUFF_FLAT_EFFECTS, 
    DEBUFF_MULT_EFFECTS, 
    DEBUFF_FLAT_EFFECTS,
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
    const modifiedAttackingGotchi = getModifiedStats(attackerWithSpeedPenalty)
    const modifiedDefendingGotchi = getModifiedStats(defendingGotchi)

    let attackValue = modifiedAttackingGotchi.attack === 'magic' ? modifiedAttackingGotchi.magic : modifiedAttackingGotchi.physical

    // If attacking gotchi is in the front row then apply front row attack bonus
    if (getFormationPosition(attackingTeam, defendingTeam, attackingGotchi.id).row === 'front') {
        attackValue = Math.round(attackValue * MULTS.FRONT_ROW_ATK_BONUS)
    }

    let defenseValue = modifiedAttackingGotchi.attack === 'magic' ? modifiedDefendingGotchi.magic : modifiedDefendingGotchi.physical

    // If defending gotchi is in the front row then apply front row defence penalty
    if (getFormationPosition(attackingTeam, defendingTeam, defendingGotchi.id).row === 'front') {
        defenseValue = Math.round(defenseValue * MULTS.FRONT_ROW_DEF_NERF)
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

    // Recalculate attack type
    modifiedGotchi.attack = modifiedGotchi.magic > modifiedGotchi.physical ? 'magic' : 'physical'

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
            // All allies get 'channel_the_coven' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
            })
            break
        case 8:
            // All allies get 'clan_momentum' status
            getAlive(team).forEach(x => {
                x.statuses.push(PASSIVES[team.leaderPassive - 1])
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
    addLeaderToTeam(team2)

    // Apply stat items
    applyStatItems(allAliveGotchis)
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
 * Apply stat items to gotchis
 * @param {Array} gotchis An array of gotchis
 */
const applyStatItems = (gotchis) => {
    gotchis.forEach(gotchi => {
        // Apply stat items
        if (gotchi.item && gotchi.item.stat && gotchi.item.statValue) {
            gotchi[gotchi.item.stat] += gotchi.item.statValue
        }
    })
}

module.exports = {
    getAlive,
    getFormationPosition,
    getLeaderGotchi,
    getNextToAct,
    getTarget,
    getDamage,
    getModifiedStats,
    calculateActionDelay,
    getNewActionDelay,
    simplifyTeam,
    getUiOrder,
    addLeaderToTeam,
    removeLeaderPassivesFromTeam,
    getExpiredStatuses,
    addStatusToGotchi,
    scrambleGotchiIds,
    prepareTeams,
    getLogGotchis,
    applyStatItems
}