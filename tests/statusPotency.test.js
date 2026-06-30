const { expect } = require('chai')
const path = require('path')

const constants = require(path.join('..', 'game-logic', 'constants'))
const statuses = require(path.join('..', 'game-logic', 'statuses.json'))
const { attack, gameLoop } = require(path.join('..', 'game-logic', 'index'))
const createBattleInputFromLog = require(path.join('..', 'game-logic', 'replay'))
const { StartingStateSchema } = require(path.join('..', 'schemas', 'ingameteam'))
const { buildStartingStateFromLog } = require(path.join('..', 'game-logic', 'carry-state'))
const {
    getStatusByCode,
    initializeStatusInstances,
    applyStatus,
    getSerializableStatusInstances,
    getStatusInstancePotency
} = require(path.join('..', 'game-logic', 'status-store'))
const {
    getModifiedStats,
    getStatusPotencyResult
} = require(path.join('..', 'game-logic', 'helpers'))

const makeStats = () => ({
    hits: 0,
    crits: 0,
    dmgGiven: 0,
    dmgReceived: 0,
    counters: 0,
    focuses: 0,
    resists: 0,
    healGiven: 0,
    healReceived: 0
})

const makeGotchi = (overrides = {}) => ({
    id: 1,
    name: 'Test',
    speed: 10,
    attack: 10,
    defense: 10,
    criticalRate: 0,
    criticalDamage: 50,
    resist: 0,
    focus: 0,
    statuses: [],
    environmentEffects: [],
    health: 100,
    fullHealth: 100,
    stats: makeStats(),
    special: { initialCooldown: 0 },
    specialExpanded: {
        code: 'potency_test',
        actionType: 'none',
        target: 'self',
        actionMultiplier: null,
        effects: []
    },
    ...overrides
})

const makeTeam = ({ front = [], back = [] } = {}) => ({
    leader: front[0]?.id ?? back[0]?.id ?? 1,
    formation: { front, back }
})

const makeBattleGotchi = (id, overrides = {}) => {
    const gotchiClass = overrides.gotchiClass || 'ninja'

    return {
        id,
        onchainId: id,
        name: `G${id}`,
        type: 'gotchi',
        visualCode: 'test-visual',
        level: 1,
        gotchiClass,
        speed: 10,
        health: 100,
        attack: 10,
        defense: 10,
        criticalRate: 0,
        criticalDamage: 50,
        resist: 0,
        focus: 0,
        special: 'basic_strike',
        leaderSkill: 'no_op',
        item: null,
        crystalSlot1: null,
        crystalSlot2: null,
        crystalSlot3: null,
        crystalSlot4: null,
        crystalSlot5: null,
        crystalSlot6: null,
        specialExpanded: {
            code: 'basic_strike',
            name: 'Basic Strike',
            initialCooldown: 6,
            cooldown: 1,
            actionType: 'attack',
            actionMultiplier: 1,
            monstersOnly: false,
            gotchiClass,
            target: 'enemy_random',
            effects: []
        },
        leaderSkillExpanded: {
            code: 'no_op',
            name: 'No Op',
            description: 'No passive statuses',
            monstersOnly: false,
            gotchiClass,
            statuses: []
        },
        ...overrides
    }
}

const makeBattleTeam = (leaderId, gotchis, overrides = {}) => ({
    name: 'T',
    owner: '0x0000000000000000000000000000000000000000',
    leader: leaderId,
    formation: {
        front: [
            gotchis[0] || null,
            gotchis[1] || null,
            gotchis[2] || null,
            gotchis[3] || null,
            gotchis[4] || null
        ],
        back: [
            gotchis[5] || null,
            gotchis[6] || null,
            gotchis[7] || null,
            gotchis[8] || null,
            gotchis[9] || null
        ]
    },
    ...overrides
})

const sequenceRng = (values) => {
    let index = 0
    const rng = () => {
        if (index >= values.length) {
            throw new Error(`Unexpected RNG call ${index + 1}`)
        }

        const value = values[index]
        index += 1
        return value
    }
    rng.calls = () => index
    return rng
}

const getStatusMaxStack = (statusCode) => getStatusByCode(statusCode).maxStack || constants.DEFAULT_MAX_STATUSES

const makeStatusRequests = (statusCode, count) => {
    return Array.from({ length: count }, () => ({
        code: statusCode,
        source: { kind: 'special', code: 'old', gotchiId: 1 },
        removable: true,
        remainingSubjectTurns: null
    }))
}

describe('status potency v2', () => {
    it('marks every authored status with explicit potency eligibility', () => {
        const enabledCodes = [
            'spd_up',
            'atk_up',
            'def_up',
            'crt_up',
            'crd_up',
            'res_up',
            'foc_up',
            'spd_down',
            'atk_down',
            'def_down',
            'crt_down',
            'crd_down',
            'res_down',
            'foc_down',
            'regenerate',
            'bleed'
        ]

        expect(statuses.filter(status => status.potencyEnabled).map(status => status.code))
            .to.have.members(enabledCodes)
        statuses.forEach(status => {
            expect(status.potencyEnabled, status.code).to.be.a('boolean')
        })
    })

    it('normalizes legacy, missing, and invalid potency to baseline', () => {
        const legacyGotchi = makeGotchi()
        initializeStatusInstances(legacyGotchi, ['def_up'])
        expect(getSerializableStatusInstances(legacyGotchi)[0]).not.to.have.property('potency')

        const richState = StartingStateSchema.parse({
            id: 1,
            health: 100,
            statuses: [{
                code: 'def_up',
                source: { kind: 'special', code: 'guard', gotchiId: 1 },
                removable: true,
                remainingSubjectTurns: null,
                potency: Number.NaN
            }]
        })
        const richGotchi = makeGotchi()
        initializeStatusInstances(richGotchi, richState.statuses)

        expect(getSerializableStatusInstances(richGotchi)[0]).not.to.have.property('potency')
        expect(getModifiedStats(richGotchi).defense).to.equal(11)
    })

    it('applies potency to percent, negative, and flat stat modifiers', () => {
        const buffed = makeGotchi()
        initializeStatusInstances(buffed, [{
            code: 'def_up',
            source: { kind: 'special', code: 'guard', gotchiId: 1 },
            removable: true,
            remainingSubjectTurns: null,
            potency: 1.5
        }])
        expect(getModifiedStats(buffed).defense).to.equal(11.5)

        const debuffed = makeGotchi()
        initializeStatusInstances(debuffed, [{
            code: 'def_down',
            source: { kind: 'special', code: 'shred', gotchiId: 2 },
            removable: true,
            remainingSubjectTurns: null,
            potency: 1.5
        }])
        expect(getModifiedStats(debuffed).defense).to.equal(8.5)

        const flat = makeGotchi({ resist: 10 })
        initializeStatusInstances(flat, [{
            code: 'res_up',
            source: { kind: 'special', code: 'aim', gotchiId: 1 },
            removable: true,
            remainingSubjectTurns: null,
            potency: 1.5
        }])
        expect(getModifiedStats(flat).resist).to.equal(25)
    })

    it('rounds potency-adjusted turn effects to the nearest integer', () => {
        const subject = makeBattleGotchi(1, { speed: 100, health: 100, attack: 1 })
        const enemy = makeBattleGotchi(2, { speed: 1, health: 100, attack: 1 })

        const logs = gameLoop(
            makeBattleTeam(1, [subject], {
                startingState: [{
                    id: 1,
                    health: 100,
                    statuses: [{
                        code: 'bleed',
                        source: { kind: 'special', code: 'cut', gotchiId: 2 },
                        removable: true,
                        remainingSubjectTurns: null,
                        potency: 1.4
                    }]
                }]
            }),
            makeBattleTeam(2, [enemy]),
            'status-potency-turn-effect',
            { disableLeaderMechanics: true }
        )

        expect(logs.turns[0].statusEffects).to.deep.include({
            target: 1,
            status: 'bleed',
            damage: 7,
            remove: false
        })
    })

    it('keeps zero-Focus friendly buffs at baseline regardless of target Resistance', () => {
        const caster = makeGotchi({
            resist: 100,
            specialExpanded: {
                code: 'guard',
                actionType: 'none',
                target: 'self',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 }]
            }
        })
        const rng = sequenceRng([0.9, 0.9])

        attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [makeGotchi({ id: 2 })] }), rng, true)

        expect(caster.statusInstances[0]).not.to.have.property('potency')
        expect(getModifiedStats(caster).defense).to.equal(11)
    })

    it('uses caster Focus only for friendly buff potency', () => {
        const ally = makeGotchi({ id: 2, resist: 999 })
        const caster = makeGotchi({
            focus: 30,
            specialExpanded: {
                code: 'guard',
                actionType: 'none',
                target: 'ally_random',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 }]
            }
        })
        const rng = sequenceRng([0, 0.9, 0.9])

        attack(caster, makeTeam({ front: [caster, ally] }), makeTeam({ front: [makeGotchi({ id: 3 })] }), rng, true)

        expect(ally.statusInstances[0].potency).to.equal(1.2)
        expect(getModifiedStats(ally).defense).to.equal(11.2)
    })

    it('keeps hostile status potency on the v1 Focus/Resistance formula', () => {
        const caster = makeGotchi({ focus: 30 })
        const target = makeGotchi({ id: 2, resist: 10 })

        const result = getStatusPotencyResult(caster, target, () => 0.9)

        expect(result).to.deep.equal({
            potency: 1.4,
            statusCrit: false
        })
    })

    it('preserves hostile Focus/Resistance application before rolling potency', () => {
        const caster = makeGotchi({
            id: 1,
            specialExpanded: {
                code: 'hex',
                actionType: 'none',
                target: 'all_enemies',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'atk_down', target: 'same_as_attack', chance: 1 }]
            }
        })
        const target = makeGotchi({ id: 2 })
        const rng = sequenceRng([0.9, 0.9])

        const result = attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [target] }), rng, true)

        expect(rng.calls()).to.equal(2)
        expect(target.statusInstances || []).to.deep.equal([])
        expect(result.actionEffects[0].statuses).to.deep.equal([])
    })

    it('still uses target Resistance in potency when skipFocusCheck bypasses pass/fail resistance', () => {
        const caster = makeGotchi({
            id: 1,
            focus: 10,
            specialExpanded: {
                code: 'sure_hex',
                actionType: 'none',
                target: 'all_enemies',
                actionMultiplier: null,
                effects: [{
                    effectType: 'status',
                    status: 'atk_down',
                    target: 'same_as_attack',
                    chance: 1,
                    skipFocusCheck: true
                }]
            }
        })
        const target = makeGotchi({ id: 2, resist: 20 })
        const rng = sequenceRng([0.9, 0.9])

        attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [target] }), rng, true)

        expect(target.statusInstances[0]).not.to.have.property('potency')
    })

    it('uses status crit chance and critical damage, then increments the crit counter', () => {
        const caster = makeGotchi({
            id: 1,
            criticalRate: 100,
            criticalDamage: 50,
            specialExpanded: {
                code: 'precise_guard',
                actionType: 'none',
                target: 'self',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 }]
            }
        })
        const rng = sequenceRng([0.9, 0.9])

        attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [makeGotchi({ id: 2 })] }), rng, true)

        expect(caster.statusInstances[0].potency).to.equal(1 + (50 / constants.STATUS_CRIT_DAMAGE_COEFFICIENT))
        expect(caster.stats.crits).to.equal(1)
    })

    it('uses fixed baseline potency for friendly harmful statuses without rolling status crits', () => {
        const caster = makeGotchi({
            id: 1,
            focus: 100,
            criticalRate: 100,
            criticalDamage: 200,
            specialExpanded: {
                code: 'risky_guard',
                actionType: 'none',
                target: 'self',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'spd_down', target: 'same_as_attack', chance: 1 }]
            }
        })
        const rng = sequenceRng([0.9])

        attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [makeGotchi({ id: 2 })] }), rng, true)

        expect(rng.calls()).to.equal(1)
        expect(caster.statusInstances[0]).not.to.have.property('potency')
        expect(getModifiedStats(caster).speed).to.equal(9)
        expect(caster.stats.crits).to.equal(0)
    })

    it('caps status potency at the maximum', () => {
        const caster = makeGotchi({ focus: 100, criticalRate: 100, criticalDamage: 200 })
        const target = makeGotchi({ id: 2 })

        expect(getStatusPotencyResult(caster, target, () => 0).potency).to.equal(1.75)
    })

    it('does not roll potency for behavior statuses or failed stack-cap applications', () => {
        const caster = makeGotchi({
            specialExpanded: {
                code: 'taunt_test',
                actionType: 'none',
                target: 'self',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'taunt', target: 'same_as_attack', chance: 1 }]
            }
        })
        const behaviorRng = sequenceRng([0.9])
        attack(caster, makeTeam({ front: [caster] }), makeTeam({ front: [makeGotchi({ id: 2 })] }), behaviorRng, true)
        expect(caster.statusInstances[0]).not.to.have.property('potency')

        const capped = makeGotchi({
            specialExpanded: {
                code: 'guard',
                actionType: 'none',
                target: 'self',
                actionMultiplier: null,
                effects: [{ effectType: 'status', status: 'def_up', target: 'same_as_attack', chance: 1 }]
            }
        })
        const maxStack = getStatusMaxStack('def_up')
        initializeStatusInstances(capped, makeStatusRequests('def_up', maxStack))
        const cappedRng = sequenceRng([0.9])
        attack(capped, makeTeam({ front: [capped] }), makeTeam({ front: [makeGotchi({ id: 2 })] }), cappedRng, true)
        expect(capped.statusInstances).to.have.length(maxStack)
    })

    it('keeps auto-attack proc-applied statuses at baseline potency', () => {
        const attacker = makeGotchi({ id: 1, criticalRate: 100, focus: 100 })
        const target = makeGotchi({ id: 2, health: 100 })
        initializeStatusInstances(attacker, [{
            code: 'empowering_strike',
            source: { kind: 'special', code: 'setup', gotchiId: 1 },
            removable: true,
            remainingSubjectTurns: null
        }])

        attack(attacker, makeTeam({ front: [attacker] }), makeTeam({ front: [target] }), () => 0, false)

        const gainedStatus = attacker.statusInstances.find(instance => instance.code === 'atk_up')
        expect(gainedStatus).not.to.have.property('potency')
    })

    it('preserves non-baseline potency in sequential carry state', () => {
        const startingState = buildStartingStateFromLog({
            result: {
                winningTeam: [{
                    id: 1,
                    health: 80,
                    specialBar: 30,
                    statuses: ['def_up'],
                    statusInstances: [{
                        code: 'def_up',
                        source: { kind: 'special', code: 'guard', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: 1,
                        potency: 1.32
                    }]
                }]
            }
        })

        expect(startingState[0].statuses[0].potency).to.equal(1.32)
    })

    it('preserves potency when preparing replay input from an existing battle log', () => {
        const subject = makeBattleGotchi(1, { attack: 100 })
        const enemy = makeBattleGotchi(2, { health: 10 })
        const logs = gameLoop(
            makeBattleTeam(1, [subject], {
                startingState: [{
                    id: 1,
                    health: 100,
                    statuses: [{
                        code: 'def_up',
                        source: { kind: 'special', code: 'guard', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: null,
                        potency: 1.32
                    }]
                }]
            }),
            makeBattleTeam(2, [enemy]),
            'status-potency-replay',
            { disableLeaderMechanics: true }
        )

        const replayInput = createBattleInputFromLog(logs, { mode: 'prepared' })
        const replayLogs = gameLoop(replayInput.team1, replayInput.team2, replayInput.seed, replayInput.options)

        expect(replayInput.team1.startingState[0].statuses[0].potency).to.equal(1.32)
        expect(replayLogs.gotchis.find(gotchi => gotchi.id === 1).statusInstances[0].potency).to.equal(1.32)
    })

    it('defaults omitted potencyEnabled to false at runtime', () => {
        expect(getStatusInstancePotency({ code: 'custom_status' }, { potency: 1.5 })).to.equal(1)
        expect(getStatusInstancePotency(getStatusByCode('fear'), { code: 'fear', potency: 1.5 })).to.equal(1)
    })

    it('omits baseline potency when applying a status directly', () => {
        const gotchi = makeGotchi()
        initializeStatusInstances(gotchi)

        applyStatus(gotchi, {
            code: 'def_up',
            source: { kind: 'special', code: 'guard', gotchiId: 1 },
            potency: null
        })

        expect(getSerializableStatusInstances(gotchi)[0]).not.to.have.property('potency')
    })
})
