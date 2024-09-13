const { ValidationError } = require('./errors')

const compareLogs = (originalLogs, newLogs) => {
    // Check winner, loser and numOfTurns properties
    if (originalLogs.result.winner !== newLogs.result.winner) {
        throw new ValidationError(`Winner mismatch: ${originalLogs.result.winner} !== ${newLogs.result.winner}`, originalLogs, newLogs)
    }

    if (originalLogs.result.loser !== newLogs.result.loser) {
        throw new ValidationError(`Loser mismatch: ${originalLogs.result.loser} !== ${newLogs.result.loser}`, originalLogs, newLogs)
    }

    if (originalLogs.result.numOfTurns !== newLogs.result.numOfTurns) {
        throw new ValidationError(`numOfTurns mismatch: ${originalLogs.result.numOfTurns} !== ${newLogs.result.numOfTurns}`, originalLogs, newLogs)
    }

    // Validate winningTeam array
    originalLogs.result.winningTeam.forEach((gotchi) => {
        // Check id, name and health properties
        const gotchi2 = newLogs.result.winningTeam.find((gotchi2) => gotchi2.id === gotchi.id)

        if (!gotchi2) {
            throw new ValidationError(`Gotchi not found in winningTeam: ${gotchi.id}`, originalLogs, newLogs)
        }

        if (gotchi.name !== gotchi2.name) {
            throw new ValidationError(`Gotchi name mismatch: ${gotchi.name} !== ${gotchi2.name}`, originalLogs, newLogs)
        }

        if (gotchi.health !== gotchi2.health) {
            throw new ValidationError(`Gotchi health mismatch: ${gotchi.health} !== ${gotchi2.health}`, originalLogs, newLogs)
        }
    })

    return true
}

module.exports = {
    compareLogs
}