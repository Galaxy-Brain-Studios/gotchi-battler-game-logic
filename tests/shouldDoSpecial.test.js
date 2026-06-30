const { expect } = require('chai')
const path = require('path')

const { getAlive, shouldDoSpecial } = require(path.join('..', 'game-logic', 'helpers'))
const { DEFAULT_MAX_STATUSES } = require(path.join('..', 'game-logic', 'constants'))
const { getStatusByCode } = require(path.join('..', 'game-logic', 'status-store'))

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

const getStatusMaxStack = (statusCode) => getStatusByCode(statusCode).maxStack || DEFAULT_MAX_STATUSES

const makeStatusStacks = (statusCode, count) => Array.from({ length: count }, () => statusCode)

describe('getAlive', () => {
    it('returns an empty array for missing row-specific team context', () => {
        expect(getAlive(null, 'back')).to.deep.equal([])
        expect(getAlive({ formation: { front: [] } }, 'back')).to.deep.equal([])
    })
})

describe('shouldDoSpecial', () => {
    it('skips no-action self status specials when every status is already at max stack', () => {
        const maxStack = getStatusMaxStack('def_up')
        const attacker = makeGotchi({
            statuses: makeStatusStacks('def_up', maxStack),
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
        const maxStack = getStatusMaxStack('def_up')
        const attacker = makeGotchi({
            statuses: makeStatusStacks('def_up', maxStack - 1),
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

    it('skips no-action self status specials when any desired status is already at max stack', () => {
        const maxStack = getStatusMaxStack('def_up')
        const attacker = makeGotchi({
            statuses: [...makeStatusStacks('def_up', maxStack), 'res_up'],
            specialExpanded: {
                actionType: 'none',
                target: 'self',
                effects: [
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'res_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'res_up', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'res_up', target: 'same_as_attack', chance: 1 },
                ],
            },
        })
        const team = makeTeam([attacker])

        expect(shouldDoSpecial(attacker, team, null)).to.equal(false)
    })

    it('skips no-action self status specials at max stacks even when effect chance is 0.5', () => {
        const maxStack = getStatusMaxStack('def_up')
        const attacker = makeGotchi({
            statuses: makeStatusStacks('def_up', maxStack),
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

    it('skips enemy back-row specials when defending team context is unavailable', () => {
        const attacker = makeGotchi({
            specialExpanded: {
                actionType: 'attack',
                target: 'enemy_back_row',
                effects: [],
            },
        })
        const team = makeTeam([attacker])

        expect(shouldDoSpecial(attacker, team, null)).to.equal(false)
    })

    it('skips enemy back-row specials when the defending back row has no living targets', () => {
        const attacker = makeGotchi({
            specialExpanded: {
                actionType: 'attack',
                target: 'enemy_back_row',
                effects: [],
            },
        })
        const attackingTeam = makeTeam([attacker])
        const defendingTeam = {
            leader: 2,
            formation: {
                front: [makeGotchi({ id: 2 })],
                back: [makeGotchi({ id: 3, health: 0 })],
            }
        }

        expect(shouldDoSpecial(attacker, attackingTeam, defendingTeam)).to.equal(false)
    })

    it('uses enemy back-row specials when the defending back row has a living target', () => {
        const attacker = makeGotchi({
            specialExpanded: {
                actionType: 'attack',
                target: 'enemy_back_row',
                effects: [],
            },
        })
        const attackingTeam = makeTeam([attacker])
        const defendingTeam = {
            leader: 2,
            formation: {
                front: [makeGotchi({ id: 2 })],
                back: [makeGotchi({ id: 3 })],
            }
        }

        expect(shouldDoSpecial(attacker, attackingTeam, defendingTeam)).to.equal(true)
    })
})
