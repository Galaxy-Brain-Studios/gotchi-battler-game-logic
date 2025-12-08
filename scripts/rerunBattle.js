const fs = require('fs')
const path = require('path')

const { logToInGameTeams } = require('../utils/transforms')
const { battle } = require('..')

const main = async () => {
    const logs = require('./data/yield_fields_1_2.json')
    const teams = logToInGameTeams(logs)
    const result = await battle(teams[0], teams[1], logs.meta.seed)
    
    fs.writeFileSync(path.join(__dirname, 'output', `${logs.meta.timestamp}-${Date.now()}.json`), JSON.stringify(result, null, '\t'))
}

// node scripts/rerunBattle.js
main()
    .then(() => {
        console.log('Battle rerun successfully')
        process.exit(0)
    })
    .catch((error) => {
        console.error('Error rerunning battle: ', error)
        process.exit(1)
    })