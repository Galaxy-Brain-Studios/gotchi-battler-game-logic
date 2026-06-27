const STATUSES = require('./statuses.json')
const {
    DEFAULT_MAX_STATUSES,
    STATUS_POTENCY_MIN,
    STATUS_POTENCY_MAX
} = require('./constants')

const STATUS_BY_CODE = new Map(STATUSES.map(status => [status.code, status]))

const LEGACY_SOURCE = Object.freeze({
    kind: 'legacy',
    code: null,
    gotchiId: null
})

const cloneSource = (source = LEGACY_SOURCE) => {
    const normalizedSource = source || LEGACY_SOURCE

    return {
        kind: normalizedSource.kind,
        code: normalizedSource.code ?? null,
        gotchiId: normalizedSource.gotchiId ?? null
    }
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const normalizeStatusPotency = (potency) => {
    if (typeof potency !== 'number' || Number.isNaN(potency) || !Number.isFinite(potency)) {
        return 1
    }

    return clamp(potency, STATUS_POTENCY_MIN, STATUS_POTENCY_MAX)
}

const shouldSerializePotency = (potency) => normalizeStatusPotency(potency) !== 1

const getStatusInstancePotency = (status, instance) => {
    if (!status || status.potencyEnabled !== true) return 1
    return normalizeStatusPotency(instance?.potency)
}

const getStatusByCode = (statusCode) => {
    const status = STATUS_BY_CODE.get(statusCode)

    if (!status) {
        throw new Error(`Status with code ${statusCode} not found`)
    }

    return status
}

const projectStatuses = (gotchi) => {
    const instances = Array.isArray(gotchi.statusInstances) ? gotchi.statusInstances : []
    gotchi.statuses = instances.map(instance => instance.code)
    return gotchi.statuses
}

const normalizeInstance = (instance) => {
    if (typeof instance === 'string') {
        getStatusByCode(instance)
        return {
            code: instance,
            source: cloneSource(),
            removable: true,
            remainingSubjectTurns: null
        }
    }

    if (!instance || typeof instance !== 'object') {
        throw new Error('Status instance must be a status code string or an object')
    }

    getStatusByCode(instance.code)

    if (!instance.source || typeof instance.source !== 'object') {
        throw new Error(`Status instance ${instance.code} requires a source`)
    }

    if (typeof instance.source.kind !== 'string' || !instance.source.kind) {
        throw new Error(`Status instance ${instance.code} requires a source.kind`)
    }

    if (typeof instance.removable !== 'boolean') {
        throw new Error(`Status instance ${instance.code} requires a removable boolean`)
    }

    const duration = instance.remainingSubjectTurns
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
        throw new Error(`Status instance ${instance.code} has invalid remainingSubjectTurns`)
    }

    const normalized = {
        code: instance.code,
        source: cloneSource(instance.source),
        removable: instance.removable,
        remainingSubjectTurns: duration
    }

    const potency = normalizeStatusPotency(instance.potency)
    if (potency !== 1) normalized.potency = potency

    return normalized
}

const initializeStatusInstances = (gotchi, statuses = []) => {
    if (!Array.isArray(statuses)) {
        throw new Error(`Statuses for gotchi ${gotchi.id} must be an array`)
    }

    gotchi.statusInstances = statuses.map(normalizeInstance)
    projectStatuses(gotchi)
    return gotchi.statusInstances
}

const ensureStatusInstances = (gotchi) => {
    if (!Array.isArray(gotchi.statusInstances)) {
        initializeStatusInstances(gotchi, Array.isArray(gotchi.statuses) ? gotchi.statuses : [])
    }

    return gotchi.statusInstances
}

const getStatusInstances = (gotchi, predicate = null) => {
    const instances = ensureStatusInstances(gotchi)
    return predicate ? instances.filter(predicate) : [...instances]
}

const getStatusCodes = (gotchi) => {
    ensureStatusInstances(gotchi)
    return projectStatuses(gotchi)
}

const hasStatus = (gotchi, code) => getStatusInstances(gotchi).some(instance => instance.code === code)

const countStatus = (gotchi, code) => getStatusInstances(gotchi, instance => instance.code === code).length

const validateDurationTurns = (durationTurns) => {
    if (durationTurns === undefined || durationTurns === null) return null

    if (!Number.isInteger(durationTurns) || durationTurns <= 0) {
        throw new Error(`durationTurns must be a positive integer, received ${durationTurns}`)
    }

    return durationTurns
}

const canApplyStatus = (gotchi, { code, count = 1 }) => {
    const status = getStatusByCode(code)
    const instances = ensureStatusInstances(gotchi)

    if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`Status ${code} count must be a positive integer`)
    }

    const maxStack = status.maxStack || DEFAULT_MAX_STATUSES
    const currentStacks = instances.filter(instance => instance.code === code).length

    return currentStacks + count <= maxStack
}

const applyStatus = (gotchi, {
    code,
    count = 1,
    source = LEGACY_SOURCE,
    removable = true,
    durationTurns = null,
    potency = 1
}) => {
    const status = getStatusByCode(code)
    const instances = ensureStatusInstances(gotchi)

    if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`Status ${code} count must be a positive integer`)
    }

    if (typeof removable !== 'boolean') {
        throw new Error(`Status ${code} removable must be a boolean`)
    }

    const remainingSubjectTurns = validateDurationTurns(durationTurns)
    const maxStack = status.maxStack || DEFAULT_MAX_STATUSES
    const currentStacks = instances.filter(instance => instance.code === code).length

    // Preserve the existing all-or-nothing stack-cap behaviour.
    if (currentStacks + count > maxStack) return { applied: false, instances: [] }

    const normalizedPotency = normalizeStatusPotency(potency)
    const appliedInstances = Array.from({ length: count }, () => {
        const instance = {
            code,
            source: cloneSource(source),
            removable,
            remainingSubjectTurns
        }

        if (normalizedPotency !== 1) instance.potency = normalizedPotency

        return instance
    })

    instances.push(...appliedInstances)
    projectStatuses(gotchi)

    return { applied: true, instances: appliedInstances }
}

const removeStatusInstances = (gotchi, predicate, { force = false } = {}) => {
    const instances = ensureStatusInstances(gotchi)
    const removed = []
    const retained = []

    instances.forEach(instance => {
        if (predicate(instance) && (force || instance.removable)) {
            removed.push(instance)
        } else {
            retained.push(instance)
        }
    })

    if (removed.length) {
        gotchi.statusInstances = retained
        projectStatuses(gotchi)
    }

    return removed
}

const removeOneStatusInstance = (gotchi, statusInstance, options) => {
    const removed = removeStatusInstances(gotchi, instance => instance === statusInstance, options)
    return removed[0] || null
}

const consumeStatusInstance = (gotchi, statusInstance) => removeOneStatusInstance(
    gotchi,
    statusInstance,
    { force: true }
)

const getRemovableStatusInstances = (gotchi, isBuff) => getStatusInstances(
    gotchi,
    instance => instance.removable && getStatusByCode(instance.code).isBuff === isBuff
)

const removeRemovableStatusCode = (gotchi, code) => removeStatusInstances(
    gotchi,
    instance => instance.code === code
)

const removeRandomRemovableStatusCode = (gotchi, isBuff, rng) => {
    const candidates = getRemovableStatusInstances(gotchi, isBuff)
    if (!candidates.length) return []

    const selected = candidates[Math.floor(rng() * candidates.length)]
    return removeRemovableStatusCode(gotchi, selected.code)
}

const removeAllRemovableStatuses = (gotchi, isBuff) => removeStatusInstances(
    gotchi,
    instance => getStatusByCode(instance.code).isBuff === isBuff
)

const toStatusExpiryEvents = (gotchi, instances) => instances.map(instance => ({
    target: gotchi.id,
    status: instance.code
}))

const expireStatusDurationsAfterTurn = (gotchi, { appliedThisSubjectTurnInstances = new Set() } = {}) => {
    const expiredInstances = new Set()

    getStatusInstances(gotchi).forEach(instance => {
        if (instance.remainingSubjectTurns === null || appliedThisSubjectTurnInstances.has(instance)) return

        instance.remainingSubjectTurns -= 1
        if (instance.remainingSubjectTurns === 0) expiredInstances.add(instance)
    })

    const removals = removeStatusInstances(gotchi, instance => expiredInstances.has(instance), { force: true })
    return {
        removals,
        events: toStatusExpiryEvents(gotchi, removals)
    }
}

const getSerializableStatusInstances = (gotchi) => getStatusInstances(gotchi).map(instance => {
    const serialized = {
        code: instance.code,
        source: cloneSource(instance.source),
        removable: instance.removable,
        remainingSubjectTurns: instance.remainingSubjectTurns
    }

    if (shouldSerializePotency(instance.potency)) {
        serialized.potency = normalizeStatusPotency(instance.potency)
    }

    return serialized
})

module.exports = {
    getStatusByCode,
    clamp,
    normalizeStatusPotency,
    getStatusInstancePotency,
    initializeStatusInstances,
    getStatusInstances,
    getStatusCodes,
    hasStatus,
    countStatus,
    canApplyStatus,
    applyStatus,
    removeStatusInstances,
    removeOneStatusInstance,
    consumeStatusInstance,
    getRemovableStatusInstances,
    removeRemovableStatusCode,
    removeRandomRemovableStatusCode,
    removeAllRemovableStatuses,
    toStatusExpiryEvents,
    expireStatusDurationsAfterTurn,
    getSerializableStatusInstances
}
