const { z } = require('zod')
const { LeaderSkillStatusSchema } = require('./leaderskillstatus')

const LeaderSkillSchema = z.object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    monstersOnly: z.boolean().default(false),
    gotchiClass: z.string(),
    statuses: z.array(LeaderSkillStatusSchema).optional(),
})

module.exports = { LeaderSkillSchema }


