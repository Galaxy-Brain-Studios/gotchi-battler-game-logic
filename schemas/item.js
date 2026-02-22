const { z } = require('zod')

const ItemSchema = z.object({
    code: z.string(),
    name: z.string(),
    description: z.string(),
    image: z.string(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythical', 'godlike']),
    stat: z.enum(['speed', 'health', 'criticalRate', 'defense', 'criticalDamage', 'resist', 'focus', 'attack']),
    statValue: z.number()
})

module.exports = { ItemSchema }
