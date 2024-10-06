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
})

// Write the updated trainingGotchis to a new file
fs.writeFileSync('./training_gotchis1.json', JSON.stringify(trainingGotchis, null, '\t'))