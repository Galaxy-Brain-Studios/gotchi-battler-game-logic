const { expect } = require('chai')
const path = require('path')

// Import from helpers
const { getModifiedStats } = require(path.join('..', 'game-logic', 'v2.0', 'helpers'))

const makeGotchi = (overrides = {}) => ({
    id: 1,
    name: 'Test',
    speed: 10,
    attack: 5,
    defense: 3,
    resist: 0,
    criticalRate: 0,
    criticalDamage: 15,
    special: { initialCooldown: 0 },
    statuses: [],
    ...overrides,
})

describe('getModifiedStats', () => {
    it('applies flat stat buffs from statuses', () => {
        const g = makeGotchi({ statuses: ['spd_up', 'atk_up', 'def_up'] })
        const m = getModifiedStats(g)
        // v2.0 statuses are percent-based; with base speed=10, spd_up (+15%) rounds to +2
        expect(m.speed).to.equal(12)
        expect(m.attack).to.equal(6)
        expect(m.defense).to.equal(4)
    })

    it('stacks multiple statuses and nets against opposing debuffs', () => {
        const g = makeGotchi({ statuses: ['spd_up', 'spd_up', 'spd_down'] })
        const m = getModifiedStats(g)
        // Each spd_up: 10 * 0.15 => 1.5 => Math.round => 2
        // spd_down: 10 * -0.15 => -1.5 => Math.round => -1 (JS rounds halves toward +∞)
        // Net: +2 +2 -1 = +3
        expect(m.speed).to.equal(13)
    })

    it('keeps speed at minimum 1 to avoid zero/negative speed', () => {
        // Use a base speed where percent debuffs round to at least -1 per stack
        const g = makeGotchi({ speed: 4, statuses: ['spd_down', 'spd_down', 'spd_down'] })
        const m = getModifiedStats(g)
        expect(m.speed).to.equal(1)
    })

    it('ignores non stat_modifier statuses', () => {
        const g = makeGotchi({ statuses: ['taunt', 'bleed'] }) // custom, turn_effect
        const m = getModifiedStats(g)
        expect(m.speed).to.equal(10)
        expect(m.attack).to.equal(5)
        expect(m.defense).to.equal(3)
    })

    it('keeps defense at minimum 1 to avoid zero/negative defense', () => {
        const g = makeGotchi({ defense: 1, statuses: ['def_down'] })
        const m = getModifiedStats(g)
        expect(m.defense).to.equal(1)
    })

    it('keeps defense at minimum 1 even if base defense is 0 and no statuses', () => {
        const g = makeGotchi({ defense: 0, statuses: [] })
        const m = getModifiedStats(g)
        expect(m.defense).to.equal(1)
    })

    it('does not mutate the original gotchi object', () => {
        const g = makeGotchi({ statuses: ['spd_up'] })
        const before = { speed: g.speed, attack: g.attack, defense: g.defense }
        const m = getModifiedStats(g)
        expect(g.speed).to.equal(before.speed)
        expect(g.attack).to.equal(before.attack)
        expect(g.defense).to.equal(before.defense)
        expect(m).to.not.equal(g)
    })

    it('throws if an unknown status code is provided', () => {
        const g = makeGotchi({ statuses: ['this_is_not_real'] })
        expect(() => getModifiedStats(g)).to.throw('Status with code this_is_not_real not found')
    })
})


