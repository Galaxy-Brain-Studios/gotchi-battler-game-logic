const { expect } = require('chai')
const path = require('path')

const constants = require(path.join('..', 'game-logic', 'constants'))
const { gameLoop } = require(path.join('..', 'game-logic', 'index'))
const createBattleInputFromLog = require(path.join('..', 'game-logic', 'replay'))
const {
    rerunBattleFromLog,
    compareBattleWinRatesFromLog
} = require(path.join('..', 'scripts', 'rerunBattle'))

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

const makeTeam = (leaderId, gotchis) => ({
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
    }
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

describe('log rerun helpers', () => {
    const originalCarry = { ...constants.LEADER_CARRY_BONUS_BY_STAT }
    const originalAura = { ...constants.LEADER_AURA_BONUS_BY_STAT }

    beforeEach(() => {
        Object.keys(constants.LEADER_CARRY_BONUS_BY_STAT).forEach((key) => { delete constants.LEADER_CARRY_BONUS_BY_STAT[key] })
        Object.keys(constants.LEADER_AURA_BONUS_BY_STAT).forEach((key) => { delete constants.LEADER_AURA_BONUS_BY_STAT[key] })
    })

    afterEach(() => {
        Object.keys(constants.LEADER_CARRY_BONUS_BY_STAT).forEach((key) => { delete constants.LEADER_CARRY_BONUS_BY_STAT[key] })
        Object.assign(constants.LEADER_CARRY_BONUS_BY_STAT, originalCarry)

        Object.keys(constants.LEADER_AURA_BONUS_BY_STAT).forEach((key) => { delete constants.LEADER_AURA_BONUS_BY_STAT[key] })
        Object.assign(constants.LEADER_AURA_BONUS_BY_STAT, originalAura)
    })

    const createOldLog = () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0.1
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.2

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

        return gameLoop(
            makeTeam(1, [leader, ally]),
            makeTeam(3, [enemy]),
            'rerun-log-old-constants'
        )
    }

    it('uses prepared mode as the old battle-start stat baseline', () => {
        const oldLog = createOldLog()

        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0.5
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.5

        const { logs } = rerunBattleFromLog(oldLog, { mode: 'prepared' })
        const leader = logs.gotchis.find(gotchi => gotchi.id === 1)
        const ally = logs.gotchis.find(gotchi => gotchi.id === 2)

        expect(leader.attack).to.equal(126.5)
        expect(ally.attack).to.equal(33)
        expect(logs).not.to.have.property('setup')
    })

    it('rebases setup stats and reapplies current constants', () => {
        const oldLog = createOldLog()

        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0.2
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.1

        const { logs } = rerunBattleFromLog(oldLog, { mode: 'rebased' })
        const leader = logs.gotchis.find(gotchi => gotchi.id === 1)
        const ally = logs.gotchis.find(gotchi => gotchi.id === 2)

        expect(leader.attack).to.equal(138)
        expect(ally.attack).to.equal(21.5)
        expect(logs.setup.statAdjustments).to.deep.include({
            id: 1,
            src: 'leader:carry',
            stat: 'attack',
            value: 23
        })
    })

    it('throws clearly when rebasing a legacy log without setup stat adjustments', () => {
        const oldLog = createOldLog()
        delete oldLog.setup

        expect(() => createBattleInputFromLog(oldLog, { mode: 'rebased' }))
            .to.throw('Cannot rebase log without setup.statAdjustments')
    })

    it('compares prepared and rebased win rates over sampled seeds', () => {
        const oldLog = createOldLog()

        const summary = compareBattleWinRatesFromLog(oldLog, {
            n: 3,
            includeRuns: true
        })

        expect(summary.n).to.equal(3)
        expect(summary.runs).to.have.length(3)
        expect(summary.modes.prepared.available).to.equal(true)
        expect(summary.modes.rebased.available).to.equal(true)
        expect(summary.modes.prepared.team1WinRate + summary.modes.prepared.team2WinRate).to.equal(100)
        expect(summary.modes.rebased.team1WinRate + summary.modes.rebased.team2WinRate).to.equal(100)
    })
})
