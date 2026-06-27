const { z } = require('zod')
const { normalizeStatusPotency } = require('../game-logic/status-store')

const StatusSourceKindEnum = z.enum([
    'leader_skill',
    'special',
    'auto_attack',
    'item',
    'crystal',
    'environment',
    'system',
    'legacy'
])

const StatusSourceSchema = z.object({
    kind: StatusSourceKindEnum,
    code: z.string().nullable(),
    gotchiId: z.number().int().nullable()
})

const StatusInstanceBaseSchema = z.object({
    code: z.string().min(1),
    source: StatusSourceSchema,
    removable: z.boolean(),
    remainingSubjectTurns: z.number().int().positive().nullable(),
    potency: z.any().optional()
})

const StatusInstanceSchema = StatusInstanceBaseSchema.transform(instance => {
    const normalized = {
        code: instance.code,
        source: instance.source,
        removable: instance.removable,
        remainingSubjectTurns: instance.remainingSubjectTurns
    }

    const potency = normalizeStatusPotency(instance.potency)
    if (potency !== 1) normalized.potency = potency

    return normalized
})

module.exports = {
    StatusSourceKindEnum,
    StatusSourceSchema,
    StatusInstanceSchema
}
