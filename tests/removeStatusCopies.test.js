const { expect } = require('chai')
const path = require('path')

const { attack } = require(path.join('..', 'game-logic', 'index'))

const makeStats = () => ({
    hits: 0,
    crits: 0,
    dmgGiven: 0,
    dmgReceived: 0,
    counters: 0,
    focuses: 0,
    resists: 0,
    healGiven: 0,
    healReceived: 0,
})

const makeGotchi = (overrides = {}) => ({
    id: 1,
    name: 'Test',
    speed: 10,
    attack: 10,
    defense: 5,
    criticalRate: 0,
    criticalDamage: 15,
    resist: 0,
    focus: 0,
    statuses: [],
    environmentEffects: [],
    health: 1000,
    fullHealth: 1000,
    stats: makeStats(),
    special: { initialCooldown: 0 },
    ...overrides,
})

const makeTeam = ({ front = [], back = [] } = {}) => ({
    leader: front[0]?.id ?? back[0]?.id ?? 1,
    formation: { front, back },
})

describe('status removal clears all copies of the chosen status', () => {
    it('removes every stack of a chosen buff from attack effects', () => {
        const attacker = makeGotchi({
            id: 100,
            focus: 999,
            statuses: ['dispelling_strike'],
        })
        const defender = makeGotchi({
            id: 200,
            statuses: ['def_up', 'def_up', 'spd_up', 'fear'],
            stats: makeStats(),
        })

        const result = attack(
            attacker,
            makeTeam({ front: [attacker] }),
            makeTeam({ front: [defender] }),
            () => 0
        )

        expect(defender.statuses).to.deep.equal(['spd_up', 'fear'])
        expect(result.statusesExpired).to.deep.equal([
            { target: defender.id, status: 'def_up' },
            { target: defender.id, status: 'def_up' },
        ])
    })

    it('removes every stack of a chosen buff from special effects', () => {
        const attacker = makeGotchi({
            id: 100,
            specialExpanded: {
                actionType: 'none',
                target: 'enemy_random',
                actionMultiplier: null,
                effects: [
                    { effectType: 'remove_buff', target: 'same_as_attack', chance: 1, skipFocusCheck: true },
                ],
            },
        })
        const defender = makeGotchi({
            id: 200,
            statuses: ['def_up', 'def_up', 'spd_up', 'fear'],
            stats: makeStats(),
        })

        const result = attack(
            attacker,
            makeTeam({ front: [attacker] }),
            makeTeam({ front: [defender] }),
            () => 0,
            true
        )

        expect(defender.statuses).to.deep.equal(['spd_up', 'fear'])
        expect(result.statusesExpired).to.deep.equal([
            { target: defender.id, status: 'def_up' },
            { target: defender.id, status: 'def_up' },
        ])
    })

    it('removes every stack of a chosen debuff from special effects', () => {
        const attacker = makeGotchi({
            id: 100,
            specialExpanded: {
                actionType: 'none',
                target: 'enemy_random',
                actionMultiplier: null,
                effects: [
                    { effectType: 'remove_debuff', target: 'same_as_attack', chance: 1 },
                ],
            },
        })
        const defender = makeGotchi({
            id: 200,
            statuses: ['fear', 'fear', 'bleed', 'def_up'],
            stats: makeStats(),
        })

        const result = attack(
            attacker,
            makeTeam({ front: [attacker] }),
            makeTeam({ front: [defender] }),
            () => 0,
            true
        )

        expect(defender.statuses).to.deep.equal(['bleed', 'def_up'])
        expect(result.statusesExpired).to.deep.equal([
            { target: defender.id, status: 'fear' },
            { target: defender.id, status: 'fear' },
        ])
    })
})
