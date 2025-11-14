const { z } = require('zod')
const { SpecialSchema } = require('./special')
const { LeaderSkillSchema } = require('./leaderskill')
const { ItemSchema } = require('./item')
const { CrystalSchema } = require('./crystal')

const GotchiSchema = z.object({
    id: z.number().int(),
    onchainId: z.number().int(),
    name: z.string(),
    type: z.enum(['gotchi', 'spirit', 'monster']),
    visualCode: z.string(),
    level: z.number().int(),
    speed: z.number().int(),
    health: z.number().int(),
    attack: z.number().int(),
    defense: z.number().int(),
    criticalRate: z.number(),
    criticalDamage: z.number(),
    resist: z.number().int(),
    focus: z.number().int(),

    // Foreign keys
    gotchiClass: z.string(),
    special: z.string(),
    leaderSkill: z.string(),
    item: z.string().nullable(),
    crystalSlot1: z.string().nullable(),
    crystalSlot2: z.string().nullable(),
    crystalSlot3: z.string().nullable(),
    crystalSlot4: z.string().nullable(),
    crystalSlot5: z.string().nullable(),
    crystalSlot6: z.string().nullable(),

    // Expanded
    specialExpanded: SpecialSchema,
    leaderSkillExpanded: LeaderSkillSchema,
    itemExpanded: ItemSchema.optional(),
    crystalSlot1Expanded: CrystalSchema.optional(),
    crystalSlot2Expanded: CrystalSchema.optional(),
    crystalSlot3Expanded: CrystalSchema.optional(),
    crystalSlot4Expanded: CrystalSchema.optional(),
    crystalSlot5Expanded: CrystalSchema.optional(),
    crystalSlot6Expanded: CrystalSchema.optional(),

    // Timestamps
    createdAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
})

module.exports = { GotchiSchema }


