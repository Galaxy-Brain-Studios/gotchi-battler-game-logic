const seedrandom = require('seedrandom')
const ZSchema = require('z-schema')
const validator = new ZSchema()
const teamSchema = require('../../schemas/team.json')

const { GameError } = require('../../utils/errors')

const {
    PASSIVES,
    DEBUFFS,
    BUFFS,
    MULTS
} = require('./constants')

const {
    getAlive,
    getNextToAct,
    getTarget,
    getDamage,
    getModifiedStats,
    getNewActionDelay,
    simplifyTeam,
    getExpiredStatuses,
    addStatusToGotchi,
    prepareTeams,
    getLogGotchis
} = require('./helpers')

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

    // Make deep copy of team objects to avoid modifying the original objects
    team1 = JSON.parse(JSON.stringify(team1))
    team2 = JSON.parse(JSON.stringify(team2))

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
 * @param {Boolean} options.noPassiveStatuses A boolean to determine if passive statuses should be inflicted
 * @param {Number} options.critMultiplier Override the crit multiplier
 * @returns {Array} effects An array of effects to apply
 */
const attack = (attackingGotchi, attackingTeam, defendingTeam, defendingTargets, rng, options) => {
    if (!options) options = {}
    if (!options.ignoreArmor) options.ignoreArmor = false
    if (!options.multiplier) options.multiplier = 1
    if (!options.statuses) options.statuses = []
    if (!options.cannotBeEvaded) options.cannotBeEvaded = false
    if (!options.critCannotBeEvaded) options.critCannotBeEvaded = false
    if (!options.cannotBeResisted) options.cannotBeResisted = false
    if (!options.cannotBeCountered) options.cannotBeCountered = false
    if (!options.noPassiveStatuses) options.noPassiveStatuses = false
    if (!options.speedPenalty) options.speedPenalty = 0
    if (!options.noResistSpeedPenalty) options.noResistSpeedPenalty = false
    if (!options.critMultiplier) options.critMultiplier = null

    // If passive statuses are allowed then add leaderPassive status effects to attackingGotchi
    if (!options.noPassiveStatuses) {
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

    const effects = []

    defendingTargets.forEach((defendingGotchi) => {
        // Check attacking gotchi hasn't been killed by a counter
        if (attackingGotchi.health <= 0) return

        const modifiedAttackingGotchi = getModifiedStats(attackingGotchi)
        const modifiedDefendingGotchi = getModifiedStats(defendingGotchi)

        // Check for crit
        const isCrit = rng() < modifiedAttackingGotchi.crit / 100
        if (isCrit) {
            if (options.critMultiplier) {
                options.multiplier *= options.critMultiplier
            } else {
                // Apply different crit multipliers for -nrg and +nrg gotchis
                if (attackingGotchi.speed <= 100) {
                    options.multiplier *= MULTS.CRIT_MULTIPLIER_SLOW
                } else {
                    options.multiplier *= MULTS.CRIT_MULTIPLIER_FAST
                }
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

                // Add chance if gotchi has fortify status
                if (defendingGotchi.statuses.includes('fortify')) {
                    chanceToCounter += MULTS.FORTIFY_COUNTER_CHANCE
                }
                
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

    // Check for global status effects
    const allAliveGotchis = [...getAlive(attackingTeam), ...getAlive(defendingTeam)]

    allAliveGotchis.forEach((gotchi) => {
        const modifiedGotchi = getModifiedStats(gotchi)
        if (gotchi.statuses && gotchi.statuses.length) {
            gotchi.statuses.forEach((status) => {
                // Handle cleansing_aura (health regen)
                if (status === 'cleansing_aura') {
                    let amountToHeal

                    // Check if healer
                    if (gotchi.special.id === 6) {
                        amountToHeal = Math.round(modifiedGotchi.resist * MULTS.CLEANSING_AURA_REGEN)
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
        // Execute special attack
        const specialResults = specialAttack(attackingGotchi, attackingTeam, defendingTeam, rng)

        if (specialResults.specialNotDone) {
            // Do nothing which will lead to an auto attack
        } else {
            specialDone = true

            effects = specialResults.effects
            statusesExpired = specialResults.statusesExpired

            // Reset cooldown
            attackingGotchi.special.cooldown = 2
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
                noPassiveStatuses: true,
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
                noPassiveStatuses: true
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
                noPassiveStatuses: true,
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

            if (effects[0] && (effects[0].outcome === 'success' || effects[0].outcome === 'critical')) {
                // 1 chance to remove a random buff
                removeRandomBuff(curseTarget)

                if (effects[0].outcome === 'critical') {
                    // 2 chances to remove a random buff
                    removeRandomBuff(curseTarget)
                }

                // heal attacking gotchi for % of damage dealt
                let amountToHeal = Math.round(effects[0].damage * MULTS.CURSE_HEAL)

                // Don't allow amountToHeal to be more than the difference between current health and max health
                if (amountToHeal > attackingGotchi.originalStats.health - attackingGotchi.health) {
                    amountToHeal = attackingGotchi.originalStats.health - attackingGotchi.health
                }

                if (amountToHeal) {
                    attackingGotchi.health += amountToHeal

                    effects.push({
                        target: attackingGotchi.id,
                        outcome: effects[0].outcome,
                        damage: -Math.abs(amountToHeal)
                    })
                }
            }

            break
        case 6:
            // Blessing - Heal all non-healer allies and remove all debuffs

            // Get all alive non-healer allies on the attacking team
            // const gotchisToHeal = getAlive(attackingTeam).filter(x => x.special.id !== 6)
            const gotchisToHeal = getAlive(attackingTeam)

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
                let speedPenalty
                if (attackingGotchi.statuses.includes('cleansing_aura')) {
                    speedPenalty = Math.round((modifiedAttackingGotchi.speed - 100) * MULTS.CLEANSING_AURA_HEAL_SPEED_PENALTY)
                } else {
                    speedPenalty = Math.round((modifiedAttackingGotchi.speed - 100) * MULTS.BLESSING_HEAL_SPEED_PENALTY)
                }
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

            let stunStatuses = []
            // Check if leader passive is 'channel_the_coven' then apply stun status
            if (attackingGotchi.statuses.includes(PASSIVES[specialId - 1])) {
                if (rng() < MULTS.CHANNEL_THE_COVEN_STUN_CHANCE) stunStatuses.push('stun')
            } else {
                if (rng() < MULTS.THUNDER_STUN_CHANCE) stunStatuses.push('stun')
            }

            effects = attack(attackingGotchi, attackingTeam, defendingTeam, thunderTargets, rng, { 
                multiplier: MULTS.THUNDER_DAMAGE, 
                statuses: stunStatuses,
                cannotBeCountered: true, 
                noPassiveStatuses: true,
                critMultiplier: MULTS.THUNDER_CRIT_MULTIPLIER
            })

            break
        case 8:
            // Devestating Smash - Attack random enemy for 200% damage

            const smashTarget = getTarget(defendingTeam, rng)

            effects = attack(attackingGotchi, attackingTeam, defendingTeam, [smashTarget], rng, {  
                multiplier: MULTS.DEVESTATING_SMASH_DAMAGE, 
                cannotBeCountered: true,
                noPassiveStatuses: true
            })

            let anotherAttack = false
            if (attackingGotchi.statuses.includes(PASSIVES[specialId - 1])) {
                if (rng() < MULTS.CLAN_MOMENTUM_CHANCE) anotherAttack = true
            } else {
                if (rng() < MULTS.DEVESTATING_SMASH_X2_CHANCE) anotherAttack = true
            }

            if (anotherAttack) {
                // Check if any enemies are alive
                const aliveEnemies = getAlive(defendingTeam)

                if (aliveEnemies.length) {
                    // Do an extra devestating smash
                    const target = getTarget(defendingTeam, rng)

                    effects.push(...attack(attackingGotchi, attackingTeam, defendingTeam, [target], rng, { 
                        multiplier: MULTS.DEVESTATING_SMASH_X2_DAMAGE, 
                        cannotBeCountered: true,
                        noPassiveStatuses: true
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
    gameLoop
}