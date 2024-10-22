// Export the gameLoop function for the current version of the game logic
const versions = require('./game-logic')
const currentVersion = versions[versions.current]

const teamSchema = require('./schemas/team')
const { webappTeamToInGameTeam, inGameTeamToWebappTeam } = require('./utils/transforms')

module.exports = {
    game: currentVersion.gameLoop,
    teamSchema,
    webappTeamToInGameTeam,
    inGameTeamToWebappTeam
}