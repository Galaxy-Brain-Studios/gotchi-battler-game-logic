const fs = require('fs')
const trainingGotchis = require('./v1.7/training_gotchis.json')

const onchainTraitNames = [
    'nrg',
    'agg',
    'spk',
    'brn',
    'eys',
    'eyc'
]

const main = () => {
    const onchainTraits = {}
    
    // Loop through all training gotchis ids 1-448 and extract the onchain traits
    for (let i = 1; i < 449; i++) {
        const gotchi = trainingGotchis[i]

        const powerLevel = gotchi.name.split(' ')[0].toLowerCase()
        const gotchiClass = gotchi.name.split(' ')[2].toLowerCase()

        if (!onchainTraits[powerLevel]) {
            onchainTraits[powerLevel] = {}
        }

        if (!onchainTraits[powerLevel][gotchiClass]) {
            onchainTraits[powerLevel][gotchiClass] = {}
        }

        if (!onchainTraits[powerLevel][gotchiClass].brs) {
            onchainTraits[powerLevel][gotchiClass].brs = gotchi.brs
        }

        onchainTraitNames.forEach((trait) => {
            if (!onchainTraits[powerLevel][gotchiClass][trait]) {
                onchainTraits[powerLevel][gotchiClass][trait] = []
            }

            if (gotchi[trait] < 50) {
                if (!onchainTraits[powerLevel][gotchiClass][trait][0]) {
                    onchainTraits[powerLevel][gotchiClass][trait][0] = gotchi[trait]
                }
            } else {
                if (!onchainTraits[powerLevel][gotchiClass][trait][1]) {
                    onchainTraits[powerLevel][gotchiClass][trait][1] = gotchi[trait]
                }
            }
        })
    }

    fs.writeFileSync('./training_gotchis_traits.json', JSON.stringify(onchainTraits, (key, value) => {
        if (Array.isArray(value)) {
          return JSON.stringify(value); // Convert array to a string
        }
        return value;
      }, 2).replace(/"\[(.*?)\]"/g, "[$1]"))
}

// node scripts/balancing/extractOnchainTraits.js
main()
