const { expect } = require('chai')
const path = require('path')

const { attack } = require(path.join('..', 'game-logic', 'v2.0', 'index'))

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

const makeTeam = (gotchis) => ({
    leader: gotchis[0]?.id ?? 1,
    formation: {
        front: gotchis.slice(0, 3),
        back: gotchis.slice(3, 5),
    },
})

describe('repeat_attack special effect', () => {
    it('rolls repeat_attack chance once per special use (not once per target)', () => {
        const attacker = makeGotchi({
            id: 100,
            specialExpanded: {
                actionType: 'attack',
                target: 'all_enemies',
                actionMultiplier: 0.5,
                effects: [
                    { effectType: 'repeat_attack', target: 'same_as_attack', chance: 0.5 },
                ],
            },
        })

        const enemies = [1, 2, 3, 4, 5].map((n) =>
            makeGotchi({
                id: 200 + n,
                name: `Enemy ${n}`,
                stats: makeStats(),
                health: 1000,
                fullHealth: 1000,
                environmentEffects: [],
            })
        )

        const attackingTeam = makeTeam([attacker])
        const defendingTeam = makeTeam(enemies)

        // RNG sequence:
        // - 1 repeat_attack roll (once per special use): 0.6 (fail for chance=0.5)
        // - 5 crit rolls (one per target): 0.9 (no crit)
        const seq = [
            0.6,
            0.9, 0.9, 0.9, 0.9, 0.9,
        ]
        let i = 0
        const rng = () => {
            if (i >= seq.length) return 0.99
            return seq[i++]
        }

        const result = attack(attacker, attackingTeam, defendingTeam, rng, true)
        expect(result.repeatAttack).to.equal(false)
    })
})


