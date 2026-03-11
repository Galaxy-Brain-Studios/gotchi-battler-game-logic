const { expect } = require('chai')
const path = require('path')

const { attack } = require(path.join('..', 'game-logic', 'index'))
const { counterCheck } = require(path.join('..', 'game-logic', 'helpers'))

const makeStats = () => ({
    hits: 0,
    crits: 0,
    dmgGiven: 0,
    dmgReceived: 0,
    counters: 0,
    focuses: 0,
    resists: 0,
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

describe('counterCheck', () => {
    it('gives faster defenders a higher counter chance than slower attackers', () => {
        const defender = makeGotchi({ speed: 20 })
        const attacker = makeGotchi({ id: 2, speed: 10 })

        expect(counterCheck(defender, attacker, () => 0.59)).to.equal(true)
        expect(counterCheck(defender, attacker, () => 0.61)).to.equal(false)
    })

    it('uses modified speed when checking counter chance', () => {
        const attacker = makeGotchi({ id: 2, speed: 10 })
        const baseDefender = makeGotchi({ speed: 10 })
        const buffedDefender = makeGotchi({ speed: 10, statuses: ['spd_up'] })

        expect(counterCheck(baseDefender, attacker, () => 0.505)).to.equal(false)
        expect(counterCheck(buffedDefender, attacker, () => 0.505)).to.equal(true)
    })
})

describe('counter attacks', () => {
    it('does not counter from taunt alone', () => {
        const attacker = makeGotchi({ id: 100 })
        const defender = makeGotchi({ id: 200, statuses: ['taunt'] })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })

        const result = attack(attacker, attackingTeam, defendingTeam, () => 0.9, false)

        expect(result.additionalEffects).to.deep.equal([])
        expect(defender.stats.counters).to.equal(0)
        expect(attacker.health).to.equal(attacker.fullHealth)
    })

    it('allows countering without taunt when the defender has counter', () => {
        const attacker = makeGotchi({ id: 100, speed: 10 })
        const defender = makeGotchi({ id: 200, speed: 20, statuses: ['counter'] })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })

        const seq = [0.2, 0.9, 0.55]
        let i = 0
        const rng = () => seq[i++]

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.additionalEffects).to.have.length(1)
        expect(result.additionalEffects[0].outcome).to.equal('counter')
        expect(result.additionalEffects[0].source).to.equal(defender.id)
        expect(defender.stats.counters).to.equal(1)
        expect(attacker.health).to.be.lessThan(attacker.fullHealth)
    })

    it('applies crit damage when a counter attack crits', () => {
        const attacker = makeGotchi({ id: 100, speed: 10 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            criticalRate: 100,
            criticalDamage: 50,
            statuses: ['counter']
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })

        const seq = [0.2, 0.9, 0.55, 0.99]
        let i = 0
        const rng = () => seq[i++]

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.additionalEffects).to.have.length(1)
        expect(result.additionalEffects[0]).to.include({
            target: attacker.id,
            source: defender.id,
            damage: 90,
            outcome: 'counter',
            critical: true,
        })
        expect(defender.stats.counters).to.equal(1)
        expect(defender.stats.crits).to.equal(1)
        expect(attacker.health).to.equal(910)
    })

    it('fails the counter check when the defender is slower', () => {
        const attacker = makeGotchi({ id: 100, speed: 10 })
        const defender = makeGotchi({ id: 200, speed: 5, statuses: ['counter'] })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })

        const seq = [0.2, 0.9, 0.55]
        let i = 0
        const rng = () => seq[i++]

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.additionalEffects).to.deep.equal([])
        expect(defender.stats.counters).to.equal(0)
        expect(attacker.health).to.equal(attacker.fullHealth)
    })
})
