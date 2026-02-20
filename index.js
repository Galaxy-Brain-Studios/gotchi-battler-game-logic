// Export the gameLoop function for the current version of the game logic
const { gameLoop } = require('./game-logic')

const teamSchema = require('./schemas/team')
const { webappTeamToInGameTeam, inGameTeamToWebappTeam } = require('./utils/transforms')

module.exports = {
    battle: gameLoop,
    teamSchema,
    webappTeamToInGameTeam,
    inGameTeamToWebappTeam
}