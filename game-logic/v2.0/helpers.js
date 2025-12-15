const STATUSES = require('./statuses.json')

const getTeamGotchis = (team) => {
    return [...team.formation.front, ...team.formation.back].filter(x => x)
}

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
    const taunt = [...getAlive(defendingTeam, 'front'), ...getAlive(defendingTeam, 'back')].filter(gotchi => gotchi.statuses && gotchi.statuses.includes('taunt'))

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

/**
 * Get a target from a target code
 * @param {String} targetCode The target code
 * @param {Object} attackingGotchi The attacking gotchi
 * @param {Array} attackingTeam The attacking team
 * @param {Array} defendingTeam The defending team
 * @param {Function} rng The random number generator
 * @returns {Array} targets An array of targets
 **/
const getTargetsFromCode = (targetCode, attackingGotchi, attackingTeam, defendingTeam, rng) => {
    /**
    *   [
            { "code": "self",               "description": "The casting Gotchi itself" },
            { "code": "enemy_random",       "description": "Random enemy" },
            { "code": "enemy_back_row",     "description": "Random enemy in the back row" },
            { "code": "enemy_front_row",    "description": "Random enemy in the front row" },
            { "code": "enemy_row_largest",  "description": "Random enemy in the row with most enemies" },
            { "code": "all_enemies",        "description": "All enemies" },

            { "code": "ally_random",        "description": "Random ally" },
            { "code": "ally_back_row",      "description": "Random ally in the back row" },
            { "code": "ally_front_row",     "description": "Random ally in the front row" },
            { "code": "ally_row_largest",   "description": "Random ally in the row with most allies" },
            { "code": "all_allies",         "description": "All allies" },

            { "code": "same_as_attack",     "description": "Targets exactly the same units as the special attack did" },
            { "code": "all",                "description": "All Gotchis on the battlefield (allies and enemies)" }
        ]
    */

    let targets = []    

    switch (targetCode) {
        case 'self':
            targets.push(attackingGotchi)
            break
        case 'enemy_random':
            targets.push(getTarget(defendingTeam, rng))
            break
        case 'enemy_back_row':
            if (getAlive(defendingTeam, 'back').length) {
                targets.push(getAlive(defendingTeam, 'back')[Math.floor(rng() * getAlive(defendingTeam, 'back').length)])
            } else {
                targets.push(getTarget(defendingTeam, rng))
            }
            break
        case 'enemy_front_row':
            if (getAlive(defendingTeam, 'front').length) {
                targets.push(getAlive(defendingTeam, 'front')[Math.floor(rng() * getAlive(defendingTeam, 'front').length)])
            } else {
                targets.push(getTarget(defendingTeam, rng))
            }
            break
        case 'enemy_row_largest': {
            const row = getAlive(defendingTeam, 'front').length > getAlive(defendingTeam, 'back').length ? 'front' : 'back'
            targets = getAlive(defendingTeam, row)
            break
        }
        case 'all_enemies':
            targets = getAlive(defendingTeam)
            break
        case 'ally_random':
            targets.push(getTarget(attackingTeam, rng))
            break
        case 'ally_back_row':
            if (getAlive(attackingTeam, 'back').length) {
                targets.push(getAlive(attackingTeam, 'back')[Math.floor(rng() * getAlive(attackingTeam, 'back').length)])
            } else {
                targets.push(getTarget(attackingTeam, rng))
            }
            break
        case 'ally_front_row':
            if (getAlive(attackingTeam, 'front').length) {
                targets.push(getAlive(attackingTeam, 'front')[Math.floor(rng() * getAlive(attackingTeam, 'front').length)])
            } else {
                targets.push(getTarget(attackingTeam, rng))
            }
            break
        case 'ally_row_largest': {
            const row = getAlive(attackingTeam, 'front').length > getAlive(attackingTeam, 'back').length ? 'front' : 'back'
            targets = getAlive(attackingTeam, row)
            break
        }
        case 'all_allies':
            targets = getAlive(attackingTeam)
            break
        case 'same_as_attack':
            throw new Error('same_as_attack is not implemented in getTargetsFromCode')
        case 'all':
            targets = [...getAlive(attackingTeam), ...getAlive(defendingTeam)]
            break
        default:
            throw new Error(`Invalid target code: ${targetCode}`)
    }

    return targets
}

/**
 * Get the damage of an attack
 * @param {Object} attackingGotchi The gotchi attacking
 * @param {Object} defendingGotchi The gotchi defending
 * @param {Number} multiplier The damage multiplier
 * @returns {Number} damage The damage of the attack
 **/
const getDamage = (attackingGotchi, defendingGotchi, multiplier) => {

    // Apply any status effects
    const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)
    const modifiedDefendingGotchi = getModifiedStats(defendingGotchi)

    // Calculate damage
    let damage = Math.round((modifiedAttackingGotchi.attack / modifiedDefendingGotchi.defense) * 100)

    // Apply multiplier
    if (multiplier) damage = Math.round(damage * multiplier)

    // check for environment effects
    if (defendingGotchi.environmentEffects && defendingGotchi.environmentEffects.length > 0) {
        damage = Math.round(damage * (1 + (defendingGotchi.environmentEffects.length * 0.5)))
    }

    return damage
}

const getHealFromMultiplier = (healingGotchi, target, multiplier) => {
    // % of original target health
    let amountToHeal = Math.round(target.fullHealth * multiplier)

    // Don't allow amountToHeal to be more than the difference between current health and max health
    if (amountToHeal > target.fullHealth - target.health) {
        amountToHeal = target.fullHealth - target.health
    }

    // Handle stats
    healingGotchi.stats.healGiven += amountToHeal
    target.stats.healReceived += amountToHeal

    return amountToHeal
}

/**
 * Apply status effects to a gotchi
 * @param {Object} gotchi An in-game gotchi object
 * @returns {Object} gotchi An in-game gotchi object with modified stats
 */
const getModifiedStats = (gotchi) => {
    const statMods = {}

    const decimalStats = ['criticalRate', 'criticalDamage']

    gotchi.statuses.forEach(statusCode => {
        const statusStatMods = {}
        const status = getStatusByCode(statusCode)

        // Check if status is a stat modifier
        if (status.category !== 'stat_modifier') {
            return
        }

        status.statModifiers.forEach(statModifier => {
            let statChange = 0

            if (statModifier.valueType === 'flat') {
                statChange = statModifier.value
            } else if (statModifier.valueType === 'percent') {
                statChange = gotchi[statModifier.statName] * (statModifier.value / 100)
            } else {
                throw new Error(`Invalid value type for status ${statusCode}: ${statModifier.valueType}`)
            }

            if (decimalStats.includes(statModifier.statName)) {
                statChange = Math.round(statChange * 100) / 100
            } else {
                statChange = Math.round(statChange)
            }

            if (statusStatMods[statModifier.statName]) {
                statusStatMods[statModifier.statName] = statusStatMods[statModifier.statName] + statChange
            } else {
                statusStatMods[statModifier.statName] = statChange
            }
        })

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

    // Enforce practical lower bounds for certain stats regardless of whether they were modified by statuses
    if (modifiedGotchi.defense < 1) {
        modifiedGotchi.defense = 1
    }
    if (modifiedGotchi.speed < 1) {
        modifiedGotchi.speed = 1
    }

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
 * @param {Boolean} addStatuses Whether to add the leader statuses to the team
 **/
const addLeaderToTeam = (team, addStatuses) => {
    if (!addStatuses) return

    // Add passive leader abilities
    const teamLeader = getLeaderGotchi(team)
    const leaderskill = teamLeader.leaderSkillExpanded

    if (!leaderskill || !leaderskill.statuses) return

    leaderskill.statuses.forEach(leaderSkillStatus => {
        getAlive(team).forEach(x => {
            addStatusToGotchi(x, leaderSkillStatus.status, leaderSkillStatus.stackCount)
        })
    })
}

/**
 * Add a status to a gotchi
 * @param {Object} gotchi An in-game gotchi object
 * @param {String} status The status to add
 * @param {Integer} count The number of the status to add
 * @returns {Boolean} success A boolean to determine if the status was added
 **/
const addStatusToGotchi = (gotchi, status, count) => {
    if (!count) count = 1

    for (let i = 0; i < count; i++) {
        gotchi.statuses.push(status)
    }

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
    scrambleGotchiIds(allAliveGotchis, team1, team2)

    // Apply stat items
    applyStatItems(allAliveGotchis)

    allAliveGotchis.forEach(x => {
        // Add statuses property to all gotchis
        x.statuses = []

        // Calculate initial action delay for all gotchis
        x.actionDelay = calculateActionDelay(x)

        // Set special specialBar
        // gotchi.specialBar is the % the special bar is full. 100% is full. 0% is empty.
        // We split into 6 sections, so the initial specialBar is the number of sections to fill.
        x.specialBar = Math.round((100/6) * (6 - x.specialExpanded.initialCooldown))

        // Handle Health
        // add fullHealth property to all gotchis
        x.fullHealth = x.health

        // Add environmentEffects to all gotchis
        x.environmentEffects = []

        // Add stats to all gotchis
        x.stats = {
            dmgGiven: 0,
            dmgReceived: 0,
            healGiven: 0,
            healReceived: 0,
            crits: 0,
            resists: 0,
            focuses: 0,
            counters: 0,
            hits: 0
        }
    })

    const teams = [team1, team2]

    teams.forEach(team => {
        if (team.startingState && team.startingState.length) {
            team.startingState.forEach(gotchiState => {
                // Find gotchi in allAliveGotchis
                const gotchi = allAliveGotchis.find(x => x.id === gotchiState.id)

                if (!gotchi) {
                    throw new Error(`Gotchi with id ${gotchiState.id} not found in allAliveGotchis`)
                }

                // Set Health and statuses
                gotchi.health = gotchiState.health
                gotchi.statuses = gotchiState.statuses
            })

            // Don't add leader passive statuses if we have a starting state 
            addLeaderToTeam(team, false)
        } else {
            // Add leader passives to team
            addLeaderToTeam(team, true) 
        }
    })
}

/**
 * Get log gotchi object for battle logs
 * @param {Array} allAliveGotchis An array of all alive gotchis
 * @returns {Array} logGotchis An array of gotchi objects for logs
 */
const getLogGotchis = (allAliveGotchis) => {
    const logGotchis = JSON.parse(JSON.stringify(allAliveGotchis))

    logGotchis.forEach(x => {
        // Remove unnecessary properties to reduce log size
        delete x.actionDelay
        delete x.environmentEffects
        delete x.stats
        delete x.createdAt
        delete x.updatedAt
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

/**
 * Remove stat items from gotchis
 * This is used when replaying a battle from logs where the stat items have already been applied
 * @param {Array} gotchis An array of gotchis
 */
const removeStatItems = (gotchis) => {
    gotchis.forEach(gotchi => {
        // Remove stat items
        if (gotchi.item && gotchi.item.stat && gotchi.item.statValue) {
            gotchi[gotchi.item.stat] -= gotchi.item.statValue
        }
    })
}

const getTeamStats = (team) => {
    const teamStats = {}

    const gotchis = getTeamGotchis(team)

    gotchis.forEach(gotchi => {
        Object.keys(gotchi.stats).forEach(stat => {
            if (!teamStats[stat]) teamStats[stat] = 0
            teamStats[stat] += gotchi.stats[stat]
        })
    })

    return {
        ...teamStats,
        gotchis: gotchis.map(gotchi => { 
            return {
                id: gotchi.id,
                name: gotchi.name,
                ...gotchi.stats
            }
        })
    }
}

const getStatusByCode = (statusCode) => {
    const status = STATUSES.find(status => status.code === statusCode)

    if (!status) {
        throw new Error(`Status with code ${statusCode} not found`)
    }

    return status
}

const getTeamSpecialBars = (team1, team2) => {
    const specialBars = []

    for (const gotchi of [...getTeamGotchis(team1), ...getTeamGotchis(team2)]) {
        specialBars.push({
            id: gotchi.id,
            val: gotchi.specialBar
        })
    }

    return specialBars
}

const focusCheck = (attackingTeam, attackingGotchi, targetGotchi, rng) => {
    const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)
    const modifiedTargetGotchi = getModifiedStats(targetGotchi)

    const attackingTeamGotchis = getTeamGotchis(attackingTeam)
    // If the attacking gotchi is on the same team as the defending gotchi then always return true
    if (attackingTeamGotchis.find(gotchi => gotchi.id === targetGotchi.id)) {
        return true
    } else {
        // Status apply chance is clamp(0.5 + (FOC - RES) / 200, 0.15, 0.95)
        const chance = Math.max(Math.min(0.5 + (modifiedAttackingGotchi.focus - modifiedTargetGotchi.resist) / 200, 0.95), 0.15)

        const result = rng() < chance

        if (result) {
            // if attacking gotchi has beaten the focus check then add to stats
            attackingGotchi.stats.focuses++
        } else {
            targetGotchi.stats.resists++
        }

        return result
    }
}

const getCritMultiplier = (gotchi, rng) => {
    const modifiedGotchi = getModifiedStats(gotchi)
    const isCrit = rng() < Math.max(Math.min(modifiedGotchi.criticalRate / 100, 1), 0.05)
    if (isCrit) {
        return (modifiedGotchi.criticalDamage / 100) + 1
    }
    return 1
}

module.exports = {
    getTeamGotchis,
    getAlive,
    getFormationPosition,
    getLeaderGotchi,
    getNextToAct,
    getTarget,
    getTargetsFromCode,
    getDamage,
    getHealFromMultiplier,
    getModifiedStats,
    calculateActionDelay,
    getNewActionDelay,
    simplifyTeam,
    getUiOrder,
    addLeaderToTeam,
    addStatusToGotchi,
    scrambleGotchiIds,
    prepareTeams,
    getLogGotchis,
    applyStatItems,
    removeStatItems,
    getTeamStats,
    getStatusByCode,
    getTeamSpecialBars,
    focusCheck,
    getCritMultiplier
}