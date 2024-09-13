const fs = require('fs')
const path = require('path')
const battle = require('..')

// Edit these json files to test different battles
// NOTE: Only the in-game stats (speed, health, crit etc..) are used in the game logic
const team1 = require('./data/team1.json')
const team2 = require('./data/team2.json')

const results = battle(team1, team2, "82807311112923564712218359337695919195403960526804010606215202651499586140469")

const timestamp = new Date().getTime()
const resultsFilename = `results-${timestamp}.json`
fs.writeFileSync(path.join(__dirname, 'output', resultsFilename), JSON.stringify(results, null, '\t'))

console.log(`Results written to ${path.join(__dirname, 'output', resultsFilename)}`)