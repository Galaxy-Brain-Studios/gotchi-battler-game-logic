const { expect } = require('chai')
const path = require('path')

const { InGameTeamSchema } = require(path.join('..', 'schemas', 'ingameteam'))
const { gameLoop } = require(path.join('..', 'game-logic', 'index'))
const { prepareBattle } = require(path.join('..', 'game-logic', 'helpers'))

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

const toStartingState = (logs) => {
    return logs.result.winningTeam.map((gotchi) => ({
        id: gotchi.id,
        health: gotchi.health,
        statuses: Array.isArray(gotchi.statuses) ? gotchi.statuses : [],
        specialBar: Number.isFinite(Number(gotchi.specialBar)) ? Number(gotchi.specialBar) : 0
    }))
}

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
                startingState: toStartingState(firstLogs)
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
})
