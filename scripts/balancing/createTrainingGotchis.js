const fs = require('fs')

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


const powerLevels = ['Godlike', 'Mythical', 'Legendary', 'Rare', 'Uncommon', 'Common', 'Garbage']
const traitCombos = [
    '++++', '+++-', '++-+', '++--', '+-++', '+-+-', '+--+', '+---', 
    '-+++', '-++-', '-+-+', '-+--', '--++', '--+-', '---+', '----'
]
const classes = ['Ninja','Enlightened','Cleaver','Tank','Cursed','Healer', 'Mage', 'Troll']


// Create training gotchi objects like below for all combinations of powerLevels, traitCombos and classes
// {
//     "id": 1,
//     "snapshotBlock": 0,
//     "onchainId": 1000001,
//     "name": "Godlike ++++ Ninja",
//     "brs": 783,
//     "nrg": 110,
//     "agg": 98,
//     "spk": 101,
//     "brn": 107,
//     "eyc": 94,
//     "eys": 94,
//     "kinship": 0,
//     "xp": 0,
//     "speed": 161,
//     "health": 587,
//     "crit": 25,
//     "armor": 0,
//     "evade": 16,
//     "resist": 0,
//     "magic": 486,
//     "physical": 196,
//     "accuracy": 95,
//     "attack": "magic",
//     "actionDelay": 0.617,
//     "specialId": 1,
//     "svgFront": "https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/ninja_godlike_front.png",
//     "svgBack": "https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/ninja_godlike_back.png",
//     "svgLeft": "https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/ninja_godlike_left.png",
//     "svgRight": "https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/ninja_godlike_right.png",
//     "createdAt": "2023-09-09 12:10:01",
//     "updatedAt": "2024-06-05 16:34:00",
//     "special": {
//         "id": 1,
//         "class": "Ninja",
//         "name": "Spectral strike",
//         "cooldown": 0,
//         "leaderPassive": "Sharpen blades"
//     }
// }

const main = (version) => {
    const trainingGotchisTraits = require(`./v${version}/training_gotchis_traits.json`)
    const { mapGotchi } = require(`./v${version}/mapGotchi.js`)

    const trainingGotchis = []

    let id = 1
    traitCombos.forEach((t) => {
        powerLevels.forEach((p) => {
            for (let index = 0; index < t.length; index ++) {
                const c = t[index]

                const gotchi = {
                    id,
                    snapshotBlock: 0,
		            onchainId: 1000000 + id,
                }

                // Based on the position of the trait in the traitCombos array, we can determine the class of the gotchi
                // e.g. if the first trait is positive then add ninja, if it's negative then add enlightened
                const className = classes[index * 2 + (c === '+' ? 0 : 1)]

                // e.g Godlike ++++ Mage
                gotchi.name = `${p} ${t} ${className}`

                /**
                 * This is for versions <= 1.7.2
                 */
                // const trainingGotchiTraits = trainingGotchisTraits[p.toLowerCase()][className.toLowerCase()]

                // if (!trainingGotchiTraits) {
                //     throw new Error(`No traits found for ${p} ${className}`)
                // }

                // gotchi.brs = trainingGotchiTraits.brs
                // gotchi.nrg = trainingGotchiTraits.nrg[t[0] === '-' ? 0 : 1]
                // gotchi.agg = trainingGotchiTraits.agg[t[1] === '-' ? 0 : 1]
                // gotchi.spk = trainingGotchiTraits.spk[t[2] === '-' ? 0 : 1]
                // gotchi.brn = trainingGotchiTraits.brn[t[3] === '-' ? 0 : 1]
                // gotchi.eys = trainingGotchiTraits.eys[1] // These are always in index 1
                // gotchi.eyc = trainingGotchiTraits.eyc[1] // These are always in index 1

                /**
                 * This is for versions >= 1.7.3
                 */
                const trainingGotchiTraits = trainingGotchisTraits[p.toLowerCase()]

                if (!trainingGotchiTraits) {
                    throw new Error(`No traits found for ${p}`)
                }

                gotchi.brs = trainingGotchiTraits.brs
                gotchi.nrg = trainingGotchiTraits.traits[t[0] === '-' ? 0 : 1]
                gotchi.agg = trainingGotchiTraits.traits[t[1] === '-' ? 0 : 1]
                gotchi.spk = trainingGotchiTraits.traits[t[2] === '-' ? 0 : 1]
                gotchi.brn = trainingGotchiTraits.traits[t[3] === '-' ? 0 : 1]
                gotchi.eys = trainingGotchiTraits.eyes
                gotchi.eyc = trainingGotchiTraits.eyes
                
                gotchi.kinship = 0
                gotchi.xp = 0

                // Map the in game stats to the gotchi
                mapGotchi(gotchi)
                gotchi.attack = t[3] === '-' ? 'physical' : 'magic'
                gotchi.actionDelay = Math.round(((100 / gotchi.speed) + Number.EPSILON) * 1000) / 1000

                gotchi.specialId = classes.indexOf(className) + 1
                gotchi.svgFront = `https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/${className.toLowerCase()}_${p.toLowerCase()}_front.png`
                gotchi.svgBack = `https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/${className.toLowerCase()}_${p.toLowerCase()}_back.png`
                gotchi.svgLeft = `https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/${className.toLowerCase()}_${p.toLowerCase()}_left.png`
                gotchi.svgRight = `https://storage.googleapis.com/gotchi-battler-qa_gotchis/training/${className.toLowerCase()}_${p.toLowerCase()}_right.png`
                gotchi.createdAt = '2023-09-09 12:10:01'
                gotchi.updatedAt = '2024-06-05 16:34:00'
                gotchi.special = specials.find(s => s.id === gotchi.specialId)

                trainingGotchis.push(gotchi)

                id++
            }
        })
    })

    const avgGotchis = createAvgGotchs(trainingGotchis)

    trainingGotchis.push(...avgGotchis)

    fs.writeFileSync('./training_gotchis.json', JSON.stringify(trainingGotchis, null, 2))
}

const createAvgGotchs = (trainingGotchis) => {
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

                    if (['speed', 'health', 'armor', 'resist', 'magic', 'physical', 'accuracy'].includes(stat)) {
                        avgGotchi[stat] = Math.round(total / gotchis.length)
                    } else {
                        // Round to 2 decimal places
                        avgGotchi[stat] = Math.round((total / gotchis.length) * 100) / 100
                    }
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

    return avgGotchis
}

// node scripts/balancing/createTrainingGotchis.js
main('1.7.3')