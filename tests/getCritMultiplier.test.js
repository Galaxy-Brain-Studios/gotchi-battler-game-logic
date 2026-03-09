const { expect } = require('chai')
const path = require('path')

const { attack } = require(path.join('..', 'game-logic', 'index'))
const { getCritMultiplier } = require(path.join('..', 'game-logic', 'helpers'))

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
    health: 1000,
    fullHealth: 1000,
    attack: 10,
    defense: 5,
    criticalRate: 0,
    criticalDamage: 15,
    resist: 0,
    focus: 0,
    statuses: [],
    environmentEffects: [],
    stats: makeStats(),
    special: { initialCooldown: 0 },
    ...overrides,
})

const makeTeam = ({ front = [], back = [] } = {}) => ({
    leader: front[0]?.id ?? back[0]?.id ?? 1,
    formation: { front, back },
})

describe('getCritMultiplier', () => {
    it('keeps existing crit damage below the crit rate cap', () => {
        const gotchi = makeGotchi({ criticalRate: 80, criticalDamage: 50 })

        expect(getCritMultiplier(gotchi, () => 0.79)).to.equal(1.5)
    })

    it('caps crit chance at 100 without adding overflow at the boundary', () => {
        const gotchi = makeGotchi({ criticalRate: 100, criticalDamage: 50 })

        expect(getCritMultiplier(gotchi, () => 0.99)).to.equal(1.5)
    })

    it('converts crit rate overflow into extra crit damage', () => {
        const gotchi = makeGotchi({ criticalRate: 130, criticalDamage: 50 })

        expect(getCritMultiplier(gotchi, () => 0.99)).to.equal(1.8)
    })

    it('still returns a normal hit when the crit roll fails below the cap', () => {
        const gotchi = makeGotchi({ criticalRate: 80, criticalDamage: 50 })

        expect(getCritMultiplier(gotchi, () => 0.8)).to.equal(1)
    })
})

describe('crit overflow in combat', () => {
    it('applies crit rate overflow to heal specials through the existing crit multiplier path', () => {
        const healer = makeGotchi({
            id: 100,
            health: 500,
            criticalRate: 130,
            criticalDamage: 50,
            specialExpanded: {
                actionType: 'heal',
                target: 'self',
                actionMultiplier: 0.1,
                effects: [],
            },
        })

        const ally = makeGotchi({ id: 101 })
        const enemy = makeGotchi({ id: 200 })
        const attackingTeam = makeTeam({ front: [healer, ally] })
        const defendingTeam = makeTeam({ front: [enemy] })

        const result = attack(healer, attackingTeam, defendingTeam, () => 0.99, true)

        expect(result.actionEffects).to.have.length(1)
        expect(result.actionEffects[0]).to.include({
            target: healer.id,
            damage: -180,
            outcome: 'success',
        })
        expect(healer.health).to.equal(680)
        expect(healer.stats.healGiven).to.equal(180)
        expect(healer.stats.healReceived).to.equal(180)
    })
})
