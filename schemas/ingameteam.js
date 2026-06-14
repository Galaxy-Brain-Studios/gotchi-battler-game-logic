const { z } = require('zod')
const { GotchiSchema } = require('./gotchi')

const StartingStateSchema = z.object({
    id: z.number().int(),
    health: z.number(),
    statuses: z.array(z.string()).default([]),
    specialBar: z.number().optional()
})

const InGameTeamSchema = z.object({
    name: z.string(),
    owner: z.string(),
    formation: z.object({
        front: z.array(GotchiSchema.nullable()).min(5).max(5),
        back: z.array(GotchiSchema.nullable()).min(5).max(5)
    }),
    leader: z.number().int(),
    startingState: z.array(StartingStateSchema).optional()
})

module.exports = { InGameTeamSchema }
