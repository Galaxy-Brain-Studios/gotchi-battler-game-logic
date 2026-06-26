const { expect } = require('chai')
const path = require('path')

const { attack } = require(path.join('..', 'game-logic', 'index'))
const { counterCheck, getCounterChance } = require(path.join('..', 'game-logic', 'helpers'))
const {
    COUNTER_ATTACK_MULTIPLIER,
    COUNTER_CHANCE_MAX,
    COUNTER_CHANCE_MIN,
} = require(path.join('..', 'game-logic', 'constants'))

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
    defense: 10,
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

const makeRng = (values, fallback = 0.99) => {
    let i = 0
    return () => (i < values.length ? values[i++] : fallback)
}

describe('counter chance', () => {
    it('clamps high-speed / low-health profiles at the maximum chance', () => {
        const gotchi = makeGotchi({ speed: 20, fullHealth: 500 })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MAX)
    })

    it('gives speed-B-ish / low-health profiles around 62% chance', () => {
        const gotchi = makeGotchi({ speed: 20, fullHealth: 690 })

        expect(getCounterChance(gotchi)).to.be.closeTo(0.617, 0.001)
    })

    it('clamps neutral speed / neutral health profiles at the minimum chance', () => {
        const gotchi = makeGotchi({ speed: 10, fullHealth: 1000 })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MIN)
    })

    it('clamps low-speed / high-health profiles at the minimum chance', () => {
        const gotchi = makeGotchi({ speed: 5, fullHealth: 1200 })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MIN)
    })

    it('clamps high-speed / high-health profiles at the minimum chance', () => {
        const gotchi = makeGotchi({ speed: 20, fullHealth: 1000 })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MIN)
    })

    it('uses fullHealth rather than damaged current health', () => {
        const gotchi = makeGotchi({ speed: 20, health: 10, fullHealth: 1000 })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MIN)
    })

    it('ignores temporary speed status modifiers', () => {
        const gotchi = makeGotchi({ speed: 20, fullHealth: 1000, statuses: ['spd_up'] })

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MIN)
    })

    it('falls back to current health when fullHealth is not present', () => {
        const gotchi = makeGotchi({ speed: 20, health: 500 })
        delete gotchi.fullHealth

        expect(getCounterChance(gotchi)).to.equal(COUNTER_CHANCE_MAX)
    })

    it('falls back to the minimum chance for invalid stats', () => {
        expect(getCounterChance(makeGotchi({ speed: Number.NaN }))).to.equal(COUNTER_CHANCE_MIN)
        expect(getCounterChance(makeGotchi({ fullHealth: 0 }))).to.equal(COUNTER_CHANCE_MIN)
    })

    it('rolls against the calculated chance', () => {
        const gotchi = makeGotchi({ speed: 20, fullHealth: 500 })

        expect(counterCheck(gotchi, () => COUNTER_CHANCE_MAX - 0.01)).to.equal(true)
        expect(counterCheck(gotchi, () => COUNTER_CHANCE_MAX)).to.equal(false)
    })
})

describe('counter attacks', () => {
    it('does not counter from taunt alone', () => {
        const attacker = makeGotchi({ id: 100, attack: 100 })
        const defender = makeGotchi({ id: 200, statuses: ['taunt'] })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })

        const result = attack(attacker, attackingTeam, defendingTeam, () => 0.9, false)

        expect(result.additionalEffects).to.deep.equal([])
        expect(result.actionEffects[0].damage).to.equal(850)
        expect(defender.stats.counters).to.equal(0)
        expect(attacker.health).to.equal(attacker.fullHealth)
    })

    it('reduces auto-attack damage before applying it and lets a would-be-lethal target counter', () => {
        const attacker = makeGotchi({ id: 100, attack: 100, defense: 10 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            attack: 100,
            defense: 10,
            health: 300,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.5, // counter succeeds before damage is applied
            0.9, // counter attack is not a crit
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.actionEffects[0]).to.include({
            target: defender.id,
            damage: 213,
            outcome: 'success',
        })
        expect(defender.health).to.equal(87)
        expect(attacker.stats.dmgGiven).to.equal(213)
        expect(defender.stats.dmgReceived).to.equal(213)
        expect(result.additionalEffects).to.have.length(1)
        expect(result.additionalEffects[0]).to.include({
            target: attacker.id,
            source: defender.id,
            damage: 250,
            outcome: 'counter',
            critical: false,
        })
        expect(defender.stats.counters).to.equal(1)
        expect(attacker.health).to.equal(750)
    })

    it('does not emit a counter attack when the target dies from reduced damage', () => {
        const attacker = makeGotchi({ id: 100, attack: 200, defense: 10 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            defense: 10,
            health: 300,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.5, // counter succeeds and reduces damage
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.actionEffects[0].damage).to.equal(425)
        expect(defender.health).to.equal(0)
        expect(result.additionalEffects).to.deep.equal([])
        expect(defender.stats.counters).to.equal(0)
        expect(attacker.health).to.equal(attacker.fullHealth)
    })

    it('applies full auto-attack damage when the counter roll fails', () => {
        const attacker = makeGotchi({ id: 100, attack: 100 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            health: 1000,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.99, // counter fails
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.actionEffects[0].damage).to.equal(850)
        expect(defender.health).to.equal(150)
        expect(result.additionalEffects).to.deep.equal([])
        expect(defender.stats.counters).to.equal(0)
    })

    it('uses the new counter attack multiplier', () => {
        const attacker = makeGotchi({ id: 100, defense: 10 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            attack: 100,
            defense: 10,
            health: 1000,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.5, // counter succeeds
            0.9, // counter attack is not a crit
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(COUNTER_ATTACK_MULTIPLIER).to.equal(0.25)
        expect(result.additionalEffects[0].damage).to.equal(250)
        expect(attacker.health).to.equal(750)
    })

    it('applies crit damage when a counter attack crits', () => {
        const attacker = makeGotchi({ id: 100, defense: 10 })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            attack: 100,
            defense: 10,
            health: 1000,
            fullHealth: 500,
            criticalRate: 100,
            criticalDamage: 50,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.5, // counter succeeds
            0.01, // counter attack crits
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.additionalEffects).to.have.length(1)
        expect(result.additionalEffects[0]).to.include({
            target: attacker.id,
            source: defender.id,
            damage: 375,
            outcome: 'counter',
            critical: true,
        })
        expect(defender.stats.counters).to.equal(1)
        expect(defender.stats.crits).to.equal(1)
        expect(attacker.health).to.equal(625)
    })

    it('still applies auto-attack status side effects when counter reduces damage', () => {
        const attacker = makeGotchi({
            id: 100,
            attack: 100,
            focus: 0,
            statuses: ['slowing_strike'],
        })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            defense: 10,
            resist: 0,
            health: 1000,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const rng = makeRng([
            0, // target selection
            0.9, // incoming hit is not a crit
            0.5, // counter succeeds
            0.1, // slowing_strike effect chance succeeds
            0.1, // focus check succeeds
            0.9, // counter attack is not a crit
        ])

        const result = attack(attacker, attackingTeam, defendingTeam, rng, false)

        expect(result.actionEffects[0].damage).to.equal(213)
        expect(result.actionEffects[0].statuses).to.deep.equal(['spd_down'])
        expect(defender.statuses).to.deep.equal(['counter', 'spd_down'])
        expect(result.additionalEffects[0].outcome).to.equal('counter')
    })

    it('does not reduce damage or retaliate against direct damaging specials', () => {
        const attacker = makeGotchi({
            id: 100,
            attack: 100,
            specialExpanded: {
                code: 'direct_special',
                name: 'Direct Special',
                initialCooldown: 0,
                cooldown: 1,
                actionType: 'attack',
                actionMultiplier: 1,
                target: 'enemy_random',
                effects: [],
            },
        })
        const defender = makeGotchi({
            id: 200,
            speed: 20,
            defense: 10,
            health: 300,
            fullHealth: 500,
            statuses: ['counter'],
        })

        const attackingTeam = makeTeam({ front: [attacker] })
        const defendingTeam = makeTeam({ front: [defender] })
        const result = attack(attacker, attackingTeam, defendingTeam, () => 0.9, true)

        expect(result.actionEffects[0].damage).to.equal(1000)
        expect(defender.health).to.equal(0)
        expect(result.additionalEffects).to.deep.equal([])
        expect(defender.stats.counters).to.equal(0)
        expect(attacker.health).to.equal(attacker.fullHealth)
    })
})
