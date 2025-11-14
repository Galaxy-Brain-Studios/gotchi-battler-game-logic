const { z } = require('zod')
const { GotchiSchema } = require('./gotchi')

const TeamSchema = z.object({
    id: z.number().int().optional(),
    name: z.string(),
    leader: z.enum(['front1','front2','front3','front4','front5','back1','back2','back3','back4','back5']),

    // Gotchis
    front1Gotchi: GotchiSchema.nullable(),
    front2Gotchi: GotchiSchema.nullable(),
    front3Gotchi: GotchiSchema.nullable(),
    front4Gotchi: GotchiSchema.nullable(),
    front5Gotchi: GotchiSchema.nullable(),
    back1Gotchi: GotchiSchema.nullable(),
    back2Gotchi: GotchiSchema.nullable(),
    back3Gotchi: GotchiSchema.nullable(),
    back4Gotchi: GotchiSchema.nullable(),
    back5Gotchi: GotchiSchema.nullable()
})

module.exports = { TeamSchema }


