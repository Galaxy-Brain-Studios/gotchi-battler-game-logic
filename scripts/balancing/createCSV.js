require('dotenv').config()
const { writeFile } = require('node:fs/promises')
const path = require('node:path')

const { Storage } = require('@google-cloud/storage')
const storage = new Storage()
// Use key file locally
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../../keyfile.json')

const jsoncsv = require('json-csv')

// Generate csv files for a Google Cloud run job
const main = async () => {
    if (!process.argv[2]) {
        throw new Error('Execution ID required')
    }
    const executionId = process.argv[2]
    // const numOfTasks = 2640
    const numOfTasks = 9720

    const results = []

    // Download all the files in batches of 100
    for (let i = 0; i < numOfTasks; i += 100) {
        const batch = []

        for (let j = 0; j < 100; j++) {
            if (i + j < numOfTasks) {
                batch.push(storage.bucket(process.env.SIMS_BUCKET).file(`${executionId}_${i + j}.json`).download())
            }
        }

        const batchResults = await Promise.all(batch)
        results.push(...batchResults)

        console.log(`Downloaded ${i + batchResults.length} files`)
    }

    const combinedResults = []

    for (const result of results) {
        combinedResults.push(JSON.parse(result.toString()))
    }

    const fields = [
        {
            name: 'id',
            label: 'id'
        },
        {
            name: 'slot1',
            label: 'slot1'
        },
        {
            name: 'slot2',
            label: 'slot2'
        },
        {
            name: 'slot3',
            label: 'slot3'
        },
        {
            name: 'slot4',
            label: 'slot4'
        },
        {
            name: 'slot5',
            label: 'slot5'
        },
        {
            name: 'wins',
            label: 'wins'
        },
        {
            name: 'draws',
            label: 'draws'
        },
        {
            name: 'losses',
            label: 'losses'
        }
    ]

    // Check which powerLevels are present
    const powerLevels = ['Godlike', 'Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common', 'Garbage']
    for (const powerLevel of powerLevels) {
        if (combinedResults[0][`wins${powerLevel}`]) {
            fields.push({
                name: `wins${powerLevel}`,
                label: `wins${powerLevel}`
            })
            fields.push({
                name: `draws${powerLevel}`,
                label: `draws${powerLevel}`
            })
            fields.push({
                name: `losses${powerLevel}`,
                label: `losses${powerLevel}`
            })
        }
    }

    const csv = await jsoncsv.buffered(combinedResults, {
        fields
    })

    await writeFile(path.join(__dirname, `/output/${executionId}.csv`), csv)
    console.log(`Wrote ${executionId}.csv`)
}

module.exports = main

if (require.main === module) {
    // node scripts/balancing/createCSV.js balancing-sims-fgpsl

    main()
        .then(() => {
            console.log('Done')
            process.exit(0)
        })
        .catch((err) => {
            console.error(err)
            process.exit(1)
        })
}

