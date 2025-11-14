const { z } = require('zod')

const LeaderSkillStatusSchema = z.object({
    stackCount: z.number().int().min(1).default(1),
    leaderSkill: z.string(),
    status: z.string(),
    leaderSkillExpanded: z.object({}).optional()
})

module.exports = { LeaderSkillStatusSchema }


