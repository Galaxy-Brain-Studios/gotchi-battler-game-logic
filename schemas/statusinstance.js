const { z } = require('zod')

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

const StatusInstanceSchema = z.object({
    code: z.string().min(1),
    source: StatusSourceSchema,
    removable: z.boolean(),
    remainingSubjectTurns: z.number().int().positive().nullable()
})

module.exports = {
    StatusSourceKindEnum,
    StatusSourceSchema,
    StatusInstanceSchema
}
