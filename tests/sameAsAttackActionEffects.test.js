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

describe('special: actionType none + same_as_attack effects', () => {
    it('logs successful same_as_attack status effects in actionEffects (not additionalEffects)', () => {
        const attacker = makeGotchi({
            id: 100,
            focus: 0,
            specialExpanded: {
                actionType: 'none',
                target: 'enemy_row_largest',
                actionMultiplier: null,
                effects: [
                    { effectType: 'status', status: 'foc_down', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'spd_down', target: 'same_as_attack', chance: 1 },
                ],
            },
        })

        const enemies = [1, 2, 3, 4, 5].map((n) =>
            makeGotchi({
                id: 200 + n,
                name: `Enemy ${n}`,
                resist: 0,
            })
        )

        const attackingTeam = makeTeam({ front: [attacker], back: [] })
        const defendingTeam = makeTeam({ front: enemies, back: [] })

        // rng=0.1:
        // - crit rolls: 0.1 > 0.05 => no crit
        // - focus checks: 0.1 < 0.5 => success
        const rng = () => 0.1

        const result = attack(attacker, attackingTeam, defendingTeam, rng, true)

        expect(result.actionEffects).to.have.length(5)
        expect(result.actionEffects.map((e) => e.target)).to.have.members(enemies.map((e) => e.id))
        result.actionEffects.forEach((e) => {
            expect(e.damage).to.equal(null)
            expect(e.outcome).to.equal('success')
            expect(e.statuses).to.deep.equal(['foc_down', 'spd_down'])
        })

        expect(result.additionalEffects).to.deep.equal([])
    })

    it('still produces actionEffects targets even when all same_as_attack statuses are resisted', () => {
        const attacker = makeGotchi({
            id: 100,
            focus: 0,
            specialExpanded: {
                actionType: 'none',
                target: 'enemy_row_largest',
                actionMultiplier: null,
                effects: [
                    { effectType: 'status', status: 'foc_down', target: 'same_as_attack', chance: 1 },
                    { effectType: 'status', status: 'spd_down', target: 'same_as_attack', chance: 1 },
                ],
            },
        })

        const enemies = [1, 2, 3, 4, 5].map((n) =>
            makeGotchi({
                id: 200 + n,
                name: `Enemy ${n}`,
                resist: 0,
            })
        )

        const attackingTeam = makeTeam({ front: [attacker], back: [] })
        const defendingTeam = makeTeam({ front: enemies, back: [] })

        // rng=0.9:
        // - crit rolls: 0.9 > 0.05 => no crit
        // - focus checks: 0.9 > 0.5 => resisted
        const rng = () => 0.9

        const result = attack(attacker, attackingTeam, defendingTeam, rng, true)

        expect(result.actionEffects).to.have.length(5)
        expect(result.actionEffects.map((e) => e.target)).to.have.members(enemies.map((e) => e.id))
        result.actionEffects.forEach((e) => {
            expect(e.damage).to.equal(null)
            expect(e.outcome).to.equal('success')
            expect(e.statuses).to.deep.equal([])
        })

        // 2 resisted status attempts per target => 10 additionalEffects
        expect(result.additionalEffects).to.have.length(10)
        result.additionalEffects.forEach((e) => {
            expect(e.outcome).to.equal('resisted')
            expect(e.damage).to.equal(null)
        })
    })
})


