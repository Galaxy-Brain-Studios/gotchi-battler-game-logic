const { z } = require('zod')
const { GotchiSchema } = require('./gotchi')

const InGameTeamSchema = z.object({
    name: z.string(),
    owner: z.string(),
    formation: z.object({
        front: z.array(GotchiSchema.nullable()).min(5).max(5),
        back: z.array(GotchiSchema.nullable()).min(5).max(5)
    }),
    leader: z.number().int()
})

module.exports = { InGameTeamSchema }