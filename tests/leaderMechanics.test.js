const { expect } = require('chai')
const path = require('path')

const constants = require(path.join('..', 'game-logic', 'constants'))
const {
    gameLoop
} = require(path.join('..', 'game-logic', 'index'))
const {
    initLeaderMechanicsForTeam,
    syncLeaderAura
} = require(path.join('..', 'game-logic', 'helpers'))

const makeGotchi = (id, gotchiClass, overrides = {}) => ({
    id,
    onchainId: id,
    name: `G${id}`,
    type: 'gotchi',
    visualCode: 'test-visual',
    level: 1,
    gotchiClass,
    // base stats (engine model: health int, others 0.1-precision)
    speed: 10,
    health: 100,
    attack: 10,
    defense: 5,
    criticalRate: 10,
    criticalDamage: 50,
    resist: 5,
    focus: 5,
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
})

const makeTeam = (leaderId, gotchis) => ({
    name: 'T',
    owner: '0x0000000000000000000000000000000000000000',
    leader: leaderId,
    formation: {
        front: [gotchis[0] || null, gotchis[1] || null, gotchis[2] || null, gotchis[3] || null, gotchis[4] || null],
        back: [gotchis[5] || null, gotchis[6] || null, gotchis[7] || null, gotchis[8] || null, gotchis[9] || null],
    }
})

describe('Leader mechanics (carry + aura)', () => {
    const originalCarry = { ...constants.LEADER_CARRY_BONUS_BY_STAT }
    const originalAura = { ...constants.LEADER_AURA_BONUS_BY_STAT }

    beforeEach(() => {
        // Reset tables to a known baseline for deterministic tests.
        Object.keys(constants.LEADER_CARRY_BONUS_BY_STAT).forEach((k) => { delete constants.LEADER_CARRY_BONUS_BY_STAT[k] })
        Object.keys(constants.LEADER_AURA_BONUS_BY_STAT).forEach((k) => { delete constants.LEADER_AURA_BONUS_BY_STAT[k] })
    })

    afterEach(() => {
        // Restore original tables.
        Object.keys(constants.LEADER_CARRY_BONUS_BY_STAT).forEach((k) => { delete constants.LEADER_CARRY_BONUS_BY_STAT[k] })
        Object.assign(constants.LEADER_CARRY_BONUS_BY_STAT, originalCarry)

        Object.keys(constants.LEADER_AURA_BONUS_BY_STAT).forEach((k) => { delete constants.LEADER_AURA_BONUS_BY_STAT[k] })
        Object.assign(constants.LEADER_AURA_BONUS_BY_STAT, originalAura)
    })

    it('leader identity matters at turn 0 (same units, different leader)', () => {
        // Make only aura matter, and only for attack stat (troll specialty).
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.1 // +10% of leader attack snapshot

        const troll = makeGotchi(1, 'troll', { attack: 50 })
        const ninja = makeGotchi(2, 'ninja', { attack: 20 })

        const teamTrollLeader = makeTeam(1, [troll, ninja])
        initLeaderMechanicsForTeam(teamTrollLeader)
        // Ninja (non-leader ally) gets +5 attack
        expect(ninja.attack).to.equal(25)

        // Reset gotchis for second team (same base units)
        const troll2 = makeGotchi(1, 'troll', { attack: 50 })
        const ninja2 = makeGotchi(2, 'ninja', { attack: 20 })
        const teamNinjaLeader = makeTeam(2, [troll2, ninja2])
        initLeaderMechanicsForTeam(teamNinjaLeader)
        // Troll (non-leader ally) does not get attack aura because ninja specialty is speed
        expect(troll2.attack).to.equal(50)
    })

    it('uses the pre-carry snapshot for aura amount', () => {
        // Troll specialty is attack.
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0.5 // +50% carry
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.1 // +10% aura of snapshot

        const leader = makeGotchi(1, 'troll', { attack: 100 })
        const ally = makeGotchi(2, 'ninja', { attack: 0 })

        const team = makeTeam(1, [leader, ally])
        initLeaderMechanicsForTeam(team)

        // Aura should be based on 100, not 150.
        expect(ally.attack).to.equal(10)
        // Carry should still apply to leader itself.
        expect(leader.attack).to.equal(150)
    })

    it('uses flat carry and aura values for crit, crit damage, resist, and focus', () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.criticalRate = 5
        constants.LEADER_CARRY_BONUS_BY_STAT.criticalDamage = 12
        constants.LEADER_CARRY_BONUS_BY_STAT.resist = 7
        constants.LEADER_CARRY_BONUS_BY_STAT.focus = 9
        constants.LEADER_AURA_BONUS_BY_STAT.criticalRate = 6
        constants.LEADER_AURA_BONUS_BY_STAT.criticalDamage = 15
        constants.LEADER_AURA_BONUS_BY_STAT.resist = 4
        constants.LEADER_AURA_BONUS_BY_STAT.focus = 8

        const cleaverLeader = makeGotchi(1, 'cleaver', { criticalRate: 20, criticalDamage: 80, resist: 10, focus: 11 })
        const critAlly = makeGotchi(2, 'ninja', { criticalRate: 3 })
        initLeaderMechanicsForTeam(makeTeam(1, [cleaverLeader, critAlly]))
        expect(cleaverLeader.criticalRate).to.equal(25)
        expect(cleaverLeader.criticalDamage).to.equal(92)
        expect(cleaverLeader.resist).to.equal(17)
        expect(cleaverLeader.focus).to.equal(20)
        expect(critAlly.criticalRate).to.equal(9)

        const cursedLeader = makeGotchi(3, 'cursed', { criticalDamage: 80 })
        const critDamageAlly = makeGotchi(4, 'ninja', { criticalDamage: 50 })
        initLeaderMechanicsForTeam(makeTeam(3, [cursedLeader, critDamageAlly]))
        expect(critDamageAlly.criticalDamage).to.equal(65)

        const healerLeader = makeGotchi(5, 'healer', { resist: 10 })
        const resistAlly = makeGotchi(6, 'ninja', { resist: 2 })
        initLeaderMechanicsForTeam(makeTeam(5, [healerLeader, resistAlly]))
        expect(resistAlly.resist).to.equal(6)

        const mageLeader = makeGotchi(7, 'mage', { focus: 11 })
        const focusAlly = makeGotchi(8, 'ninja', { focus: 1 })
        initLeaderMechanicsForTeam(makeTeam(7, [mageLeader, focusAlly]))
        expect(focusAlly.focus).to.equal(9)
    })

    it('removes aura immediately when leader dies', () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.1

        const leader = makeGotchi(1, 'troll', { attack: 40, health: 10 })
        const ally = makeGotchi(2, 'ninja', { attack: 0 })
        const team = makeTeam(1, [leader, ally])

        initLeaderMechanicsForTeam(team)
        expect(ally.attack).to.equal(4)

        leader.health = 0
        syncLeaderAura(team)
        expect(ally.attack).to.equal(0)
    })

    it('health aura (enlightened) is a battle-start blessing and is not removed mid-battle', () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.health = 0
        constants.LEADER_AURA_BONUS_BY_STAT.health = 0.1

        const leader = makeGotchi(1, 'enlightened', { health: 100 })
        const ally = makeGotchi(2, 'ninja', { health: 100 })
        const team = makeTeam(1, [leader, ally])

        initLeaderMechanicsForTeam(team)

        // Pre-init, health represents base/max health.
        expect(ally.health).to.equal(110)

        // Simulate battle init behavior where fullHealth is set.
        ally.fullHealth = ally.health

        // Lock like prepareTeams() does, then kill leader and sync.
        team.__leaderMechanics.locked = true
        leader.health = 0
        syncLeaderAura(team)

        // No removal mid-battle (no max HP shrink, no HP cap-down).
        expect(ally.fullHealth).to.equal(110)
        expect(ally.health).to.equal(110)
    })

    it('is not dispellable (status removal does not affect carry/aura)', () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.1

        const leader = makeGotchi(1, 'troll', { attack: 30 })
        const ally = makeGotchi(2, 'ninja', { attack: 0, statuses: ['atk_up', 'def_up'] })
        const team = makeTeam(1, [leader, ally])

        initLeaderMechanicsForTeam(team)
        expect(ally.attack).to.equal(3)

        // Simulate a dispel-like effect that removes buffs by stripping statuses.
        ally.statuses = []

        // Aura remains because it is not represented as statuses.
        expect(ally.attack).to.equal(3)
    })

    it('gameLoop can disable leader carry and aura buffs', () => {
        constants.LEADER_CARRY_BONUS_BY_STAT.attack = 0.05
        constants.LEADER_AURA_BONUS_BY_STAT.attack = 0.05

        const makeBattleTeams = () => {
            const leader = makeGotchi(1, 'troll', { attack: 100, health: 150, speed: 20 })
            const ally = makeGotchi(2, 'ninja', { attack: 20, health: 150, speed: 15 })
            const enemy = makeGotchi(3, 'ninja', { attack: 5, health: 25, speed: 1 })

            return [
                makeTeam(1, [leader, ally]),
                makeTeam(3, [enemy])
            ]
        }

        const [team1WithLeaderBuffs, team2WithLeaderBuffs] = makeBattleTeams()
        const defaultLogs = gameLoop(team1WithLeaderBuffs, team2WithLeaderBuffs, 'leader-buffs-on')

        const [team1WithoutLeaderBuffs, team2WithoutLeaderBuffs] = makeBattleTeams()
        const disabledLogs = gameLoop(team1WithoutLeaderBuffs, team2WithoutLeaderBuffs, 'leader-buffs-off', {
            disableLeaderMechanics: true
        })

        const defaultLeader = defaultLogs.gotchis.find(gotchi => gotchi.id === 1)
        const defaultAlly = defaultLogs.gotchis.find(gotchi => gotchi.id === 2)
        const disabledLeader = disabledLogs.gotchis.find(gotchi => gotchi.id === 1)
        const disabledAlly = disabledLogs.gotchis.find(gotchi => gotchi.id === 2)

        expect(defaultLeader.attack).to.equal(105)
        expect(defaultAlly.attack).to.equal(25)
        expect(disabledLeader.attack).to.equal(100)
        expect(disabledAlly.attack).to.equal(20)
    })
})

