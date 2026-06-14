// Export the gameLoop function for the current version of the game logic
const { gameLoop } = require('./game-logic')
const createBattleInputFromLog = require('./game-logic/replay')

const teamSchema = require('./schemas/team')
const { webappTeamToInGameTeam, inGameTeamToWebappTeam } = require('./utils/transforms')

module.exports = {
    battle: gameLoop,
    createBattleInputFromLog,
    teamSchema,
    webappTeamToInGameTeam,
    inGameTeamToWebappTeam
}
