const seedrandom = require('seedrandom')
const { InGameTeamSchema } = require('../../schemas/ingameteam')
const { GameError } = require('../../utils/errors')

const STATUSES = require('./statuses.json')
const AUTO_ATTACK_MULTIPLIER = 0.85
const COUNTER_ATTACK_MULTIPLIER = 0.5

const {
    getTeamGotchis,
    getAlive,
    getNextToAct,
    getTargetsFromCode,
    getDamage,
    getHealFromMultiplier,
    getNewActionDelay,
    simplifyTeam,
    addStatusToGotchi,
    prepareTeams,
    getLogGotchis,
    getTeamStats,
    getStatusByCode,
    getTeamSpecialBars,
    focusCheck,
    getCritMultiplier,
    getModifiedStats
} = require('./helpers')

/**
 * Run a battle between two teams 
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 * @param {String} seed A seed for the random number generator
 * @param {Object} options An object containing options for the game loop
 * @param {Boolean} options.debug A boolean to determine if the logs should include debug information
 * @param {String} options.type A string to determine the type of the game loop
 * @param {Object} options.campaign An object containing the campaign information
 * @param {String} options.isBoss A boolean to determine if team2 is a boss
 * @returns {Object} logs The battle logs
 */
const gameLoop = (team1, team2, seed, options = { debug: false, type: 'training', campaign: {}, isBoss: false }) => {
    if (!seed) throw new Error('Seed not found')

    // Validate team objects
    team1 = InGameTeamSchema.parse(team1)
    team2 = InGameTeamSchema.parse(team2)

    const rng = seedrandom(seed)

    const allAliveGotchis = [...getAlive(team1), ...getAlive(team2)]

    prepareTeams(allAliveGotchis, team1, team2)

    const logs = {
        meta: {
            seed,
            timestamp: new Date(),
            type: options.type || 'training',
            campaign: options.campaign || {},
            isBoss: options.isBoss || false
        },
        gotchis: getLogGotchis(allAliveGotchis),
        layout: {
            teams: [
                simplifyTeam(team1),
                simplifyTeam(team2)
            ]
        },
        turns: [],
        result: {},
        debug: []
    }

    let turnCounter = 0

    try {
        while (getAlive(team1).length && getAlive(team2).length) {
            // Check if turnCounter is ready for environment effects (99,149,199, etc)
            let isEnvironmentTurn = [
                99, 149, 199, 249, 299, 349, 399, 449, 499,
                549, 599, 649, 699, 749, 799, 849, 899, 949, 999].includes(turnCounter)
            if (isEnvironmentTurn) {
                allAliveGotchis.forEach(x => {
                    x.environmentEffects.push('damage_up')
                })
            }

            const turnLogs = executeTurn(team1, team2, rng)

            turnLogs.specialBars = getTeamSpecialBars(team1, team2)

            // Check if turnCounter is ready for environment effects (99,149,199, etc)
            if (isEnvironmentTurn) turnLogs.environmentEffects = ['damage_up']

            logs.turns.push({ index: turnCounter, ...turnLogs })

            if (options.debug) {
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

    // Add stats to logs
    logs.result.stats = {
        numOfTurns: turnCounter,
        team1: getTeamStats(team1),
        team2: getTeamStats(team2)
    }

    logs.result.winner = getAlive(team1).length ? 1 : 2
    logs.result.winningTeam = logs.result.winner === 1 ? getTeamGotchis(team1) : getTeamGotchis(team2)
    logs.result.winningTeam = logs.result.winningTeam.map((gotchi) => {
        return {
            id: gotchi.id,
            name: gotchi.name,
            health: gotchi.health,
            statuses: gotchi.statuses,
            originalStats: {
                speed: gotchi.speed,
                attack: gotchi.attack,
                defense: gotchi.defense,
                criticalRate: gotchi.criticalRate,
                criticalDamage: gotchi.criticalDamage,
                resist: gotchi.resist,
                focus: gotchi.focus
            },
            modifiedStats: {
                speed: getModifiedStats(gotchi).speed,
                attack: getModifiedStats(gotchi).attack,
                defense: getModifiedStats(gotchi).defense,
                criticalRate: getModifiedStats(gotchi).criticalRate,
                criticalDamage: getModifiedStats(gotchi).criticalDamage,
                resist: getModifiedStats(gotchi).resist,
                focus: getModifiedStats(gotchi).focus
            }
        }
    })

    if (!options.debug) delete logs.debug

    return logs
}

const executeTurn = (team1, team2, rng) => {
    const nextToAct = getNextToAct(team1, team2, rng)

    const attackingTeam = nextToAct.team === 1 ? team1 : team2
    const defendingTeam = nextToAct.team === 1 ? team2 : team1

    const attackingGotchi = attackingTeam.formation[nextToAct.row][nextToAct.position]

    let { statusEffects, skipTurn } = handleStatusEffects(attackingGotchi, attackingTeam, defendingTeam, rng)
    let statusesExpired = []

    let actionEffects = []
    let additionalEffects = []
    if (skipTurn) {
        // Increase actionDelay
        attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)

        return {
            skipTurn,
            action: {
                user: attackingGotchi.id,
                name: 'auto',
                actionEffects,
                additionalEffects
            },
            statusEffects,
            statusesExpired
        }
    }

    let actionName = 'auto'
    let repeatAttack = false
    // Check if special attack is ready
    if (attackingGotchi.specialBar === 100) {
        // Execute special attack
        actionName = attackingGotchi.specialExpanded.code
        const specialResults = attack(attackingGotchi, attackingTeam, defendingTeam, rng, true)

        actionEffects = specialResults.actionEffects
        additionalEffects = specialResults.additionalEffects
        statusesExpired = specialResults.statusesExpired

        if (specialResults.repeatAttack) {
            // Don't reset specialBar, just repeat the attack
            repeatAttack = true
        } else {
            // Reset specialBar
            attackingGotchi.specialBar = Math.round((100 / 6) * (6 - attackingGotchi.specialExpanded.cooldown))
        }
    } else {
        // Do an auto attack
        const attackResults = attack(attackingGotchi, attackingTeam, defendingTeam, rng)

        actionEffects = attackResults.actionEffects
        additionalEffects = attackResults.additionalEffects
        statusesExpired = attackResults.statusesExpired

        // Increase specialBar by 1/6th
        attackingGotchi.specialBar = Math.round(attackingGotchi.specialBar + (100 / 6))
        if (attackingGotchi.specialBar > 100) attackingGotchi.specialBar = 100
    }

    // Increase actionDelay
    if (!repeatAttack) {
        attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)
    }

    return {
        skipTurn,
        action: {
            user: attackingGotchi.id,
            name: actionName,
            actionEffects,
            additionalEffects
        },
        statusEffects,
        statusesExpired
    }
}

// Deal with start of turn status effects
const handleStatusEffects = (attackingGotchi, attackingTeam, defendingTeam) => {
    const statusEffects = []
    let skipTurn = null

    // Check for global status effects
    const allAliveGotchis = [...getAlive(attackingTeam), ...getAlive(defendingTeam)]

    allAliveGotchis.forEach((gotchi) => {
        // Get all statuses that have turnEffects
        const turnEffectStatuses = gotchi.statuses.filter(status => {
            const statusEffect = getStatusByCode(status)
            return statusEffect.turnEffects
        })

        turnEffectStatuses.forEach((turnEffectStatus) => {

            const status = getStatusByCode(turnEffectStatus)

            const turnEffects = status.turnEffects

            turnEffects.forEach((turnEffect) => {
                switch (turnEffect.type) {
                    case 'heal': {
                        let amountToHeal = turnEffect.value

                        if (turnEffect.valueType === 'percent') {
                            amountToHeal = Math.round(gotchi.fullHealth * (amountToHeal / 100))
                        }

                        // Don't allow amountToHeal to be more than the difference between current health and max health
                        if (amountToHeal > gotchi.fullHealth - gotchi.health) {
                            amountToHeal = gotchi.fullHealth - gotchi.health
                        }

                        if (amountToHeal > 0) {
                            // Add status effect
                            statusEffects.push({
                                target: gotchi.id,
                                status: status.code,
                                damage: -amountToHeal,
                                remove: false
                            })

                            gotchi.health += amountToHeal
                        }

                        break
                    }
                    case 'damage': {
                        const damage = turnEffect.value

                        gotchi.health -= damage
                        if (gotchi.health <= 0) gotchi.health = 0

                        // Add status effect
                        statusEffects.push({
                            target: gotchi.id,
                            status: status.code,
                            damage: damage,
                            remove: false
                        })

                        gotchi.stats.dmgReceived += damage

                        break
                    }
                    case 'skip_turn': {
                        // Do nothing here and handle after damage/heal
                        break
                    }
                    default: {
                        throw new Error(`Invalid turn status effect type: ${turnEffect.type}`)
                    }
                }
            })
        })
    })

    // Check if gotchi is dead
    if (attackingGotchi.health <= 0) {
        return {
            statusEffects,
            skipTurn: 'attacker_dead'
        }
    }

    // Check if a whole team is dead
    if (getAlive(attackingTeam).length === 0 || getAlive(defendingTeam).length === 0) {
        return {
            statusEffects,
            skipTurn: 'team_dead'
        }
    }

    // Check for turn skipping statuses
    for (let i = 0; i < attackingGotchi.statuses.length; i++) {
        const status = getStatusByCode(attackingGotchi.statuses[i])

        if (status.turnEffects) {
            // Get first instance of a turn effect that is a skip_turn
            const skipTurnEffect = status.turnEffects.find(turnEffect => turnEffect.type === 'skip_turn')
            if (skipTurnEffect) {
                statusEffects.push({
                    target: attackingGotchi.id,
                    status: status.code,
                    damage: 0,
                    remove: true
                })

                skipTurn = status.code

                // Remove status
                attackingGotchi.statuses.splice(i, 1)

                break
            }
        }
    }

    return {
        statusEffects,
        skipTurn
    }
}

/**
 * Attack one or more gotchis. This mutates the defending gotchis health
 * @param {Object} attackingGotchi The attacking gotchi object
 * @param {Array} attackingTeam A team object for the attacking team
 * @param {Array} defendingTeam A team object for the defending team
 * @param {Function} rng The random number generator
 * @param {Boolean} isSpecial A boolean to determine if the attack is a special attack
 * @returns {Object} results The results of the attack
 * @returns {Array} results.effects An array of effects to apply
 * @returns {Array} results.statusesExpired An array of statuses that expired
 */
const attack = (attackingGotchi, attackingTeam, defendingTeam, rng, isSpecial = false) => {
    const action = isSpecial ? attackingGotchi.specialExpanded.actionType : 'attack'

    const targetCode = isSpecial ? attackingGotchi.specialExpanded.target : 'enemy_random'
    const targets = getTargetsFromCode(targetCode, attackingGotchi, attackingTeam, defendingTeam, rng)

    const actionMultipler = isSpecial ? attackingGotchi.specialExpanded.actionMultiplier : AUTO_ATTACK_MULTIPLIER

    const specialEffects = isSpecial ? (attackingGotchi.specialExpanded.effects || []) : []

    const actionEffects = []
    const additionalEffects = []
    const statusesExpired = []

    // repeat_attack is a meta-effect: roll once per special use (not once per target)
    const repeatAttackEffect = isSpecial ? specialEffects.find(e => e.effectType === 'repeat_attack') : null
    const nonRepeatSpecialEffects = isSpecial ? specialEffects.filter(e => e.effectType !== 'repeat_attack') : []

    let repeatAttack = false
    if (isSpecial && repeatAttackEffect) {
        repeatAttack = rng() <= repeatAttackEffect.chance
    }

    targets.forEach((target) => {
        // The effect for the main action of the attack
        let targetActionEffect

        // For an additional effects that come for the special attack e.g. heals
        const targetAdditionalEffects = []

        // Roll for crit multiplier
        const critMultiplier = getCritMultiplier(attackingGotchi, rng)
        const isCrit = critMultiplier > 1
        const totalMultiplier = actionMultipler * critMultiplier

        // Handle action first
        if (action === 'attack') {
            const damage = getDamage(attackingGotchi, target, totalMultiplier)

            targetActionEffect = {
                target: target.id,
                statuses: [],
                damage,
                outcome: isCrit ? 'critical' : 'success'
            }

            // Handle damage
            target.health -= damage

            // Handle stats
            if (isCrit) attackingGotchi.stats.crits++
            attackingGotchi.stats.hits++
            attackingGotchi.stats.dmgGiven += damage
            target.stats.dmgReceived += damage

        } else if (action === 'heal') {
            const amountToHeal = getHealFromMultiplier(attackingGotchi, target, totalMultiplier)

            targetActionEffect = {
                target: target.id,
                statuses: [],
                damage: -amountToHeal,
                outcome: 'success'
            }

            // Handle healing
            target.health += amountToHeal

        } else if (action === 'none') {
            // Do nothing
        } else {
            // Check we actually have a valid action
            throw new Error(`Invalid action: ${action}`)
        }

        // If it's a special attack then handle the special effects with target 'same_as_attack'
        if (isSpecial) {
            nonRepeatSpecialEffects.forEach((specialEffect) => {
                // Only handle special effects here that have a target code of 'same_as_attack'
                // Handle the rest after the action is done
                // This is to ensure that these effects are not applied multiple times
                // e.g. if the target is 'all_enemies' then we don't want to apply that here for every target

                if (specialEffect.target === 'same_as_attack') {
                    // Handle the effect
                    const specialEffectResult = handleSpecialEffect(attackingTeam, attackingGotchi, target, specialEffect, rng)

                    // Do we already have an action effect with attack damage or healing?
                    if (targetActionEffect) {
                        // If the special effect has statuses and the target is the same as the actionEffect 
                        // then add the statuses to the actionEffect
                        if (
                            specialEffectResult.effect.statuses &&
                            specialEffectResult.effect.statuses.length > 0 &&
                            targetActionEffect.target &&
                            targetActionEffect.target === specialEffectResult.effect.target
                        ) {
                            targetActionEffect.statuses.push(...specialEffectResult.effect.statuses)
                        } else {
                            targetAdditionalEffects.push(specialEffectResult.effect)
                        }
                    } else {
                        // If the special's actionType is 'none' there is no main actionEffect to merge into,
                        // so log everything as additionalEffects (avoids turning a status into an actionEffect).
                        targetAdditionalEffects.push(specialEffectResult.effect)
                    }

                    statusesExpired.push(...specialEffectResult.statusesExpired)
                }
            })
        } else {
            // If it's an auto attack then handle all the statuses that have attackEffects
            const attackEffects = attackingGotchi.statuses.filter(status => {
                const statusEffect = getStatusByCode(status)
                return statusEffect.attackEffects
            })

            attackEffects.forEach((attackEffect) => {
                if (attackEffect.effectChance && attackEffect.effectChance < 1 && rng() > attackEffect.effectChance) {
                    return
                }

                // 'apply_status', 'gain_status', 'remove_buff', 'cleanse_target', 'cleanse_self'
                switch (attackEffect.type) {
                    case 'apply_status': {
                        if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                            if (addStatusToGotchi(target, attackEffect.status)) {
                                targetActionEffect.statuses.push(attackEffect.status)
                            }
                        }
                        break
                    }
                    case 'gain_status': {
                        if (addStatusToGotchi(attackingGotchi, attackEffect.status)) {
                            targetAdditionalEffects.push({
                                target: attackingGotchi.id,
                                status: attackEffect.status,
                                outcome: 'success'
                            })
                        }
                        break
                    }
                    case 'remove_buff': {
                        if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                            const buffs = target.statuses.filter(status => STATUSES[status].isBuff)

                            if (buffs.length) {
                                const randomBuff = buffs[Math.floor(rng() * buffs.length)]
                                statusesExpired.push({
                                    target: target.id,
                                    status: randomBuff
                                })

                                // Remove first instance of randomBuff (there may be multiple)
                                const index = target.statuses.indexOf(randomBuff)
                                target.statuses.splice(index, 1)
                            }
                        }
                        break
                    }
                    case 'cleanse_target': {
                        const debuffs = target.statuses.filter(status => STATUSES[status].isDebuff)

                        if (debuffs.length) {
                            const randomDebuff = debuffs[Math.floor(rng() * debuffs.length)]
                            statusesExpired.push({
                                target: target.id,
                                status: randomDebuff
                            })

                            // Remove first instance of randomDebuff (there may be multiple)
                            const index = target.statuses.indexOf(randomDebuff)
                            target.statuses.splice(index, 1)
                        }
                        break
                    }
                    case 'cleanse_self': {
                        const debuffs = attackingGotchi.statuses.filter(status => STATUSES[status].isDebuff)

                        if (debuffs.length) {
                            const randomDebuff = debuffs[Math.floor(rng() * debuffs.length)]
                            statusesExpired.push({
                                target: attackingGotchi.id,
                                status: randomDebuff
                            })

                            // Remove first instance of randomDebuff (there may be multiple)
                            const index = attackingGotchi.statuses.indexOf(randomDebuff)
                            attackingGotchi.statuses.splice(index, 1)
                        }
                        break
                    }
                }
            })

            // Check for counter attack
            if (target.statuses.includes('taunt') && target.health > 0) {
                const counterDamage = getDamage(target, attackingGotchi, COUNTER_ATTACK_MULTIPLIER)

                attackingGotchi.health -= counterDamage

                targetAdditionalEffects.push({
                    target: attackingGotchi.id,
                    source: target.id,
                    damage: counterDamage,
                    outcome: 'counter'
                })

                // Add to stats
                target.stats.counters++
            }
        }

        // If the actionType is 'none' then there may not be an actionEffect
        if (targetActionEffect) {
            actionEffects.push(targetActionEffect)
        }

        // Add additional effects to the effects array
        additionalEffects.push(...targetAdditionalEffects)
    })

    // Handle specialEffects that are not 'same_as_attack'
    if (isSpecial) {
        nonRepeatSpecialEffects.forEach((specialEffect) => {
            if (specialEffect.target !== 'same_as_attack') {
                const targets = getTargetsFromCode(specialEffect.target, attackingGotchi, attackingTeam, defendingTeam, rng)

                targets.forEach((target) => {
                    const specialEffectResult = handleSpecialEffect(attackingTeam, attackingGotchi, target, specialEffect, rng)

                    additionalEffects.push(specialEffectResult.effect)

                    statusesExpired.push(...specialEffectResult.statusesExpired)
                })
            }
        })
    }

    return {
        actionEffects,
        additionalEffects,
        statusesExpired,
        repeatAttack
    }
}

const handleSpecialEffect = (attackingTeam, attackingGotchi, target, specialEffect, rng) => {
    const result = {
        effect: {
            source: attackingGotchi.id,
            target: target.id,
            damage: null,
            statuses: [],
            outcome: 'failed'
        },
        statusesExpired: []
    }

    // Check for chance of the special effect
    if (specialEffect.chance && specialEffect.chance < 1 && rng() > specialEffect.chance) {
        return result
    }

    switch (specialEffect.effectType) {
        case 'status': {
            // Focus/resistance check if target is not on the same team as the attacking gotchi
            if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                if (addStatusToGotchi(target, specialEffect.status)) {
                    result.effect.statuses.push(specialEffect.status)
                    result.effect.outcome = 'success'
                }
            } else {
                result.effect.outcome = 'resisted'
            }
            break
        }
        case 'heal': {
            const amountToHeal = getHealFromMultiplier(attackingGotchi, target, specialEffect.value)

            result.effect.damage = -amountToHeal
            result.effect.outcome = 'success'

            target.health += amountToHeal
            break
        }
        case 'remove_buff': {
            // Focus/resistance check if target is not on the same team as the attacking gotchi
            if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                const buffs = target.statuses.filter(statusCode => {
                    const status = getStatusByCode(statusCode)
                    return status.isBuff
                })

                if (buffs.length) {
                    const randomBuff = buffs[Math.floor(rng() * buffs.length)]
                    result.statusesExpired.push({
                        target: target.id,
                        status: randomBuff
                    })

                    // Remove first instance of randomBuff (there may be multiple)
                    const index = target.statuses.indexOf(randomBuff)
                    target.statuses.splice(index, 1)
                }

                result.effect.outcome = 'success'
            } else {
                result.effect.outcome = 'resisted'
            }

            break
        }
        case 'remove_debuff': {
            const debuffs = target.statuses.filter(statusCode => {
                const status = getStatusByCode(statusCode)
                return !status.isBuff
            })

            if (debuffs.length) {
                const randomDebuff = debuffs[Math.floor(rng() * debuffs.length)]
                result.statusesExpired.push({
                    target: target.id,
                    status: randomDebuff
                })

                // Remove first instance of randomDebuff (there may be multiple)
                const index = target.statuses.indexOf(randomDebuff)
                target.statuses.splice(index, 1)
            }

            result.effect.outcome = 'success'
            break
        }
        case 'remove_all_buffs': {
            // Focus/resistance check if target is not on the same team as the attacking gotchi
            if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                const buffsToRemove = target.statuses.filter(statusCode => {
                    const status = getStatusByCode(statusCode)
                    return status.isBuff
                })

                buffsToRemove.forEach((buff) => {
                    result.statusesExpired.push({
                        target: target.id,
                        status: buff
                    })
                })

                if (buffsToRemove.length) {
                    // Filter statuses so only debuffs remain
                    target.statuses = target.statuses.filter(statusCode => {
                        const status = getStatusByCode(statusCode)
                        return !status.isBuff
                    })
                }

                result.effect.outcome = 'success'
            } else {
                result.effect.outcome = 'resisted'
            }

            break
        }
        case 'remove_all_debuffs': {
            const debuffsToRemove = target.statuses.filter(statusCode => {
                const status = getStatusByCode(statusCode)
                return !status.isBuff
            })

            debuffsToRemove.forEach((debuff) => {
                result.statusesExpired.push({
                    target: target.id,
                    status: debuff
                })
            })

            if (debuffsToRemove.length) {
                // Filter statuses so only buffs remain
                target.statuses = target.statuses.filter(statusCode => {
                    const status = getStatusByCode(statusCode)
                    return status.isBuff
                })
            }

            result.effect.outcome = 'success'

            break
        }
        default:
            throw new Error(`Invalid special effect type: ${specialEffect.effectType}`)
    }

    return result
}

module.exports = {
    gameLoop,
    attack
}