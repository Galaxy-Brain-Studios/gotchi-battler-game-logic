const AUTO_ATTACK_MULTIPLIER = 0.85
const COUNTER_ATTACK_MULTIPLIER = 0.3
const SPEED_COUNTER_COEFFICIENT = 100

const DEFAULT_MAX_STATUSES = 3

const FOC_RES_COEFFICIENT = 100
const HEALER_HEAL_PENALTY = 0.5

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

const LEADER_FLAT_BONUS_STATS = ['criticalRate', 'criticalDamage', 'resist', 'focus']

// Leader mechanics (non-status, non-dispellable).
// Most values are fractional percents (e.g. 0.05 = +5%).
// criticalRate, criticalDamage, resist, and focus are flat adds.
const LEADER_CARRY_BONUS_BY_STAT = {
    speed: 0.05,
    health: 0.05,
    criticalRate: 10,
    defense: 0.05,
    criticalDamage: 10,
    resist: 10,
    focus: 10,
    attack: 0.05
}

// Used only for the leader's specialty stat.
// Most values are fractional percents of leader snapshot stat.
// criticalRate, criticalDamage, resist, and focus are flat adds.
const LEADER_AURA_BONUS_BY_STAT = {
    speed: 0.05,
    health: 0.05,
    criticalRate: 5,
    defense: 0.05,
    criticalDamage: 5,
    resist: 5,
    focus: 5,
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
    SPEED_COUNTER_COEFFICIENT,
    DEFAULT_MAX_STATUSES,
    FOC_RES_COEFFICIENT,
    HEALER_HEAL_PENALTY,
    LEADER_STATS,
    LEADER_FLAT_BONUS_STATS,
    LEADER_CARRY_BONUS_BY_STAT,
    LEADER_AURA_BONUS_BY_STAT,
    CLASS_SPECIALTY_STAT
}

