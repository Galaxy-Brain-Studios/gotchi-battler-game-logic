const { expect } = require('chai')
const path = require('path')
const unityCompatibilityFixture = require(path.join(__dirname, 'fixtures', 'status-system-v3-unity-compatibility.json'))

const { StartingStateSchema } = require(path.join('..', 'schemas', 'ingameteam'))
const { EffectSchema } = require(path.join('..', 'schemas', 'effect'))
const { addLeaderToTeam } = require(path.join('..', 'game-logic', 'helpers'))
const { attack } = require(path.join('..', 'game-logic', 'index'))
const {
    initializeStatusInstances,
    getStatusByCode,
    getStatusCodes,
    getStatusInstances,
    applyStatus,
    removeStatusInstances,
    removeOneStatusInstance,
    consumeStatusInstance,
    expireStatusDurationsAfterTurn,
    getSerializableStatusInstances
} = require(path.join('..', 'game-logic', 'status-store'))

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

const makeGotchi = (id, overrides = {}) => ({
    id,
    name: `G${id}`,
    speed: 10,
    attack: 10,
    defense: 10,
    criticalRate: 0,
    criticalDamage: 50,
    resist: 0,
    focus: 0,
    health: 100,
    fullHealth: 100,
    statuses: [],
    environmentEffects: [],
    stats: makeStats(),
    special: { initialCooldown: 0 },
    specialExpanded: {
        code: 'test_special',
        actionType: 'none',
        target: 'enemy_random',
        actionMultiplier: null,
        effects: []
    },
    leaderSkillExpanded: {
        code: 'no_op',
        statuses: []
    },
    ...overrides
})

const makeTeam = (gotchis) => ({
    leader: gotchis[0].id,
    formation: { front: gotchis, back: [] }
})

describe('status system v3', () => {
    it('projects canonical instances in insertion order, including duplicate stacks', () => {
        const gotchi = makeGotchi(1)
        initializeStatusInstances(gotchi)

        applyStatus(gotchi, { code: 'atk_down', source: { kind: 'special', code: 'hex', gotchiId: 2 } })
        applyStatus(gotchi, { code: 'atk_down', source: { kind: 'special', code: 'hex', gotchiId: 2 } })
        applyStatus(gotchi, { code: 'regenerate', source: { kind: 'special', code: 'renew', gotchiId: 2 } })

        expect(getStatusCodes(gotchi)).to.deep.equal(['atk_down', 'atk_down', 'regenerate'])
        expect(getSerializableStatusInstances(gotchi).map(instance => instance.code))
            .to.deep.equal(['atk_down', 'atk_down', 'regenerate'])
    })

    it('keeps stack applications atomic at the cap and does not refresh existing durations', () => {
        const gotchi = makeGotchi(1)
        initializeStatusInstances(gotchi)

        expect(applyStatus(gotchi, {
            code: 'def_up',
            count: 2,
            durationTurns: 2,
            source: { kind: 'special', code: 'enchant_armor', gotchiId: 1 }
        }).applied).to.equal(true)

        expect(applyStatus(gotchi, {
            code: 'def_up',
            count: 2,
            durationTurns: 5,
            source: { kind: 'special', code: 'enchant_armor', gotchiId: 1 }
        }).applied).to.equal(false)

        expect(getStatusInstances(gotchi).map(instance => instance.remainingSubjectTurns)).to.deep.equal([2, 2])
    })

    it('normalizes legacy carry strings and validates rich carry instances', () => {
        const legacyState = StartingStateSchema.parse({ id: 1, health: 100, statuses: ['atk_up'] })
        const legacyGotchi = makeGotchi(1)
        initializeStatusInstances(legacyGotchi, legacyState.statuses)

        expect(getSerializableStatusInstances(legacyGotchi)).to.deep.equal([{
            code: 'atk_up',
            source: { kind: 'legacy', code: null, gotchiId: null },
            removable: true,
            remainingSubjectTurns: null
        }])

        const richState = StartingStateSchema.parse({
            id: 1,
            health: 100,
            statuses: [{
                code: 'def_up',
                source: { kind: 'special', code: 'enchant_armor', gotchiId: 2 },
                removable: true,
                remainingSubjectTurns: 2
            }]
        })
        const richGotchi = makeGotchi(1)
        initializeStatusInstances(richGotchi, richState.statuses)

        expect(getStatusCodes(richGotchi)).to.deep.equal(['def_up'])
        expect(getSerializableStatusInstances(richGotchi)[0].remainingSubjectTurns).to.equal(2)
        expect(applyStatus(richGotchi, {
            code: 'res_up',
            source: { kind: 'special', code: 'clarity', gotchiId: 1 }
        }).instances[0].code).to.equal('res_up')
        expect(() => StartingStateSchema.parse({
            id: 1,
            health: 100,
            statuses: [{
                code: 'def_up',
                source: { kind: 'special', code: 'enchant_armor', gotchiId: 2 },
                removable: true,
                remainingSubjectTurns: 0
            }]
        })).to.throw()
    })

    it('creates permanent protected Leader Skill instances that survive the leader dying', () => {
        const leader = makeGotchi(1, {
            leaderSkillExpanded: {
                code: 'brilliant_soul',
                statuses: [{ status: 'atk_down', stackCount: 2 }]
            }
        })
        const ally = makeGotchi(2)
        initializeStatusInstances(leader)
        initializeStatusInstances(ally)
        const team = makeTeam([leader, ally])

        addLeaderToTeam(team, true)
        leader.health = 0

        expect(getSerializableStatusInstances(ally)).to.deep.equal([
            {
                code: 'atk_down',
                source: { kind: 'leader_skill', code: 'brilliant_soul', gotchiId: 1 },
                removable: false,
                remainingSubjectTurns: null
            },
            {
                code: 'atk_down',
                source: { kind: 'leader_skill', code: 'brilliant_soul', gotchiId: 1 },
                removable: false,
                remainingSubjectTurns: null
            }
        ])
    })

    it('cleanses removable copies of a selected code without touching protected Leader Skill copies', () => {
        const attacker = makeGotchi(1, {
            specialExpanded: {
                code: 'immunize',
                actionType: 'none',
                target: 'enemy_random',
                actionMultiplier: null,
                effects: [{ effectType: 'remove_debuff', target: 'same_as_attack', chance: 1 }]
            }
        })
        const target = makeGotchi(2)
        initializeStatusInstances(attacker)
        initializeStatusInstances(target, [{
            code: 'atk_down',
            source: { kind: 'leader_skill', code: 'brilliant_soul', gotchiId: 9 },
            removable: false,
            remainingSubjectTurns: null
        }, {
            code: 'atk_down',
            source: { kind: 'special', code: 'weakening_blast', gotchiId: 3 },
            removable: true,
            remainingSubjectTurns: null
        }])

        const result = attack(attacker, makeTeam([attacker]), makeTeam([target]), () => 0, true)

        expect(getStatusCodes(target)).to.deep.equal(['atk_down'])
        expect(getSerializableStatusInstances(target)[0].source.kind).to.equal('leader_skill')
        expect(result.statusesExpired).to.deep.equal([{ target: 2, status: 'atk_down' }])
    })

    it('keeps protected instances through all-status external removal', () => {
        const gotchi = makeGotchi(1)
        initializeStatusInstances(gotchi, [{
            code: 'atk_down',
            source: { kind: 'leader_skill', code: 'brilliant_soul', gotchiId: 9 },
            removable: false,
            remainingSubjectTurns: null
        }, {
            code: 'fear',
            source: { kind: 'special', code: 'terror', gotchiId: 2 },
            removable: true,
            remainingSubjectTurns: null
        }])

        const removals = removeStatusInstances(
            gotchi,
            instance => !getStatusByCode(instance.code).isBuff
        )

        expect(removals.map(instance => instance.code)).to.deep.equal(['fear'])
        expect(getStatusCodes(gotchi)).to.deep.equal(['atk_down'])
    })

    it('expires timed stacks one at a time and lets self-consumption bypass external protection', () => {
        const gotchi = makeGotchi(1)
        initializeStatusInstances(gotchi)

        const selfApplication = applyStatus(gotchi, {
            code: 'def_up',
            durationTurns: 1,
            source: { kind: 'special', code: 'enchant_armor', gotchiId: 1 }
        })
        applyStatus(gotchi, {
            code: 'atk_down',
            durationTurns: 1,
            removable: false,
            source: { kind: 'leader_skill', code: 'temporary_test', gotchiId: 1 }
        })
        applyStatus(gotchi, {
            code: 'fear',
            removable: false,
            source: { kind: 'leader_skill', code: 'temporary_test', gotchiId: 1 }
        })

        const fearInstance = getStatusInstances(gotchi, instance => instance.code === 'fear')[0]
        expect(removeOneStatusInstance(gotchi, fearInstance)).to.equal(null)
        expect(consumeStatusInstance(gotchi, fearInstance)).to.equal(fearInstance)

        const firstExpiry = expireStatusDurationsAfterTurn(gotchi, {
            appliedThisSubjectTurnInstances: new Set(selfApplication.instances)
        })
        expect(firstExpiry.events).to.deep.equal([{ target: 1, status: 'atk_down' }])
        expect(getStatusCodes(gotchi)).to.deep.equal(['def_up'])

        const secondExpiry = expireStatusDurationsAfterTurn(gotchi)
        expect(secondExpiry.events).to.deep.equal([{ target: 1, status: 'def_up' }])
        expect(getStatusCodes(gotchi)).to.deep.equal([])
    })

    it('emits one expiry event for every stack that reaches zero together', () => {
        const gotchi = makeGotchi(1)
        initializeStatusInstances(gotchi)

        applyStatus(gotchi, {
            code: 'def_up',
            count: 2,
            durationTurns: 1,
            source: { kind: 'special', code: 'double_guard', gotchiId: 1 }
        })

        expect(expireStatusDurationsAfterTurn(gotchi).events).to.deep.equal([
            { target: 1, status: 'def_up' },
            { target: 1, status: 'def_up' }
        ])
        expect(getStatusCodes(gotchi)).to.deep.equal([])
    })

    it('accepts optional positive effect durations and rejects invalid ones', () => {
        const baseEffect = {
            effectType: 'status',
            value: null,
            special: null,
            target: 'self',
            status: 'def_up'
        }

        expect(EffectSchema.parse({ ...baseEffect, durationTurns: 2 }).durationTurns).to.equal(2)
        expect(EffectSchema.parse({ ...baseEffect, durationTurns: null }).durationTurns).to.equal(null)
        expect(() => EffectSchema.parse({ ...baseEffect, durationTurns: 0 })).to.throw()
    })

    it('keeps Unity-facing compatibility fixture status fields string-based alongside rich state', () => {
        const [gotchi] = unityCompatibilityFixture.gotchis
        const [turn] = unityCompatibilityFixture.turns
        const [winner] = unityCompatibilityFixture.result.winningTeam

        expect(gotchi.statuses).to.deep.equal(['atk_down', 'atk_down', 'regenerate'])
        expect(gotchi.statuses.every(status => typeof status === 'string')).to.equal(true)
        expect(turn.action.actionEffects[0].statuses.every(status => typeof status === 'string')).to.equal(true)
        expect(turn.statusesExpired[0].status).to.equal('regenerate')
        expect(winner.statuses.every(status => typeof status === 'string')).to.equal(true)
        expect(gotchi.statusInstances[0]).to.include.keys('code', 'source', 'removable', 'remainingSubjectTurns')
        expect(gotchi.statusInstances[0]).not.to.have.property('id')
    })
})
