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
    })
    
    return teams
}

const webappTeamToInGameTeam = (webappTeam) => {
    const inGameTeam = {
        formation: {
            front: [webappTeam.front1Gotchi, webappTeam.front2Gotchi, webappTeam.front3Gotchi, webappTeam.front4Gotchi, webappTeam.front5Gotchi],
            back: [webappTeam.back1Gotchi, webappTeam.back2Gotchi, webappTeam.back3Gotchi, webappTeam.back4Gotchi, webappTeam.back5Gotchi],
        },
        leader: webappTeam.leader,
        name: webappTeam.name,
        owner: webappTeam.owner
    }

    inGameTeam.formation.front.forEach(gotchi => {
        if (!gotchi) return
        // remove availableSpecials
        delete gotchi.availableSpecials
    })

    return inGameTeam
}

const inGameTeamToWebappTeam = (inGameTeam) => {
    const webappTeam = {
        front1Gotchi: inGameTeam.formation.front[0],
        front2Gotchi: inGameTeam.formation.front[1],
        front3Gotchi: inGameTeam.formation.front[2],
        front4Gotchi: inGameTeam.formation.front[3],
        front5Gotchi: inGameTeam.formation.front[4],
        back1Gotchi: inGameTeam.formation.back[0],
        back2Gotchi: inGameTeam.formation.back[1],
        back3Gotchi: inGameTeam.formation.back[2],
        back4Gotchi: inGameTeam.formation.back[3],
        back5Gotchi: inGameTeam.formation.back[4],
        leader: inGameTeam.leader,
        name: inGameTeam.name,
        owner: inGameTeam.owner
    }

    return webappTeam
}

module.exports = {
    logToInGameTeams,
    webappTeamToInGameTeam,
    inGameTeamToWebappTeam
}   