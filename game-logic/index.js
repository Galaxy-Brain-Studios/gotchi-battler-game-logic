const seedrandom = require('seedrandom')
const { InGameTeamSchema } = require('../schemas/ingameteam')
const { GameError } = require('../utils/errors')

const { version: gameLogicVersion } = require('../package.json')

const {
    AUTO_ATTACK_MULTIPLIER,
    COUNTER_DAMAGE_REDUCTION,
    COUNTER_ATTACK_MULTIPLIER
} = require('./constants')

const {
    getTeamGotchis,
    getAlive,
    getNextToAct,
    getTargetsFromCode,
    getDamage,
    getHealFromMultiplier,
    getEffectiveTurnEffectValue,
    getNewActionDelay,
    simplifyTeam,
    prepareBattle,
    getLogGotchis,
    getTeamStats,
    getStatusByCode,
    getTeamSpecialBars,
    focusCheck,
    counterCheck,
    getCritMultiplier,
    getModifiedStats,
    shouldDoSpecial,
    applyDamageAndSyncLeaderAuras,
    applyEffectStatus,
    applyEffectStatusResult,
    getStatusPotencyResult
} = require('./helpers')
const {
    getStatusInstances,
    getStatusCodes,
    hasStatus,
    canApplyStatus,
    consumeStatusInstance,
    removeRandomRemovableStatusCode,
    removeAllRemovableStatuses,
    toStatusExpiryEvents,
    expireStatusDurationsAfterTurn,
    getSerializableStatusInstances
} = require('./status-store')

/**
 * Run a battle between two teams.
 * @param {Object} team1 An in-game team object
 * @param {Object} team2 An in-game team object
 * @param {String} seed A seed for the random number generator
 * @param {Object|Boolean} options An object containing options for the game loop (or legacy boolean debug flag)
 * @param {Boolean} options.debug Whether the logs should include debug information
 * @param {Boolean} options.disableLeaderMechanics Whether to disable leader carry + aura buffs
 * @param {String} options.type A string to determine the type of the game loop
 * @param {Object} options.campaign An object containing the campaign information
 * @param {String} options.isBoss A boolean to determine if team2 is a boss
 * @returns {Object} logs The battle logs
 */
const gameLoop = (team1, team2, seed, options = { debug: false, disableLeaderMechanics: false, type: 'training', campaign: {}, isBoss: false }) => {
    if (!seed) throw new Error('Seed not found')

    // Backwards compat: older scripts sometimes pass a boolean "debug" flag.
    if (typeof options === 'boolean') {
        options = { debug: options }
    } else if (!options || typeof options !== 'object') {
        options = {}
    }

    // Validate team objects
    team1 = InGameTeamSchema.parse(team1)
    team2 = InGameTeamSchema.parse(team2)

    const rng = seedrandom(seed)

    const setup = prepareBattle(team1, team2, {
        disableLeaderMechanics: Boolean(options.disableLeaderMechanics)
    })

    const logs = {
        meta: {
            seed,
            timestamp: new Date(),
            type: options.type || 'training',
            campaign: options.campaign || {},
            isBoss: options.isBoss || false,
            gameLogicVersion
        },
        ...(setup.statAdjustments.length ? { setup: { statAdjustments: setup.statAdjustments } } : {}),
        gotchis: getLogGotchis(setup.gotchisForLogs),
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
            if (turnCounter >= 1000) throw new Error('Battle timeout')

            // Check if turnCounter is ready for environment effects (99,149,199, etc)
            const isEnvironmentTurn = [
                99, 149, 199, 249, 299, 349, 399, 449, 499,
                549, 599, 649, 699, 749, 799, 849, 899, 949, 999
            ].includes(turnCounter)

            if (isEnvironmentTurn) {
                const aliveGotchis = [...getAlive(team1), ...getAlive(team2)]
                aliveGotchis.forEach(x => {
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
                        return `Id: ${x.id}, Name: ${x.name}, Health: ${x.health}, Statuses: ${getStatusCodes(x)}`
                    }),
                    team2: getAlive(team2).map((x) => {
                        return `Id: ${x.id}, Name: ${x.name}, Health: ${x.health}, Statuses: ${getStatusCodes(x)}`
                    })
                })
            }

            turnCounter++
        }
    } catch {
        // Preserve logs for callers; avoid side effects like writing to disk.
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
        const modifiedStats = getModifiedStats(gotchi)

        return {
            id: gotchi.id,
            name: gotchi.name,
            health: gotchi.health,
            statuses: getStatusCodes(gotchi),
            statusInstances: getSerializableStatusInstances(gotchi),
            specialBar: gotchi.specialBar,
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
                speed: modifiedStats.speed,
                attack: modifiedStats.attack,
                defense: modifiedStats.defense,
                criticalRate: modifiedStats.criticalRate,
                criticalDamage: modifiedStats.criticalDamage,
                resist: modifiedStats.resist,
                focus: modifiedStats.focus
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
    // A duration starts after the subject's current turn, never during it.
    const turnContext = { appliedThisSubjectTurnInstances: new Set() }

    const { statusEffects, skipTurn } = handleStatusEffects(attackingGotchi, attackingTeam, defendingTeam, rng)
    let statusesExpired = []

    let actionEffects = []
    let additionalEffects = []
    if (skipTurn) {
        // Increase actionDelay
        attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)

        // A status-caused skip is still a completed subject turn. Death and a pre-action battle end are not.
        if (skipTurn !== 'attacker_dead' && skipTurn !== 'team_dead' && attackingGotchi.health > 0) {
            statusesExpired.push(...expireStatusDurationsAfterTurn(attackingGotchi, turnContext).events)
        }

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
    let specialDone = false

    // specialBar is stored as a UI/log percentage (0..100), while cooldown values are 0..6 segment counts.
    // Check if special attack is ready
    if (attackingGotchi.specialBar === 100) {
        // Check if special should be done
        if (shouldDoSpecial(attackingGotchi, attackingTeam, defendingTeam)) {
            // Execute special attack
            actionName = attackingGotchi.specialExpanded.code
            const specialResults = attack(attackingGotchi, attackingTeam, defendingTeam, rng, true, turnContext)

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

            specialDone = true
        }
    }

    if (!specialDone) {
        // Do an auto attack
        const attackResults = attack(attackingGotchi, attackingTeam, defendingTeam, rng, false, turnContext)

        actionEffects = attackResults.actionEffects
        additionalEffects = attackResults.additionalEffects
        statusesExpired = attackResults.statusesExpired

        // Increase specialBar by 1/6th
        if (attackingGotchi.specialBar < 100) {
            attackingGotchi.specialBar = Math.round(attackingGotchi.specialBar + (100 / 6))
            if (attackingGotchi.specialBar > 100) attackingGotchi.specialBar = 100
        } else {
            // Keep the specialBar at 100 so the special is still available for the next time shouldDoSpecial is true
        }
    }

    // Increase actionDelay
    if (!repeatAttack) {
        attackingGotchi.actionDelay = getNewActionDelay(attackingGotchi)
    }

    // Do not emit expiry events for a Gotchi that died while resolving its own action.
    if (attackingGotchi.health > 0) {
        statusesExpired.push(...expireStatusDurationsAfterTurn(attackingGotchi, turnContext).events)
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
        const turnEffectStatuses = getStatusInstances(gotchi, instance => {
            const statusEffect = getStatusByCode(instance.code)
            return statusEffect.turnEffects
        })

        turnEffectStatuses.forEach((turnEffectInstance) => {
            const status = getStatusByCode(turnEffectInstance.code)
            const turnEffects = status.turnEffects

            turnEffects.forEach((turnEffect) => {
                switch (turnEffect.type) {
                    case 'heal': {
                        const effectiveValue = getEffectiveTurnEffectValue(status, turnEffectInstance, turnEffect)
                        let amountToHeal = Math.round(effectiveValue)

                        if (turnEffect.valueType === 'percent') {
                            amountToHeal = Math.round(gotchi.fullHealth * (effectiveValue / 100))
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
                        const effectiveValue = getEffectiveTurnEffectValue(status, turnEffectInstance, turnEffect)
                        const damage = Math.round(turnEffect.valueType === 'percent'
                            ? gotchi.fullHealth * (effectiveValue / 100)
                            : effectiveValue)

                        applyDamageAndSyncLeaderAuras(gotchi, damage, attackingTeam, defendingTeam)

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
    const attackingStatusInstances = getStatusInstances(attackingGotchi)
    for (let i = 0; i < attackingStatusInstances.length; i++) {
        const statusInstance = attackingStatusInstances[i]
        const status = getStatusByCode(statusInstance.code)

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

                consumeStatusInstance(attackingGotchi, statusInstance)

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
 * Attack one or more gotchis. This mutates the defending gotchis health.
 * @param {Object} attackingGotchi The attacking gotchi object
 * @param {Array} attackingTeam A team object for the attacking team
 * @param {Array} defendingTeam A team object for the defending team
 * @param {Function} rng The random number generator
 * @param {Boolean} isSpecial Whether the attack is a special attack
 * @returns {Object} results The results of the attack
 */
const attack = (attackingGotchi, attackingTeam, defendingTeam, rng, isSpecial = false, turnContext = null) => {
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
    const hasSameAsAttackSpecialEffects = isSpecial && nonRepeatSpecialEffects.some(e => e.target === 'same_as_attack')

    let repeatAttack = false
    if (isSpecial && repeatAttackEffect) {
        repeatAttack = rng() <= repeatAttackEffect.chance
    }

    targets.forEach((target) => {
        // The effect for the main action of the attack
        let targetActionEffect

        // For an additional effects that come for the special attack e.g. heals
        const targetAdditionalEffects = []
        let counterSucceeded = false

        // Roll for crit multiplier
        const critMultiplier = getCritMultiplier(attackingGotchi, rng)
        const isCrit = critMultiplier > 1
        const totalMultiplier = actionMultipler * critMultiplier

        // Handle action first
        if (action === 'attack') {
            const incomingDamage = getDamage(attackingGotchi, target, totalMultiplier)
            let damage = incomingDamage

            if (!isSpecial && incomingDamage > 0 && target.health > 0 && hasStatus(target, 'counter') && counterCheck(target, rng)) {
                counterSucceeded = true
                damage = Math.round(incomingDamage * (1 - COUNTER_DAMAGE_REDUCTION))
            }

            targetActionEffect = {
                target: target.id,
                statuses: [],
                damage,
                outcome: isCrit ? 'critical' : 'success'
            }

            // Handle damage
            applyDamageAndSyncLeaderAuras(target, damage, attackingTeam, defendingTeam)

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
            // No direct action (damage/heal) to log. If the special applies any effects to
            // `same_as_attack` targets, create a placeholder actionEffect so replayers (e.g. Unity)
            // can still aim VFX at the intended targets and merge successful statuses into it.
            if (hasSameAsAttackSpecialEffects) {
                targetActionEffect = {
                    target: target.id,
                    statuses: [],
                    damage: null,
                    outcome: 'success'
                }
            }
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
                    const specialEffectResult = handleSpecialEffect(attackingTeam, attackingGotchi, target, specialEffect, rng, turnContext)

                    // If the special effect has statuses and the target is the same as the actionEffect,
                    // then merge the statuses into the actionEffect (so replayers can treat them as the
                    // "primary" per-target effects). Otherwise, keep it as an additionalEffect.
                    if (
                        targetActionEffect &&
                        specialEffectResult.effect.statuses &&
                        specialEffectResult.effect.statuses.length > 0 &&
                        targetActionEffect.target &&
                        targetActionEffect.target === specialEffectResult.effect.target
                    ) {
                        targetActionEffect.statuses.push(...specialEffectResult.effect.statuses)
                    } else {
                        // Keep resisted/failed effects as additionalEffects so the outcome can be replayed/displayed.
                        targetAdditionalEffects.push(specialEffectResult.effect)
                    }

                    statusesExpired.push(...specialEffectResult.statusesExpired)
                }
            })
        } else {
            const attackEffectStatuses = getStatusInstances(attackingGotchi, instance => {
                const status = getStatusByCode(instance.code)
                return status.category === 'attack_effect'
            })

            attackEffectStatuses.forEach((attackEffectInstance) => {
                const status = getStatusByCode(attackEffectInstance.code)

                // If it's an auto attack then handle all the statuses that have attackEffects
                const attackEffects = status.attackEffects || []

                attackEffects.forEach((attackEffect) => {
                    if (attackEffect.effectChance && attackEffect.effectChance < 1 && rng() > attackEffect.effectChance) {
                        return
                    }

                    // 'apply_status', 'gain_status', 'remove_buff', 'cleanse_target', 'cleanse_self'
                    switch (attackEffect.type) {
                        case 'apply_status': {
                            // Some attack effects are intended to be negative
                            // For example "Enlightening Strike" which applies +FOC to the target
                            // Only do a focus check if the status is a buff
                            if (status.isBuff) {
                                if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                                    if (applyEffectStatus(target, {
                                        code: attackEffect.effectStatus,
                                        source: {
                                            kind: 'auto_attack',
                                            code: status.code,
                                            gotchiId: attackingGotchi.id
                                        },
                                        durationTurns: attackEffect.durationTurns
                                    }, attackingGotchi, turnContext)) {
                                        targetActionEffect.statuses.push(attackEffect.effectStatus)
                                    }
                                }
                            } else {
                                if (applyEffectStatus(target, {
                                    code: attackEffect.effectStatus,
                                    source: {
                                        kind: 'auto_attack',
                                        code: status.code,
                                        gotchiId: attackingGotchi.id
                                    },
                                    durationTurns: attackEffect.durationTurns
                                }, attackingGotchi, turnContext)) {
                                    targetActionEffect.statuses.push(attackEffect.effectStatus)
                                }
                            }
                            break
                        }
                        case 'gain_status': {
                            if (applyEffectStatus(attackingGotchi, {
                                code: attackEffect.effectStatus,
                                source: {
                                    kind: 'auto_attack',
                                    code: status.code,
                                    gotchiId: attackingGotchi.id
                                },
                                durationTurns: attackEffect.durationTurns
                            }, attackingGotchi, turnContext)) {
                                targetAdditionalEffects.push({
                                    target: attackingGotchi.id,
                                    status: attackEffect.effectStatus,
                                    outcome: 'success'
                                })
                            }
                            break
                        }
                        case 'remove_buff': {
                            if (focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                                const removals = removeRandomRemovableStatusCode(target, true, rng)
                                statusesExpired.push(...toStatusExpiryEvents(target, removals))
                            }
                            break
                        }
                        case 'cleanse_target': {
                            const removals = removeRandomRemovableStatusCode(target, false, rng)
                            statusesExpired.push(...toStatusExpiryEvents(target, removals))
                            break
                        }
                        case 'cleanse_self': {
                            const removals = removeRandomRemovableStatusCode(attackingGotchi, false, rng)
                            statusesExpired.push(...toStatusExpiryEvents(attackingGotchi, removals))
                            break
                        }
                    }
                })
            })


            // Check for counter attack
            if (counterSucceeded && target.health > 0) {
                const counterCritMultiplier = getCritMultiplier(target, rng)
                const isCounterCrit = counterCritMultiplier > 1
                const counterDamage = getDamage(target, attackingGotchi, COUNTER_ATTACK_MULTIPLIER * counterCritMultiplier)

                applyDamageAndSyncLeaderAuras(attackingGotchi, counterDamage, attackingTeam, defendingTeam)

                targetAdditionalEffects.push({
                    target: attackingGotchi.id,
                    source: target.id,
                    damage: counterDamage,
                    outcome: 'counter',
                    critical: isCounterCrit
                })

                // Add to stats
                target.stats.counters++
                if (isCounterCrit) target.stats.crits++
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
                const specialTargets = getTargetsFromCode(specialEffect.target, attackingGotchi, attackingTeam, defendingTeam, rng)

                specialTargets.forEach((target) => {
                    const specialEffectResult = handleSpecialEffect(attackingTeam, attackingGotchi, target, specialEffect, rng, turnContext)

                    additionalEffects.push(specialEffectResult.effect)

                    statusesExpired.push(...specialEffectResult.statusesExpired)
                })
            }
        })
    }

    // Combine additionalEffects with the same target and outcome
    const cleanAdditionalEffects = []
    additionalEffects.forEach((effect) => {
        // Only combine "success" effects. Keep resisted/failed attempts separate for UI/replay fidelity.
        if (effect.outcome !== 'success') {
            cleanAdditionalEffects.push(effect)
            return
        }

        const existingEffect = cleanAdditionalEffects.find(e => e.target === effect.target && e.outcome === effect.outcome)

        if (existingEffect) {
            existingEffect.damage += effect.damage
            existingEffect.statuses.push(...effect.statuses)
        } else {
            cleanAdditionalEffects.push(effect)
        }
    })

    return {
        actionEffects,
        additionalEffects: cleanAdditionalEffects,
        statusesExpired,
        repeatAttack
    }
}

const handleSpecialEffect = (attackingTeam, attackingGotchi, target, specialEffect, rng, turnContext) => {
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
            if (specialEffect.skipFocusCheck || focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                const status = getStatusByCode(specialEffect.status)
                const statusRequest = {
                    code: specialEffect.status,
                    source: {
                        kind: 'special',
                        code: attackingGotchi.specialExpanded.code,
                        gotchiId: attackingGotchi.id
                    },
                    durationTurns: specialEffect.durationTurns
                }

                let potencyResult = null
                if (status.potencyEnabled === true) {
                    if (!canApplyStatus(target, { code: specialEffect.status })) break
                    potencyResult = getStatusPotencyResult(attackingGotchi, target, rng)
                    statusRequest.potency = potencyResult.potency
                }

                const application = applyEffectStatusResult(target, statusRequest, attackingGotchi, turnContext)
                if (application.applied) {
                    if (potencyResult?.statusCrit) attackingGotchi.stats.crits++
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
            if (specialEffect.skipFocusCheck || focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                const removals = removeRandomRemovableStatusCode(target, true, rng)
                result.statusesExpired.push(...toStatusExpiryEvents(target, removals))

                result.effect.outcome = 'success'
            } else {
                result.effect.outcome = 'resisted'
            }

            break
        }
        case 'remove_debuff': {
            const removals = removeRandomRemovableStatusCode(target, false, rng)
            result.statusesExpired.push(...toStatusExpiryEvents(target, removals))

            result.effect.outcome = 'success'
            break
        }
        case 'remove_all_buffs': {
            // Focus/resistance check if target is not on the same team as the attacking gotchi
            if (specialEffect.skipFocusCheck || focusCheck(attackingTeam, attackingGotchi, target, rng)) {
                const removals = removeAllRemovableStatuses(target, true)
                result.statusesExpired.push(...toStatusExpiryEvents(target, removals))

                result.effect.outcome = 'success'
            } else {
                result.effect.outcome = 'resisted'
            }

            break
        }
        case 'remove_all_debuffs': {
            const removals = removeAllRemovableStatuses(target, false)
            result.statusesExpired.push(...toStatusExpiryEvents(target, removals))

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
