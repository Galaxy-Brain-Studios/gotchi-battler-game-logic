const mapTeam = (team) => {
    for(const gotchi of team.formation.front) {
        if (gotchi) mapGotchi(gotchi)
    }

    for(const gotchi of team.formation.back) {
        if (gotchi) mapGotchi(gotchi)
    }
}

// This is copied/hacked from the mapGotchi function in the backend
const mapGotchi = (gotchi) => {
    const traitMaps = {
        speed: {
            baseFormula: 100,
            multiplier: 1,
            traitKey: 0,
            isNegative: false
        },
        health: {
            baseFormula: 'brs*0.85',
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
            baseFormula: 'brs*0.35',
            multiplier: 5,
            traitKey: 3,
            isNegative: false
        },
        physical: {
            baseFormula: 'brs*0.35',
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

module.exports = {
    mapGotchi,
    mapTeam
}

// node scripts/balancing/v1.7.2/mapGotchi.js
if (require.main === module) {
    const gotchi1 = {
        brs: 729,
        nrg: 112,
        agg: 112,
        spk: 75,
        brn: 112,
        eyc: 97,
        eys: 96
    }

    const gotchi2 = {
        brs: 847,
        nrg: 109,
        agg: 102,
        spk: 109,
        brn: 99,
        eyc: 93,
        eys: 0
    }

    mapGotchi(gotchi1)
    mapGotchi(gotchi2)

    console.log({
        speed: [gotchi1.speed, gotchi2.speed],
        health: [gotchi1.health, gotchi2.health],
        crit: [gotchi1.crit, gotchi2.crit],
        armor: [gotchi1.armor, gotchi2.armor],
        evade: [gotchi1.evade, gotchi2.evade],
        resist: [gotchi1.resist, gotchi2.resist],
        magic: [gotchi1.magic, gotchi2.magic],
        physical: [gotchi1.physical, gotchi2.physical],
        accuracy: [gotchi1.accuracy, gotchi2.accuracy]
    })
}