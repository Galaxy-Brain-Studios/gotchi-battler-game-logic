const webappTeamToInGameTeam = (webappTeam) => {
    const inGameTeam = {
        formation: {
            front: [webappTeam.front1Gotchi, webappTeam.front2Gotchi, webappTeam.front3Gotchi, webappTeam.front4Gotchi, webappTeam.front5Gotchi],
            back: [webappTeam.back1Gotchi, webappTeam.back2Gotchi, webappTeam.back3Gotchi, webappTeam.back4Gotchi, webappTeam.back5Gotchi],
        },
        leader: webappTeam[webappTeam.leader],
        name: webappTeam.name,
        owner: webappTeam.owner
    }

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
    webappTeamToInGameTeam,
    inGameTeamToWebappTeam
}
