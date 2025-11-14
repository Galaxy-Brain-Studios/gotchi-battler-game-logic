const { z } = require('zod')

const EffectTypeEnum = z.enum([
    'status',
    'heal',
    'remove_buff',
    'remove_debuff',
    'remove_all_buffs',
    'remove_all_debuffs',
    'repeat_attack'
])

const EffectSchema = z.object({
    id: z.number().int().optional(),
    effectType: EffectTypeEnum,
    value: z.number().nullable(),
    chance: z.number().min(0).max(1).default(1.0),
    special: z.string().nullable(),
    target: z.string().nullable(),
    status: z.string().nullable()
})

module.exports = { EffectSchema, EffectTypeEnum }


