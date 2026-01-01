const { z } = require('zod')

const ItemSchema = z.object({
    code: z.string(),
    name: z.string(),
    description: z.string(),
    image: z.string(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'legendary', 'mythical', 'godlike']),
    stat: z.enum(['speed', 'health', 'attack', 'defense', 'criticalRate', 'criticalDamage', 'resist', 'focus']),
    statValue: z.number()
})

module.exports = { ItemSchema }
