const fs = require('fs')
const path = require('path')
const { battle } = require('..')

const campaigns = [
    'yield_fields',
    'daark_forest',
    'caaverns',
    'defi_desert',
    'laughing_peaks',
    'mount_oomf'
]

const team1 = require('./data/immaterialTeam1.json')

for (const campaign of campaigns) {
    const campaignDir = path.join(__dirname, 'data', 'campaign', campaign)
    const files = fs.readdirSync(campaignDir).filter(file => file.endsWith('.json'))

    for (const file of files) {
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

        const resultsDir = path.join(__dirname, 'output', 'campaign', campaign)

        // Write output to /scripts/output/campaign/<campaign>/<file>-results.json
        fs.writeFileSync(path.join(resultsDir, file.replace('.json', '-results.json')), JSON.stringify(results, null, '\t'))
    }
}

// node scripts/runCampaignBattles.js