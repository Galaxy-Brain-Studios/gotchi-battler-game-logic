const fs = require('fs')
const trainingGotchis = require('./v1.7.2/training_gotchis.json')
const { mapGotchi } = require('../../utils/mapGotchi')

const specials = [
    {
        'id': 1,
        'class': 'Ninja',
        'name': 'Spectral strike',
        'cooldown': 0,
        'leaderPassive': 'Sharpen blades'
    },
    {
        'id': 2,
        'class': 'Enlightened',
        'name': 'Meditate',
        'cooldown': 0,
        'leaderPassive': 'Cloud of Zen'
    },
    {
        'id': 3,
        'class': 'Cleaver',
        'name': 'Cleave',
        'cooldown': 2,
        'leaderPassive': 'Frenzy'
    },
    {
        'id': 4,
        'class': 'Tank',
        'name': 'Taunt',
        'cooldown': 0,
        'leaderPassive': 'Fortify'
    },
    {
        'id': 5,
        'class': 'Cursed',
        'name': 'Curse',
        'cooldown': 0,
        'leaderPassive': 'Spread the fear'
    },
    {
        'id': 6,
        'class': 'Healer',
        'name': 'Blessing',
        'cooldown': 0,
        'leaderPassive': 'Cleansing Aura'
    },
    {
        'id': 7,
        'class': 'Mage',
        'name': 'Thunder',
        'cooldown': 2,
        'leaderPassive': 'Channel the coven'
    },
    {
        'id': 8,
        'class': 'Troll',
        'name': 'Devestating Smash',
        'cooldown': 2,
        'leaderPassive': 'Clan momentum'
    }
]

const classes = ['Ninja','Enlightened','Cleaver','Tank','Cursed','Healer', 'Mage', 'Troll']
const powerLevels = ['Godlike', 'Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common', 'Garbage']

const addAvgGotchs = () => {
    const statsToOverwrite = ['speed', 'health', 'crit', 'armor', 'evade', 'resist', 'accuracy']

    const avgGotchis = [];

    // Add magic gotchis
    ['magic', 'physical'].forEach((brainValue) => {
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
                avgGotchi.name = `${powerLevel} avg-${brainValue} ${className}`

                // Overwrite the stats
                statsToOverwrite.forEach((stat) => {
                    const total = gotchis.reduce((acc, gotchi) => acc + gotchi[stat], 0)
                    avgGotchi[stat] = Math.round(total / gotchis.length)
                })

                // Get the highest/lowest magic value
                const magicValues = gotchis.map(gotchi => gotchi.magic)
                const highestMagic = Math.max(...magicValues)
                const lowestMagic = Math.min(...magicValues)

                // Get the highest/lowest physical value
                const physicalValues = gotchis.map(gotchi => gotchi.physical)
                const highestPhysical = Math.max(...physicalValues)
                const lowestPhysical = Math.min(...physicalValues)

                // If this is a magic gotchi then set the magic value to the highest
                if (brainValue === 'magic') {
                    avgGotchi.magic = highestMagic
                    avgGotchi.physical = lowestPhysical
                    avgGotchi.attack = 'magic'
                } else {
                    avgGotchi.magic = lowestMagic
                    avgGotchi.physical = highestPhysical
                    avgGotchi.attack = 'physical'
                }

                avgGotchis.push(avgGotchi)
            })
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
    mapGotchi(gotchi)
})

// Add the average gotchis
addAvgGotchs()

// Write the updated trainingGotchis to a new file
fs.writeFileSync('./training_gotchis1.json', JSON.stringify(trainingGotchis, null, '\t'))

// node scripts/balancing/fixTrainingGotchis.js