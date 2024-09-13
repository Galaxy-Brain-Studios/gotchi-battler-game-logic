class GameError extends Error {
	constructor(msg, logs) {
        super(msg)
        this.name = 'GameError'

		if(logs) {
			this.logs = logs
		}
	}
}

class ValidationError extends Error {
	constructor(msg, originalLogs, newLogs) {
        super(msg)
        this.name = 'ValidationError'

		if(originalLogs) {
			this.originalLogs = originalLogs
		}

		if(newLogs) {
			this.newLogs = newLogs
		}
	}
}

module.exports = {
    GameError,
    ValidationError
}