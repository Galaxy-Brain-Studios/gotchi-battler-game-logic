const { z } = require('zod')

const CrystalSchema = z.object({
    code: z.string(),
    name: z.string(),
    slot: z.number().int().min(1).max(6),
    rarity: z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythical', 'godlike']),
    stat: z.enum(['speed', 'health', 'criticalRate', 'defense', 'criticalDamage', 'resist', 'focus', 'attack']),
    statValue: z.number()
})

module.exports = { CrystalSchema }


