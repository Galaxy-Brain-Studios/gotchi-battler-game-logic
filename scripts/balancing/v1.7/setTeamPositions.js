const trainingGotchis = require('./training_gotchis.json')

const getFrontRowScore = (gotchiId, leaderId) => {
    const gotchi = trainingGotchis.find(gotchi => gotchi.id === gotchiId)
    const leader = trainingGotchis.find(gotchi => gotchi.id === leaderId)

    if (gotchi.name.includes(' avg ')) {
        // Enlightened are the best up front
        if (gotchi.specialId === 2) {
            return 6
        }

        // Healer with a healer leader are the second best up front
        if (leader.specialId === 6 && gotchi.specialId === 6) {
            return 5
        }

        // Cursed are the third best up front
        if (gotchi.specialId === 5) {
            return 4
        }
    }

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
    const teamFrontRowScores = team.formation.back.map((gotchi) => getFrontRowScore(gotchi.id, team.leader)); 
    
    [0,1,2,3,4].forEach((i) => {
        const gotchi = team.formation.back[i]
        const score = teamFrontRowScores[i]

        // If score is >= 3 then move to front row
        if (score >= 3) {
            team.formation.front[i] = gotchi
            team.formation.back[i] = null
        }
    })

    // If you have 5 gotchis in the front then send the lowest 2 to the back
    const frontGotchis = team.formation.front.filter(gotchi => gotchi)
    if (frontGotchis.length === 5) {
        // Sort the gotchis by score in ascending order (lowest score first)
        const orderedGotchis = JSON.parse(JSON.stringify(frontGotchis)).sort((a, b) => getFrontRowScore(a.id, team.leader) - getFrontRowScore(b.id, team.leader));

        // Loop through the front row and the first 2 gotchis that have a score of either orderedGotchis[0] or orderedGotchis[1] move to the back
        let hasMoved = 0
        team.formation.front.forEach((gotchi, i) => {
            if (hasMoved < 2 && (gotchi.id === orderedGotchis[0].id || gotchi.id === orderedGotchis[1].id)) {
                team.formation.back[i] = gotchi
                team.formation.front[i] = null

                hasMoved++
            }
        })
    }
}

