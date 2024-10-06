const trainingGotchis = require('./training_gotchis.json')

const getFrontRowScore = (gotchiId) => {
    const gotchi = trainingGotchis.find(gotchi => gotchi.id === gotchiId)

    // High health gotchis do well up front
    const isHighHealth = gotchi.nrg < 50

    // High armor gotchis do well up front
    const isLowAgg = gotchi.agg < 50

    // High evasion gotchis do well up front
    const isHighSpk = gotchi.spk >= 50

    const isLowBrn = gotchi.brn < 50

    // Create a score from 0 to 6 based on how much they favour the front

    let score = 0

    if (gotchi.specialId === 2) score +=2 // Enlightened
    if (isHighHealth) score++
    if (isLowBrn) score++
    if (isLowAgg) score++
    if (isHighSpk) score++

    return score
} 

module.exports = (team) => {
    // All gotchis are currently in the back row
    // Get the score for each gotchi for how much they favour the front row
    const teamFrontRowScores = team.formation.back.map(gotchi => getFrontRowScore(gotchi.id)); 
    
    [0,1,2,3,4].forEach((i) => {
        const gotchi = team.formation.back[i]
        const score = teamFrontRowScores[i]

        // If score is >= 3 then move to front row
        if (score >= 3) {
            team.formation.front[i] = gotchi
            team.formation.back[i] = null
        }
    })
}

