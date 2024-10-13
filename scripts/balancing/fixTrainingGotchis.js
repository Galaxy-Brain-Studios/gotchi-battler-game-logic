const fs = require('fs')
const trainingGotchis = require('./v1.6/training_gotchis.json')

const specials = [
    {
        "id": 1,
        "class": "Ninja",
        "name": "Spectral strike",
        "cooldown": 0,
        "leaderPassive": "Sharpen blades"
    },
    {
        "id": 2,
        "class": "Enlightened",
        "name": "Meditate",
        "cooldown": 0,
        "leaderPassive": "Cloud of Zen"
    },
    {
        "id": 3,
        "class": "Cleaver",
        "name": "Cleave",
        "cooldown": 2,
        "leaderPassive": "Frenzy"
    },
    {
        "id": 4,
        "class": "Tank",
        "name": "Taunt",
        "cooldown": 0,
        "leaderPassive": "Fortify"
    },
    {
        "id": 5,
        "class": "Cursed",
        "name": "Curse",
        "cooldown": 0,
        "leaderPassive": "Spread the fear"
    },
    {
        "id": 6,
        "class": "Healer",
        "name": "Blessing",
        "cooldown": 0,
        "leaderPassive": "Cleansing Aura"
    },
    {
        "id": 7,
        "class": "Mage",
        "name": "Thunder",
        "cooldown": 2,
        "leaderPassive": "Channel the coven"
    },
    {
        "id": 8,
        "class": "Troll",
        "name": "Devestating Smash",
        "cooldown": 2,
        "leaderPassive": "Clan momentum"
    }
]

const classes = ['Ninja','Enlightened','Cleaver','Tank','Cursed','Healer', 'Mage', 'Troll']
const powerLevels = ['Godlike', 'Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common', 'Garbage']

// This is copied/hacked from the mapGotchi function in the backend
const fixTraits = (gotchi) => {
    const traitMaps = {
        speed: {
            baseFormula: 100,
            multiplier: 1,
            traitKey: 0,
            isNegative: false
        },
        health: {
            baseFormula: 'brs*0.75',
            multiplier: 12,
            traitKey: 0,
            isNegative: true
        },
        crit: {
            baseFormula: 0,
            multiplier: 0.5,
            traitKey: 1,
            isNegative: false
        },
        armor: {
            baseFormula: 0,
            multiplier: 2,
            traitKey: 1,
            isNegative: true
        },
        evade: {
            baseFormula: 0,
            multiplier: 0.3,
            traitKey: 2,
            isNegative: false
        },
        resist: {
            baseFormula: 0,
            multiplier: 1,
            traitKey: 2,
            isNegative: true
        },
        magic: {
            baseFormula: 'brs*0.25',
            multiplier: 5,
            traitKey: 3,
            isNegative: false
        },
        physical: {
            baseFormula: 'brs*0.25',
            multiplier: 5,
            traitKey: 3,
            isNegative: true
        },
        accuracy: {
            baseFormula: 50,
            multiplier: 0.5,
            traitKey: 45,
            isNegative: false
        }
    }

    const traitValue = (trait) => {
        return trait < 50 ? 50 - trait : trait - 50 + 1
    }

    const onchainVals = [
        gotchi.nrg,
        gotchi.agg,
        gotchi.spk,
        gotchi.brn,
        gotchi.eyc,
        gotchi.eys
    ]
    // Convert trait value to in-game value
    const traitValues = onchainVals.map(x => { return traitValue(x) })

    // Map traits
    for(const trait in traitMaps) { 
        const traitMap = traitMaps[trait]
        const onchainVal = onchainVals[traitMap.traitKey]

        let base = traitMap.baseFormula

        // If baseFormula is a string and contains a * then it is a formula
        if (typeof traitMap.baseFormula === 'string' && traitMap.baseFormula.includes('*')) {
            const formula = traitMap.baseFormula.split('*')

            if (!gotchi[formula[0]]) throw new Error('Trait not found: ', formula[0])

            base = Math.round(Number(gotchi[formula[0]]) * Number(formula[1]))
        }

        let newTrait
        if (trait !== 'accuracy') {
            if (traitMap.isNegative) {
                newTrait = onchainVal < 50 ? Math.round(base + (traitValues[traitMap.traitKey] * traitMap.multiplier)) : base
            } else {
                newTrait = onchainVal < 50 ? base : Math.round(base + (traitValues[traitMap.traitKey] * traitMap.multiplier))
            }
        } else {
            newTrait = base + ((traitValues[4] + traitValues[5]) * traitMap.multiplier)
        }

        if (newTrait !== gotchi[trait]) gotchi[trait] = newTrait
    }
}

const addAvgGotchs = () => {
    const statsToOverwrite = ["speed", "health", "crit", "armor", "evade", "resist", "magic", "physical", "accuracy"]

    const avgGotchis = []

    powerLevels.forEach((powerLevel) => {
        classes.forEach((className) => {
            // Find all gotchis with the same class and power level
            // Names are in the format "Godlike ++++ Ninja"
            const gotchis = trainingGotchis.filter(gotchi => gotchi.name.includes(powerLevel) && gotchi.name.includes(className))

            // Copy over one of the gotchis
            const avgGotchi = JSON.parse(JSON.stringify(gotchis[0]))

            // Add an id
            avgGotchi.id = trainingGotchis.length + avgGotchis.length + 1

            // Overwrite the name
            avgGotchi.name = `${powerLevel} avg ${className}`

            // Overwrite the stats
            statsToOverwrite.forEach((stat) => {
                const total = gotchis.reduce((acc, gotchi) => acc + gotchi[stat], 0)
                avgGotchi[stat] = Math.round(total / gotchis.length)
            })

            avgGotchis.push(avgGotchi)
        })
    })

    trainingGotchis.push(...avgGotchis)
}

// Sort the gotchis by id
trainingGotchis.sort((a, b) => a.id - b.id)

trainingGotchis.forEach(gotchi => {
    // Add special to gotchi
    const special = specials.find(special => special.id === gotchi.specialId)

    if (!special) throw new Error(`Special not found for gotchi: "${gotchi.name}"`)

    gotchi.special = special

    // Fix names
    // If name ends with a + or - then add the class name at the end
    if (gotchi.name.endsWith('+') || gotchi.name.endsWith('-')) {
        gotchi.name = `${gotchi.name} ${classes[gotchi.specialId - 1]}`
    }

    // Remove extra fields
    delete gotchi.tier
    delete gotchi.class
    delete gotchi.stats_brs

    // Make sure the gotchi has the correct traits
    fixTraits(gotchi)
})

// Add the average gotchis
addAvgGotchs()

// Write the updated trainingGotchis to a new file
fs.writeFileSync('./training_gotchis1.json', JSON.stringify(trainingGotchis, null, '\t'))

// node scripts/balancing/fixTrainingGotchis.js