// Export the gameLoop function for the current version of the game logic
const versions = require('./game-logic')

const currentVersion = versions[versions.current]

module.exports = currentVersion.gameLoop