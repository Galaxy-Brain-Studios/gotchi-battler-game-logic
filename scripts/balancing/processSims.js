require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { Storage } = require('@google-cloud/storage')
const storage = new Storage()

if (!process.env.CLOUD_RUN_JOB) {
    // Use key file locally
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, '../../keyfile.json')
}

const downloadAndCombineResults = async (executionId, numOfTasks) => {
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

    return combinedResults
}

const classes = ['Ninja','Enlightened','Cleaver','Tank','Cursed','Healer', 'Mage', 'Troll']

const calculateKpis = (data) => {
    // Extract wins values
    const wins = data.map(item => item.wins);

    // Calculate the mean of wins
    const winsMean = wins.reduce((sum, value) => sum + value, 0) / wins.length;

    // Calculate the wins per slot
    const winsPerSlot = winsMean / 5

    // Calculate the standard deviation of wins
    const winsVariance = wins.reduce((sum, value) => sum + Math.pow(value - winsMean, 2), 0) / (wins.length - 1);
    const winsStdev = Math.sqrt(winsVariance)

    // Calculate Interquartile Range (IQR)
    wins.sort((a, b) => a - b)
    const q1 = wins[Math.floor(wins.length / 4)]
    const q3 = wins[Math.floor(wins.length * 3 / 4)]
    const iqr = q3 - q1

    // Analyse top and bottom quartiles
    const topQuartile = data.filter(item => item.wins >= q3)
    const bottomQuartile = data.filter(item => item.wins <= q1)
    const topQuartileWins = topQuartile.map(item => item.wins)
    const bottomQuartileWins = bottomQuartile.map(item => item.wins)
    const topQuartileWinsMean = topQuartileWins.reduce((sum, value) => sum + value, 0) / topQuartileWins.length
    const bottomQuartileWinsMean = bottomQuartileWins.reduce((sum, value) => sum + value, 0) / bottomQuartileWins.length

    // Non leader global KPIs
     

    const results = {
        winsMean: winsMean.toFixed(2),
        winsPerSlot: winsPerSlot.toFixed(2),
        winsStdev: winsStdev.toFixed(2),
        iqr: iqr.toFixed(2),
        topQuartileWinsMean: topQuartileWinsMean.toFixed(2),
        bottomQuartileWinsMean: bottomQuartileWinsMean.toFixed(2),
        classes: {}
    }

    
    classes.forEach((className, i) => {
        /**
         * Get leader KPIs
         * Leaders are in slot 1
         */

        // Names are in format "G|avg|1_B" 
        // G is power level, avg is trait combo, 1 is class number, B is formation position
        const leaderWins = data.filter(item => item.slot1.includes(`${i + 1}`)).map(item => item.wins)

        const leaderWinsMean = leaderWins.reduce((sum, value) => sum + value, 0) / leaderWins.length;
        const leaderWinsVariance = leaderWins.reduce((sum, value) => sum + Math.pow(value - leaderWinsMean, 2), 0) / (leaderWins.length - 1);
        const leaderWinsStdev = Math.sqrt(leaderWinsVariance)

        // Calculate Interquartile Range (IQR)
        leaderWins.sort((a, b) => a - b)
        const leaderQ1 = leaderWins[Math.floor(leaderWins.length / 4)]
        const leaderQ3 = leaderWins[Math.floor(leaderWins.length * 3 / 4)]
        const leaderIqr = leaderQ3 - leaderQ1

        // Analyse top and bottom quartiles
        const leaderTopQuartile = data.filter(item => item.slot1.includes(`${i + 1}`) && item.wins >= leaderQ3)
        const leaderBottomQuartile = data.filter(item => item.slot1.includes(`${i + 1}`) && item.wins <= leaderQ1)
        const leaderTopQuartileWins = leaderTopQuartile.map(item => item.wins)
        const leaderBottomQuartileWins = leaderBottomQuartile.map(item => item.wins)
        const leaderTopQuartileWinsMean = leaderTopQuartileWins.reduce((sum, value) => sum + value, 0) / leaderTopQuartileWins.length
        const leaderBottomQuartileWinsMean = leaderBottomQuartileWins.reduce((sum, value) => sum + value, 0) / leaderBottomQuartileWins.length

        /**
         * Get non-leader KPIs
         * Non leaders are in slots 2, 3, 4, 5 
         */

        // Get the teams where the class is in the non-leader slots
        const nonLeaderTeams = data.filter(item => item.slot2.includes(`${i + 1}`) || item.slot3.includes(`${i + 1}`) || item.slot4.includes(`${i + 1}`) || item.slot5.includes(`${i + 1}`))

        const totalNonLeaderWins = nonLeaderTeams.reduce((sum, item) => {
            const team = [item.slot2, item.slot3, item.slot4, item.slot5]
            const occurrences = team.filter(slot => slot.includes(`${i + 1}`)).length
            return sum + item.wins / 5 * occurrences
        }, 0)

        // Get total non-leader occurrences
        const totalOccurrences = nonLeaderTeams.reduce((sum, item) => {
            const team = [item.slot2, item.slot3, item.slot4, item.slot5]
            return sum + team.filter(slot => slot.includes(`${i + 1}`)).length
        }, 0)

        // Calulate win per non-leader occurance
        const winsPerOccurance = totalNonLeaderWins / totalOccurrences


        results.classes[className] = {
            leader: {
                winsMean: leaderWinsMean.toFixed(2),
                winsMeanVsGlobal: (leaderWinsMean - winsMean).toFixed(2),
                winsMeanVsGlobalPercentage: ((leaderWinsMean - winsMean) / winsMean * 100).toFixed(2),
                winsStdev: leaderWinsStdev.toFixed(2),
                winsStdevVsGlobal: (leaderWinsStdev - winsStdev).toFixed(2),
                winsStdevVsGlobalPercentage: ((leaderWinsStdev - winsStdev) / winsStdev * 100).toFixed(2),
                iqr: leaderIqr.toFixed(2),
                iqrVsGlobal: (leaderIqr - iqr).toFixed(2),
                iqrVsGlobalPercentage: ((leaderIqr - iqr) / iqr * 100).toFixed(2),
                topQuartileWinsMean: leaderTopQuartileWinsMean.toFixed(2),
                topQuartileWinsMeanVsGlobal: (leaderTopQuartileWinsMean - topQuartileWinsMean).toFixed(2),
                topQuartileWinsMeanVsGlobalPercentage: ((leaderTopQuartileWinsMean - topQuartileWinsMean) / topQuartileWinsMean * 100).toFixed(2),
                bottomQuartileWinsMean: leaderBottomQuartileWinsMean.toFixed(2),
                bottomQuartileWinsMeanVsGlobal: (leaderBottomQuartileWinsMean - bottomQuartileWinsMean).toFixed(2),
                bottomQuartileWinsMeanVsGlobalPercentage: ((leaderBottomQuartileWinsMean - bottomQuartileWinsMean) / bottomQuartileWinsMean * 100).toFixed(2)
            },
            nonLeader: {
                winsPerOccurance: winsPerOccurance.toFixed(2),
                winsPerOccuranceVsGlobal: (winsPerOccurance - winsPerSlot).toFixed(2),
                winsPerOccuranceVsGlobalPercentage: ((winsPerOccurance - winsPerSlot) / winsPerSlot * 100).toFixed(2)
            }
        }
    })

    return results
}

const main = async (executionId, numOfTasks) => {
    const data = await downloadAndCombineResults(executionId, numOfTasks)

    const availablePowerLevels = {
        'G': 'Godlike',
        'M': 'Mythical',
        'L': 'Legendary',
        'R': 'Rare',
        'U': 'Uncommon',
        'C': 'Common'
    }

    // Find power levels from data
    // slot1 is in the format "G|avg|1_B" where the first character is the power level
    // Find the unique first characters in slot1
    const powerLevels = Array.from(new Set(data.map(item => item.slot1[0])))

    // Calculate KPIs for each power level
    const results = {}
    powerLevels.forEach((powerLevel) => {
        const powerLevelData = data.filter(item => item.slot1[0] === powerLevel)
        results[availablePowerLevels[powerLevel]] = calculateKpis(powerLevelData)
    })

    if(process.env.CLOUD_RUN_JOB) {
        const bucket = storage.bucket('gotchi-battler-sims-v1-7')
        
        // Get number of files in the bucket
        const [files] = await bucket.getFiles()
        const numOfFiles = files.length

        // Write the results to a file
        await bucket.file(`${numOfFiles + 1}.json`).save(JSON.stringify(results, null, 2))
    } else {
        // Write to /scripts/balancing/output/<executionId>.json
        fs.writeFileSync(path.join(__dirname, '/output/', `${executionId}.json`), JSON.stringify(results, null, 2))
    }
}

module.exports = main

// node scripts/balancing/processSims.js avg-sims-46x8b 2640
if (require.main === module) {
    const executionId = process.env.EXECUTION_ID || process.argv[2]
    const numOfTasks = process.env.NUM_OF_TASKS || process.argv[3]

    main(executionId, numOfTasks)
        .then(() => {
            console.log('Done')
            process.exit(0)
        })
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}