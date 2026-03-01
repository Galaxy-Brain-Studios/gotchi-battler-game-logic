const { expect } = require('chai')
const path = require('path')

const { shouldDoSpecial } = require(path.join('..', 'game-logic', 'helpers'))

const makeGotchi = (overrides = {}) => ({
    id: 1,
    name: 'Test',
    health: 100,
    fullHealth: 100,
    statuses: [],
    specialExpanded: {
        actionType: 'none',
        target: 'self',
        effects: [],
    },
    ...overrides,
})

const makeTeam = (gotchis = []) => ({
    leader: gotchis[0]?.id ?? 1,
    formation: {
        front: gotchis,
        back: [],
    }
})

describe('shouldDoSpecial', () => {
    it('skips no-action self status specials when every status is already at max stack', () => {
        const attacker = makeGotchi({
            statuses: ['def_up', 'def_up', 'def_up'],
            specialExpanded: {
                actionType: 'none',
                target: 'self',
                effects: [
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                ],
            },
        })
        const team = makeTeam([attacker])

        expect(shouldDoSpecial(attacker, team, null)).to.equal(false)
    })

    it('uses no-action self status specials when at least one status can still be applied', () => {
        const attacker = makeGotchi({
            statuses: ['def_up', 'def_up'],
            specialExpanded: {
                actionType: 'none',
                target: 'self',
                effects: [
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                ],
            },
        })
        const team = makeTeam([attacker])

        expect(shouldDoSpecial(attacker, team, null)).to.equal(true)
    })

    it('skips no-action self status specials at max stacks even when effect chance is 0.5', () => {
        const attacker = makeGotchi({
            statuses: ['def_up', 'def_up', 'def_up'],
            specialExpanded: {
                actionType: 'none',
                target: 'self',
                effects: [
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 0.5 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 0.5 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 0.5 },
                ],
            },
        })
        const team = makeTeam([attacker])

        expect(shouldDoSpecial(attacker, team, null)).to.equal(false)
    })
})
