const { z } = require('zod')
const { GotchiSchema } = require('./gotchi')
const { StatusInstanceSchema } = require('./statusinstance')

const StartingStateStatusesSchema = z.union([
    z.array(z.string()),
    z.array(StatusInstanceSchema)
])

const StartingStateSchema = z.object({
    id: z.number().int(),
    health: z.number(),
    // Old callers may still provide status-code strings. Rich instances are the v3 carry-state contract.
    statuses: StartingStateStatusesSchema.default([]),
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

module.exports = { InGameTeamSchema, StartingStateSchema }
