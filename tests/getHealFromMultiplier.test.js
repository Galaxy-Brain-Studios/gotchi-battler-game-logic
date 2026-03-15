const { expect } = require('chai')
const path = require('path')

const { getHealFromMultiplier } = require(path.join('..', 'game-logic', 'helpers'))

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
    gotchiClass: 'ninja',
    health: 700,
    fullHealth: 1000,
    stats: makeStats(),
    ...overrides,
})

describe('getHealFromMultiplier', () => {
    it('applies the healer target penalty when healing a healer', () => {
        const healingGotchi = makeGotchi()
        const target = makeGotchi({ gotchiClass: 'healer' })

        const amountToHeal = getHealFromMultiplier(healingGotchi, target, 0.2)

        expect(amountToHeal).to.equal(100)
        expect(healingGotchi.stats.healGiven).to.equal(100)
        expect(target.stats.healReceived).to.equal(100)
    })

    it('keeps full healing for non-healer targets', () => {
        const healingGotchi = makeGotchi()
        const target = makeGotchi({ gotchiClass: 'tank' })

        const amountToHeal = getHealFromMultiplier(healingGotchi, target, 0.2)

        expect(amountToHeal).to.equal(200)
        expect(healingGotchi.stats.healGiven).to.equal(200)
        expect(target.stats.healReceived).to.equal(200)
    })
})
