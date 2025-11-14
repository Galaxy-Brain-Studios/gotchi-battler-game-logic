const fs = require('fs')
const path = require('path')
const { battle } = require('..')

const campaignName = 'mount_oomf'

// Loop through each json file in /data/campaign/ (ignore the results folder)
const campaignDir = path.join(__dirname, 'data', 'campaign', campaignName)
const files = fs.readdirSync(campaignDir)

for (const file of files) {
    if (file.endsWith('.json')) {
        const team1 = require('./data/oggyMaxi.json')
        const team2 = require(path.join(campaignDir, file))

        const results = battle(team1, team2, 'randomseed', { 
            debug: false,
            type: 'pve',
            campaign: {
                biome: file.split('_s')[0],
                stage: file.split('_b')[0],
                battle: file.replace('.json', '')
            },
            isBoss: file.includes('b6') 
        })

        // Write output to data/campaign/yield_fields/results/
        fs.writeFileSync(path.join(campaignDir, 'results', file.replace('.json', '-results.json')), JSON.stringify(results, null, '\t'))
    }
}

// node scripts/runCampaignBattles.js