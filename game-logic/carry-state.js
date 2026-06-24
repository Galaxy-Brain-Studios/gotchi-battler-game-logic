const { StatusInstanceSchema } = require('../schemas/statusinstance')

const buildStartingStateFromWinningTeam = (winningTeam) => {
    if (!Array.isArray(winningTeam)) {
        throw new Error('buildStartingStateFromLog requires result.winningTeam from a v5 battle log')
    }

    return winningTeam.map((gotchi) => {
        if (!gotchi || typeof gotchi !== 'object' || !Array.isArray(gotchi.statusInstances)) {
            throw new Error('buildStartingStateFromLog requires v5 statusInstances for every winning Gotchi')
        }

        const statuses = gotchi.statusInstances.map((instance, index) => {
            const parsed = StatusInstanceSchema.safeParse(instance)
            if (!parsed.success) {
                throw new Error(`buildStartingStateFromLog found an invalid statusInstance at index ${index} for gotchi ${gotchi.id}`)
            }

            return {
                code: parsed.data.code,
                source: { ...parsed.data.source },
                removable: parsed.data.removable,
                remainingSubjectTurns: parsed.data.remainingSubjectTurns
            }
        })

        return {
            id: gotchi.id,
            health: gotchi.health,
            statuses,
            specialBar: Number.isFinite(Number(gotchi.specialBar)) ? Number(gotchi.specialBar) : 0
        }
    })
}

const buildStartingStateFromLog = (logs) => buildStartingStateFromWinningTeam(logs?.result?.winningTeam)

module.exports = { buildStartingStateFromLog }
