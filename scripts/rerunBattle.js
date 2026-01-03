const fs = require('fs')
const path = require('path')

const { battle } = require('..')

const main = async () => {
    console.time('Rerun battle')
    const logs = require('./data/battleTimeout_k71899.json')
    const result = await battle(logs.teamA, logs.teamB, logs.meta.seed, { debug: true })

    fs.writeFileSync(path.join(__dirname, 'output', `${logs.meta.timestamp}-${Date.now()}.json`), JSON.stringify(result, null, 4))
    console.timeEnd('Rerun battle')
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