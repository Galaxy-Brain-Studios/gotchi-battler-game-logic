const generateClassCombinations = () => {
    // Generate combinations of the 8 classes for the 4 non-leader spots
    const combinations = []

    for (let i = 1; i <= 8; i++) {
        for (let j = 1; j <= 8; j++) {
            for (let k = 1; k <= 8; k++) {
                for (let l = 1; l <= 8; l++) {
                    combinations.push([i, j, k, l].sort())
                }
            }
        }
    }

    // Remove duplicate combinations, so [1,1,1,1] is allowed but [1,1,1,2] and [1,1,2,1] are duplicates
    // Keep as numbers for now, convert to strings to remove duplicates, then convert back to numbers
    const uniqueCombinations = [...new Set(combinations.map((combination) => combination.join('')))].map((combination) => combination.split('').map((number) => parseInt(number)))

    return uniqueCombinations
}

const getCombinationsForALeader = (leaderClass) => {
    const combinations = generateClassCombinations()

    const combinationsForALeader = combinations.map((combination) => {
        return [leaderClass, ...combination]
    })

    return combinationsForALeader
}

const getAllClassCombos = () => {
    const allClassCombos = []

    for (let i = 1; i <= 8; i++) {
        allClassCombos.push(...getCombinationsForALeader(i))
    }

    return allClassCombos
}

const allClassCombos = getAllClassCombos()

module.exports = allClassCombos