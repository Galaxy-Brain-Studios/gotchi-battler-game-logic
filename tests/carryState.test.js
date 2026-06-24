const { expect } = require('chai')
const path = require('path')

const { InGameTeamSchema } = require(path.join('..', 'schemas', 'ingameteam'))
const { gameLoop } = require(path.join('..', 'game-logic', 'index'))
const { prepareBattle } = require(path.join('..', 'game-logic', 'helpers'))
const createBattleInputFromLog = require(path.join('..', 'game-logic', 'replay'))
const { buildStartingStateFromLog } = require('..')

const makeGotchi = (id, overrides = {}) => {
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

const makeTeam = (leaderId, gotchis, overrides = {}) => ({
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

const makeItem = (stat, statValue) => ({
    code: `item_${stat}`,
    name: `Item ${stat}`,
    description: 'Test item',
    image: 'test.png',
    rarity: 'common',
    stat,
    statValue
})

const makeCrystal = (slot, stat, statValue) => ({
    code: `crystal_${slot}_${stat}`,
    name: `Crystal ${slot} ${stat}`,
    slot,
    rarity: 'common',
    stat,
    statValue
})

describe('carry-state battle preparation', () => {
    it('defaults omitted statuses and keeps normal initial specialBar when omitted', () => {
        const team1 = InGameTeamSchema.parse(makeTeam(1, [
            makeGotchi(1, {
                specialExpanded: {
                    code: 'basic_strike',
                    name: 'Basic Strike',
                    initialCooldown: 3,
                    cooldown: 1,
                    actionType: 'attack',
                    actionMultiplier: 1,
                    monstersOnly: false,
                    gotchiClass: 'ninja',
                    target: 'enemy_random',
                    effects: []
                }
            })
        ], {
            startingState: [{ id: 1, health: 75 }]
        }))
        const team2 = InGameTeamSchema.parse(makeTeam(2, [makeGotchi(2)]))
        prepareBattle(team1, team2, { disableLeaderMechanics: true })

        const gotchi = team1.formation.front[0]
        expect(gotchi.health).to.equal(75)
        expect(gotchi.statuses).to.deep.equal([])
        expect(gotchi.specialBar).to.equal(50)
    })

    it('carries dead units from the full team and includes them in the winning result', () => {
        const livingAlly = makeGotchi(1, { health: 300, attack: 500, speed: 10 })
        const carriedDeadAlly = makeGotchi(2, { health: 0, attack: 500, speed: 100 })
        const enemy = makeGotchi(3, { health: 20, attack: 1, speed: 100 })

        const logs = gameLoop(
            makeTeam(1, [livingAlly, carriedDeadAlly], {
                startingState: [{ id: 2, health: 0, specialBar: 150 }]
            }),
            makeTeam(3, [enemy]),
            'carry-dead-full-team'
        )

        expect(logs.result.winner).to.equal(1)

        const carried = logs.result.winningTeam.find(gotchi => gotchi.id === 2)
        expect(carried).to.include({
            id: 2,
            name: 'G2',
            health: 0,
            specialBar: 100
        })
        expect(carried.statuses).to.deep.equal([])
        expect(carried.originalStats).to.include.keys([
            'speed',
            'attack',
            'defense',
            'criticalRate',
            'criticalDamage',
            'resist',
            'focus'
        ])
        expect(carried.modifiedStats).to.include.keys([
            'speed',
            'attack',
            'defense',
            'criticalRate',
            'criticalDamage',
            'resist',
            'focus'
        ])

        const turnUsers = logs.turns.map(turn => turn.action.user)
        expect(turnUsers).not.to.include(2)

        const targets = logs.turns.flatMap(turn => [
            ...turn.action.actionEffects.map(effect => effect.target),
            ...turn.action.additionalEffects.map(effect => effect.target),
            ...turn.statusEffects.map(effect => effect.target)
        ])
        expect(targets).not.to.include(2)
    })

    it('does not let a carried-dead leader apply carry or aura setup', () => {
        const deadLeader = makeGotchi(1, {
            gotchiClass: 'troll',
            attack: 100,
            health: 0
        })
        const livingAlly = makeGotchi(2, { health: 300, attack: 100 })
        const enemy = makeGotchi(3, { health: 20, attack: 1, speed: 100 })

        const logs = gameLoop(
            makeTeam(1, [deadLeader, livingAlly], {
                startingState: [{ id: 1, health: 0 }]
            }),
            makeTeam(3, [enemy]),
            'carry-dead-leader-no-setup'
        )

        const leader = logs.gotchis.find(gotchi => gotchi.id === 1)
        const ally = logs.gotchis.find(gotchi => gotchi.id === 2)

        expect(leader.health).to.equal(0)
        expect(leader.attack).to.equal(100)
        expect(ally.attack).to.equal(100)
        expect(logs.setup.statAdjustments.some(adjustment => {
            return [1, 2].includes(adjustment.id) && adjustment.src.startsWith('leader')
        })).to.equal(false)
    })

    it('clamps carried specialBar to the lower bound', () => {
        const livingAlly = makeGotchi(1, { health: 300, attack: 500, speed: 10 })
        const carriedDeadAlly = makeGotchi(2, { health: 0 })
        const enemy = makeGotchi(3, { health: 20, attack: 1, speed: 100 })

        const logs = gameLoop(
            makeTeam(1, [livingAlly, carriedDeadAlly], {
                startingState: [{ id: 2, health: 0, statuses: ['atk_up'], specialBar: -20 }]
            }),
            makeTeam(3, [enemy]),
            'carry-dead-special-lower-bound'
        )

        const carried = logs.result.winningTeam.find(gotchi => gotchi.id === 2)
        expect(carried.specialBar).to.equal(0)
        expect(carried.statuses).to.deep.equal(['atk_up'])
    })

    it('throws clearly for unknown startingState ids', () => {
        const team1 = makeTeam(1, [makeGotchi(1)], {
            startingState: [{ id: 999, health: 10 }]
        })
        const team2 = makeTeam(2, [makeGotchi(2)])

        expect(() => gameLoop(team1, team2, 'unknown-carry-state-id'))
            .to.throw('Gotchi with id 999 not found in team startingState')
    })

    it('logs compact setup stat adjustments', () => {
        const leader = makeGotchi(1, {
            gotchiClass: 'troll',
            attack: 100,
            health: 300,
            item: 'item_attack',
            itemExpanded: makeItem('attack', 10),
            crystalSlot1: 'crystal_attack',
            crystalSlot1Expanded: makeCrystal(1, 'attack', 5)
        })
        const ally = makeGotchi(2, { attack: 10, health: 300 })
        const enemy = makeGotchi(3, { health: 20, attack: 1, speed: 100 })

        const logs = gameLoop(
            makeTeam(1, [leader, ally]),
            makeTeam(3, [enemy]),
            'carry-state-setup-adjustments'
        )

        expect(logs.setup.statAdjustments).to.deep.include({
            id: 1,
            src: 'item',
            stat: 'attack',
            value: 10
        })
        expect(logs.setup.statAdjustments).to.deep.include({
            id: 1,
            src: 'crystal:1',
            stat: 'attack',
            value: 5
        })
        expect(logs.setup.statAdjustments).to.deep.include({
            id: 1,
            src: 'leader:carry',
            stat: 'attack',
            value: 3.5
        })
        expect(logs.setup.statAdjustments).to.deep.include({
            id: 2,
            src: 'leader:aura',
            from: 1,
            stat: 'attack',
            value: 3.5
        })
    })

    it('omits empty setup metadata when there are no setup stat adjustments', () => {
        const logs = gameLoop(
            makeTeam(1, [makeGotchi(1, { attack: 200 })]),
            makeTeam(2, [makeGotchi(2, { health: 20 })]),
            'carry-state-no-setup-deltas',
            { disableLeaderMechanics: true }
        )

        expect(logs).not.to.have.property('setup')
    })

    it('rebuilds dungeon battles from the base snapshot without double-applying setup bonuses', () => {
        const playerTeamSnapshot = makeTeam(1, [
            makeGotchi(1, {
                gotchiClass: 'troll',
                attack: 100,
                health: 300,
                item: 'item_attack',
                itemExpanded: makeItem('attack', 10),
                crystalSlot1: 'crystal_attack',
                crystalSlot1Expanded: makeCrystal(1, 'attack', 5)
            }),
            makeGotchi(2, { attack: 10, health: 300 })
        ])

        const firstLogs = gameLoop(
            playerTeamSnapshot,
            makeTeam(3, [makeGotchi(3, { health: 20, attack: 1, speed: 100 })]),
            'dungeon-flow-1'
        )

        const secondLogs = gameLoop(
            {
                ...playerTeamSnapshot,
                startingState: buildStartingStateFromLog(firstLogs)
            },
            makeTeam(4, [makeGotchi(4, { health: 20, attack: 1, speed: 100 })]),
            'dungeon-flow-2'
        )

        expect(playerTeamSnapshot.formation.front[0].attack).to.equal(100)
        expect(firstLogs.gotchis.find(gotchi => gotchi.id === 1).attack).to.equal(118.5)
        expect(secondLogs.gotchis.find(gotchi => gotchi.id === 1).attack).to.equal(118.5)
    })

    it('does not reapply leader passive statuses when startingState exists', () => {
        const leader = makeGotchi(1, {
            leaderSkillExpanded: {
                code: 'test_passive',
                name: 'Test Passive',
                description: 'Adds attack up',
                monstersOnly: false,
                gotchiClass: 'ninja',
                statuses: [
                    {
                        stackCount: 1,
                        leaderSkill: 'test_passive',
                        status: 'atk_up'
                    }
                ]
            }
        })
        const ally = makeGotchi(2)
        const enemy = makeGotchi(3, { health: 20, attack: 1, speed: 100 })

        const logs = gameLoop(
            makeTeam(1, [leader, ally], {
                startingState: [
                    { id: 1, health: 100, statuses: [] },
                    { id: 2, health: 100, statuses: [] }
                ]
            }),
            makeTeam(3, [enemy]),
            'carry-state-no-passive-reapply'
        )

        expect(logs.gotchis.find(gotchi => gotchi.id === 1).statuses).to.deep.equal([])
        expect(logs.gotchis.find(gotchi => gotchi.id === 2).statuses).to.deep.equal([])
    })

    it('emits rich status instances in battle-start and winning-team state', () => {
        const leader = makeGotchi(1, {
            attack: 100,
            leaderSkill: 'test_passive',
            leaderSkillExpanded: {
                code: 'test_passive',
                name: 'Test Passive',
                description: 'Protected team buff',
                monstersOnly: false,
                gotchiClass: 'ninja',
                statuses: [{ leaderSkill: 'test_passive', status: 'atk_up', stackCount: 1 }]
            }
        })
        const enemy = makeGotchi(2, { health: 10, attack: 1, speed: 100 })

        const logs = gameLoop(makeTeam(1, [leader]), makeTeam(2, [enemy]), 'rich-status-log')
        const startLeader = logs.gotchis.find(gotchi => gotchi.id === 1)
        const winningLeader = logs.result.winningTeam.find(gotchi => gotchi.id === 1)

        expect(startLeader.statuses).to.deep.equal(['atk_up'])
        expect(startLeader.statusInstances[0]).to.include({
            code: 'atk_up',
            removable: false,
            remainingSubjectTurns: null
        })
        expect(startLeader.statusInstances[0].source).to.deep.equal({ kind: 'leader_skill', code: 'test_passive', gotchiId: 1 })
        expect(winningLeader.statuses).to.deep.equal(['atk_up'])
        expect(winningLeader.statusInstances[0]).to.include({
            code: 'atk_up',
            removable: false,
            remainingSubjectTurns: null
        })
        expect(winningLeader.statusInstances[0].source).to.deep.equal({ kind: 'leader_skill', code: 'test_passive', gotchiId: 1 })

        const replayInput = createBattleInputFromLog(logs, { mode: 'prepared' })
        expect(replayInput.team1.startingState[0].statuses[0]).to.include({
            code: 'atk_up',
            removable: false,
            remainingSubjectTurns: null
        })
        expect(replayInput.team1.startingState[0].statuses[0].source).to.deep.equal({
            kind: 'leader_skill',
            code: 'test_passive',
            gotchiId: 1
        })

        const sequentialState = buildStartingStateFromLog(logs)
        expect(sequentialState[0].statuses[0].source).to.deep.equal({
            kind: 'leader_skill',
            code: 'test_passive',
            gotchiId: 1
        })

        sequentialState[0].statuses[0].source.kind = 'legacy'
        expect(winningLeader.statusInstances[0].source.kind).to.equal('leader_skill')
    })

    it('requires rich v5 status instances when building sequential starting state', () => {
        expect(() => buildStartingStateFromLog({
            result: {
                winningTeam: [{ id: 1, health: 100, statuses: ['atk_up'], specialBar: 0 }]
            }
        })).to.throw('requires v5 statusInstances')
    })

    it('expires a duration-one self buff after the caster completes its next turn', () => {
        const caster = makeGotchi(1, {
            speed: 100,
            attack: 100,
            specialExpanded: {
                code: 'timed_guard',
                name: 'Timed Guard',
                initialCooldown: 0,
                cooldown: 6,
                actionType: 'none',
                actionMultiplier: null,
                monstersOnly: false,
                gotchiClass: 'ninja',
                target: 'self',
                effects: [{
                    effectType: 'status',
                    value: null,
                    chance: 1,
                    special: null,
                    target: 'same_as_attack',
                    status: 'def_up',
                    durationTurns: 1
                }]
            }
        })
        const enemy = makeGotchi(2, { health: 50, attack: 1, speed: 1 })

        const logs = gameLoop(makeTeam(1, [caster]), makeTeam(2, [enemy]), 'timed-self-buff')
        const casterTurns = logs.turns.filter(turn => turn.action.user === 1)

        expect(casterTurns[0].action.name).to.equal('timed_guard')
        expect(casterTurns[0].action.actionEffects[0].statuses).to.deep.equal(['def_up'])
        expect(casterTurns[0].statusesExpired).to.deep.equal([])
        expect(casterTurns[1].statusesExpired).to.deep.equal([{ target: 1, status: 'def_up' }])
    })

    it('advances a timed status after a status-caused skipped turn', () => {
        const caster = makeGotchi(1, { speed: 100, attack: 100 })
        const enemy = makeGotchi(2, { health: 50, attack: 1, speed: 1 })

        const logs = gameLoop(
            makeTeam(1, [caster], {
                startingState: [{
                    id: 1,
                    health: 100,
                    statuses: [{
                        code: 'def_up',
                        source: { kind: 'special', code: 'timed_guard', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: 1
                    }, {
                        code: 'fear',
                        source: { kind: 'special', code: 'terror', gotchiId: 2 },
                        removable: true,
                        remainingSubjectTurns: null
                    }]
                }]
            }),
            makeTeam(2, [enemy]),
            'timed-skip-turn'
        )

        const skippedTurn = logs.turns.find(turn => turn.action.user === 1)
        expect(skippedTurn.skipTurn).to.equal('fear')
        expect(skippedTurn.statusesExpired).to.deep.equal([{ target: 1, status: 'def_up' }])
    })

    it('does not advance a timed status when its subject dies during start-of-turn effects', () => {
        const subject = makeGotchi(1, { health: 5, speed: 100, attack: 1 })
        const ally = makeGotchi(2, { health: 100, speed: 10, attack: 100 })
        const enemy = makeGotchi(3, { health: 10, speed: 1, attack: 1 })

        const logs = gameLoop(
            makeTeam(1, [subject, ally], {
                startingState: [{
                    id: 1,
                    health: 5,
                    statuses: [{
                        code: 'bleed',
                        source: { kind: 'special', code: 'wounding_strike', gotchiId: 3 },
                        removable: true,
                        remainingSubjectTurns: null
                    }, {
                        code: 'def_up',
                        source: { kind: 'special', code: 'timed_guard', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: 1
                    }]
                }]
            }),
            makeTeam(3, [enemy]),
            'timed-status-subject-dies-pre-action'
        )

        const deathTurn = logs.turns.find(turn => turn.action.user === 1)
        const carriedSubject = logs.result.winningTeam.find(gotchi => gotchi.id === 1)

        expect(deathTurn.skipTurn).to.equal('attacker_dead')
        expect(deathTurn.statusesExpired).to.deep.equal([])
        expect(carriedSubject.statusInstances.find(instance => instance.code === 'def_up').remainingSubjectTurns).to.equal(1)
    })

    it('does not advance a timed status when pre-action effects defeat the opposing team', () => {
        const subject = makeGotchi(1, { speed: 100, attack: 100 })
        const enemy = makeGotchi(2, { health: 5, speed: 1, attack: 1 })

        const logs = gameLoop(
            makeTeam(1, [subject], {
                startingState: [{
                    id: 1,
                    health: 100,
                    statuses: [{
                        code: 'def_up',
                        source: { kind: 'special', code: 'timed_guard', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: 1
                    }]
                }]
            }),
            makeTeam(2, [enemy], {
                startingState: [{
                    id: 2,
                    health: 5,
                    statuses: [{
                        code: 'bleed',
                        source: { kind: 'special', code: 'wounding_strike', gotchiId: 1 },
                        removable: true,
                        remainingSubjectTurns: null
                    }]
                }]
            }),
            'timed-status-opponent-dies-pre-action'
        )

        const preActionWinTurn = logs.turns.find(turn => turn.action.user === 1)
        const winner = logs.result.winningTeam.find(gotchi => gotchi.id === 1)

        expect(preActionWinTurn.skipTurn).to.equal('team_dead')
        expect(preActionWinTurn.statusesExpired).to.deep.equal([])
        expect(winner.statusInstances.find(instance => instance.code === 'def_up').remainingSubjectTurns).to.equal(1)
    })

    it('keeps status-instance ordering deterministic for the same seed, excluding the log timestamp', () => {
        const run = () => {
            const leader = makeGotchi(1, {
                attack: 100,
                leaderSkill: 'test_passive',
                leaderSkillExpanded: {
                    code: 'test_passive',
                    name: 'Test Passive',
                    description: 'Protected team buff',
                    monstersOnly: false,
                    gotchiClass: 'ninja',
                    statuses: [{ leaderSkill: 'test_passive', status: 'atk_up', stackCount: 1 }]
                }
            })
            const enemy = makeGotchi(2, { health: 10, attack: 1, speed: 100 })
            const logs = gameLoop(makeTeam(1, [leader]), makeTeam(2, [enemy]), 'status-order-stable')
            const meta = { ...logs.meta }
            delete meta.timestamp

            return { ...logs, meta }
        }

        expect(run()).to.deep.equal(run())
    })
})
