const logToInGameTeams = (originalLog) => {
    // Deep copy the log to avoid modifying the original log
    const log = JSON.parse(JSON.stringify(originalLog))

    const teams = [];

    [0, 1].forEach((teamIndex) => {
        teams.push({
            formation: {
                front: log.layout.teams[teamIndex].rows[0].slots.map((slot) => {
                    if (slot.isActive) {
                        const gotchi = log.gotchis.find((gotchi) => gotchi.id === slot.id)

                        if (!gotchi) {
                            throw new Error(`Gotchi not found: ${slot.id}`)
                        }

                        return gotchi
                    } else {
                        return null
                    }
                }),
                back: log.layout.teams[teamIndex].rows[1].slots.map((slot) => {
                    if (slot.isActive) {
                        const gotchi = log.gotchis.find((gotchi) => gotchi.id === slot.id)

                        if (!gotchi) {
                            throw new Error(`Gotchi not found: ${slot.id}`)
                        }

                        return gotchi
                    } else {
                        return null
                    }
                })
            },
            leader: log.layout.teams[teamIndex].leaderId,
            name: log.layout.teams[teamIndex].name,
            owner: log.layout.teams[teamIndex].owner
        })
    });
    
    return teams
}

const webappTeamToInGameTeam = (webappTeam) => {
    const inGameTeam = {
        formation: {
            front: [front1Gotchi, front2Gotchi, front3Gotchi, front4Gotchi, front5Gotchi],
            back: [back1Gotchi, back2Gotchi, back3Gotchi, back4Gotchi, back5Gotchi],
        },
        leader: webappTeam.leader,
        name: webappTeam.name,
        owner: webappTeam.owner
    }

    inGameTeam.formation.front.forEach(gotchi => {
        // remove availableSpecials
        delete gotchi.availableSpecials
    })

    return inGameTeam
}

module.exports = {
    logToInGameTeams,
    webappTeamToInGameTeam
}   