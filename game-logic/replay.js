const SETUP_STATS = [
    'speed',
    'health',
    'attack',
    'defense',
    'criticalRate',
    'criticalDamage',
    'resist',
    'focus'
]

const clone = (value) => JSON.parse(JSON.stringify(value))

const roundStatLikeEngine = (statName, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return value
    if (statName === 'health') return Math.round(value)
    return Math.round(value * 10) / 10
}

const getLogGotchis = (log) => {
    if (!log || !Array.isArray(log.gotchis)) {
        throw new Error('Cannot rerun log: log.gotchis is required')
    }

    return log.gotchis
}

const getLayoutTeams = (log) => {
    if (!log || !log.layout || !Array.isArray(log.layout.teams) || log.layout.teams.length !== 2) {
        throw new Error('Cannot rerun log: log.layout.teams must contain exactly two teams')
    }

    return log.layout.teams
}

const getLogSeed = (log) => {
    return log?.meta?.seed || 'randomseed'
}

const getBattleOptionsFromLog = (log, options = {}) => {
    return {
        debug: false,
        type: log?.meta?.type || 'training',
        campaign: log?.meta?.campaign || {},
        isBoss: Boolean(log?.meta?.isBoss),
        ...options
    }
}

const stripStaticSetupSources = (gotchi) => {
    gotchi.item = null
    delete gotchi.itemExpanded

    for (let i = 1; i <= 6; i++) {
        gotchi[`crystalSlot${i}`] = null
        delete gotchi[`crystalSlot${i}Expanded`]
    }

    return gotchi
}

const subtractStatAdjustments = (gotchis, statAdjustments) => {
    const gotchiById = new Map(gotchis.map(gotchi => [gotchi.id, gotchi]))

    statAdjustments.forEach((adjustment) => {
        if (!adjustment || !SETUP_STATS.includes(adjustment.stat)) return

        const gotchi = gotchiById.get(adjustment.id)
        if (!gotchi) {
            throw new Error(`Cannot rebase log: stat adjustment references unknown gotchi id ${adjustment.id}`)
        }

        const value = Number(adjustment.value)
        if (!Number.isFinite(value)) {
            throw new Error(`Cannot rebase log: stat adjustment for gotchi ${adjustment.id} has invalid value ${adjustment.value}`)
        }

        const current = gotchi[adjustment.stat]
        if (typeof current !== 'number' || !Number.isFinite(current)) {
            throw new Error(`Cannot rebase log: gotchi ${adjustment.id} is missing numeric stat ${adjustment.stat}`)
        }

        gotchi[adjustment.stat] = roundStatLikeEngine(adjustment.stat, current - value)

        if (adjustment.stat === 'health' && typeof gotchi.fullHealth === 'number' && Number.isFinite(gotchi.fullHealth)) {
            gotchi.fullHealth = roundStatLikeEngine('health', gotchi.fullHealth - value)
        }
    })

    return gotchis
}

const slotToGotchi = (slot, gotchiById) => {
    if (!slot || !slot.isActive) return null

    const gotchi = gotchiById.get(slot.id)
    if (!gotchi) {
        throw new Error(`Cannot rerun log: gotchi ${slot.id} is present in layout but missing from log.gotchis`)
    }

    return gotchi
}

const getStartingStateForTeam = (team, startingStateById) => {
    return [...team.formation.front, ...team.formation.back]
        .filter(Boolean)
        .map((gotchi) => {
            const stateSource = startingStateById.get(gotchi.id) || gotchi
            const richStatusInstances = Array.isArray(stateSource.statusInstances)
                ? stateSource.statusInstances.map(statusInstance => {
                    const richStatusInstance = {
                        code: statusInstance.code,
                        source: { ...statusInstance.source },
                        removable: statusInstance.removable,
                        remainingSubjectTurns: statusInstance.remainingSubjectTurns
                    }

                    if (statusInstance.potency !== undefined) richStatusInstance.potency = statusInstance.potency

                    return richStatusInstance
                })
                : null
            const state = {
                id: gotchi.id,
                health: stateSource.health,
                statuses: richStatusInstances || (Array.isArray(stateSource.statuses) ? [...stateSource.statuses] : [])
            }

            if (Object.prototype.hasOwnProperty.call(stateSource, 'specialBar')) {
                state.specialBar = stateSource.specialBar
            }

            return state
        })
}

const buildTeamsFromLog = (log, gotchis, options = {}) => {
    const gotchiById = new Map(gotchis.map(gotchi => [gotchi.id, gotchi]))
    const startingStateById = new Map((options.startingStateGotchis || []).map(gotchi => [gotchi.id, gotchi]))

    return getLayoutTeams(log).map((layoutTeam) => {
        const team = {
            formation: {
                front: layoutTeam.rows[0].slots.map(slot => slotToGotchi(slot, gotchiById)),
                back: layoutTeam.rows[1].slots.map(slot => slotToGotchi(slot, gotchiById))
            },
            leader: layoutTeam.leaderId,
            name: layoutTeam.name,
            owner: layoutTeam.owner
        }

        if (options.includeStartingState) {
            team.startingState = getStartingStateForTeam(team, startingStateById)
        }

        return team
    })
}

const getSetupStatAdjustments = (log) => {
    return log?.setup && Array.isArray(log.setup.statAdjustments) ? log.setup.statAdjustments : []
}

const createBattleInputFromLog = (log, options = {}) => {
    const mode = options.mode || 'rebased'
    if (!['prepared', 'rebased'].includes(mode)) {
        throw new Error(`Invalid rerun mode: ${mode}`)
    }

    const sourceGotchis = clone(getLogGotchis(log))
    const warnings = []
    let gotchis = clone(sourceGotchis)
    let includeStartingState = mode === 'prepared'

    const battleOptions = getBattleOptionsFromLog(log, options.options)

    if (mode === 'prepared') {
        gotchis = gotchis.map(stripStaticSetupSources)
        battleOptions.disableLeaderMechanics = true
    } else {
        const statAdjustments = getSetupStatAdjustments(log)

        if (!statAdjustments.length) {
            if (!options.allowLegacyBestEffort) {
                throw new Error('Cannot rebase log without setup.statAdjustments; old prepared stats cannot be safely converted back to base stats')
            }

            warnings.push('No setup.statAdjustments found; rebased mode is using legacy prepared stats as a best effort.')
        }

        subtractStatAdjustments(gotchis, statAdjustments)
        includeStartingState = options.preserveStartingState !== undefined
            ? Boolean(options.preserveStartingState)
            : log?.meta?.type === 'dungeon'

        if (includeStartingState) {
            gotchis.forEach((gotchi) => {
                if (typeof gotchi.fullHealth === 'number' && Number.isFinite(gotchi.fullHealth)) {
                    gotchi.health = gotchi.fullHealth
                }
            })
        }
    }

    const teams = buildTeamsFromLog(log, gotchis, {
        includeStartingState,
        startingStateGotchis: includeStartingState ? sourceGotchis : []
    })

    return {
        team1: teams[0],
        team2: teams[1],
        seed: options.seed || getLogSeed(log),
        options: battleOptions,
        warnings
    }
}

module.exports = createBattleInputFromLog
