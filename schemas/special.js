const { z } = require('zod')
const { EffectSchema } = require('./effect')

const ActionTypeEnum = z.enum(['attack', 'heal', 'none'])

const SpecialSchema = z.object({
    code: z.string(),
    name: z.string(),
    initialCooldown: z.number().int(),
    cooldown: z.number().int(),
    actionType: ActionTypeEnum.default('none'),
    actionMultiplier: z.number().nullable(),
    monstersOnly: z.boolean().default(false),
    notes: z.string().optional(),
    gotchiClass: z.string().nullable(),
    target: z.string().nullable(),
    effects: z.array(EffectSchema).optional(),
})

module.exports = { SpecialSchema, ActionTypeEnum }


