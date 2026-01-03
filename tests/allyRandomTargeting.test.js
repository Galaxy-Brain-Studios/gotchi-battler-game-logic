const { expect } = require('chai')
const path = require('path')

const { getTargetsFromCode } = require(path.join('..', 'game-logic', 'v2.0', 'helpers'))

const makeGotchi = (overrides = {}) => ({
    id: 1,
    name: 'Test',
    health: 100,
    statuses: [],
    ...overrides,
})

const makeTeam = (front = [], back = []) => ({
    leader: front[0]?.id ?? back[0]?.id ?? 1,
    formation: {
        front,
        back,
    },
})

describe('getTargetsFromCode: ally_random', () => {
    it('chooses a truly random ally (does not force taunt targets)', () => {
        const taunter = makeGotchi({ id: 1, statuses: ['taunt'] })
        const a2 = makeGotchi({ id: 2 })
        const a3 = makeGotchi({ id: 3 })
        const a4 = makeGotchi({ id: 4 })
        const a5 = makeGotchi({ id: 5 })

        const attackingTeam = makeTeam([taunter, a2, a3], [a4, a5])
        const defendingTeam = makeTeam([], [])
        const attackingGotchi = a2

        // rng=0.9 with 5 alive => floor(0.9 * 5) = 4 => picks id=5
        const rng = () => 0.9

        const targets = getTargetsFromCode('ally_random', attackingGotchi, attackingTeam, defendingTeam, rng)
        expect(targets).to.have.length(1)
        expect(targets[0].id).to.equal(5)
    })
})


