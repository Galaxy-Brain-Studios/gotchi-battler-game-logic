const AUTO_ATTACK_MULTIPLIER = 0.85
const COUNTER_ATTACK_MULTIPLIER = 0.3

const DEFAULT_MAX_STATUSES = 9

const FOC_RES_COEFFICIENT = 20

const LEADER_STATS = [
    'speed',
    'health',
    'criticalRate',
    'defense',
    'criticalDamage',
    'resist',
    'focus',
    'attack'
]

// Leader mechanics (non-status, non-dispellable).
// Percent values are fractional (e.g. 0.05 = +5%).
const LEADER_CARRY_PCT_BY_STAT = {
    speed: 0.1,
    health: 0.1,
    criticalRate: 0.1,
    defense: 0.05,
    criticalDamage: 0.1,
    resist: 0.1,
    focus: 0.1,
    attack: 0.05
}

// Used only for the leader's specialty stat.
// Percent values are fractional (e.g. 0.10 = +10% of leader snapshot stat).
const LEADER_AURA_PCT_BY_STAT = {
    speed: 0.1,
    health: 0.05,
    criticalRate: 0.1,
    defense: 0.05,
    criticalDamage: 0.1,
    resist: 0.1,
    focus: 0.1,
    attack: 0.05
}

// Class -> specialty stat mapping.
// Class keys are normalized to lower-case.
const CLASS_SPECIALTY_STAT = {
    ninja: 'speed',
    enlightened: 'health',
    cleaver: 'criticalRate',
    tank: 'defense',
    cursed: 'criticalDamage',
    healer: 'resist',
    mage: 'focus',
    troll: 'attack'
}

module.exports = {
    AUTO_ATTACK_MULTIPLIER,
    COUNTER_ATTACK_MULTIPLIER,
    DEFAULT_MAX_STATUSES,
    FOC_RES_COEFFICIENT,
    LEADER_STATS,
    LEADER_CARRY_PCT_BY_STAT,
    LEADER_AURA_PCT_BY_STAT,
    CLASS_SPECIALTY_STAT
}

