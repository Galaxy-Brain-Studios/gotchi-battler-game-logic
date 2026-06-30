const AUTO_ATTACK_MULTIPLIER = 0.85
const COUNTER_HEALTH_TO_SPEED_RATIO = 45
const COUNTER_SCORE_THRESHOLD = 1.15
const COUNTER_CHANCE_SCALE = 4
const COUNTER_CHANCE_MIN = 0.02
const COUNTER_CHANCE_MAX = 0.75
const COUNTER_DAMAGE_REDUCTION = 0.5
const COUNTER_ATTACK_MULTIPLIER = 0.25

const DEFAULT_MAX_STATUSES = 9

const FOC_RES_COEFFICIENT = 100
const HEALER_HEAL_PENALTY = 0.5
const STATUS_FOCUS_COEFFICIENT = 50
const STATUS_FRIENDLY_FOCUS_COEFFICIENT = 150
const STATUS_FRIENDLY_FOCUS_MAX_BONUS = 0.35
const STATUS_CRIT_DAMAGE_COEFFICIENT = 100
const STATUS_POTENCY_MIN = 1
const STATUS_POTENCY_MAX = 1.75
const STATUS_CRIT_RATE_MIN = 5
const STATUS_CRIT_RATE_MAX = 100

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
    speed: 0.02,
    health: 0.05,
    criticalRate: 10,
    defense: 0.04,
    criticalDamage: 10,
    resist: 10,
    focus: 10,
    attack: 0.03
}

// Used only for the leader's specialty stat.
// Most values are fractional percents of leader snapshot stat.
// criticalRate, criticalDamage, resist, and focus are flat adds.
const LEADER_AURA_BONUS_BY_STAT = {
    speed: 0.02,
    health: 0.05,
    criticalRate: 5,
    defense: 0.04,
    criticalDamage: 5,
    resist: 5,
    focus: 5,
    attack: 0.03
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
    COUNTER_HEALTH_TO_SPEED_RATIO,
    COUNTER_SCORE_THRESHOLD,
    COUNTER_CHANCE_SCALE,
    COUNTER_CHANCE_MIN,
    COUNTER_CHANCE_MAX,
    COUNTER_DAMAGE_REDUCTION,
    COUNTER_ATTACK_MULTIPLIER,
    DEFAULT_MAX_STATUSES,
    FOC_RES_COEFFICIENT,
    HEALER_HEAL_PENALTY,
    STATUS_FOCUS_COEFFICIENT,
    STATUS_FRIENDLY_FOCUS_COEFFICIENT,
    STATUS_FRIENDLY_FOCUS_MAX_BONUS,
    STATUS_CRIT_DAMAGE_COEFFICIENT,
    STATUS_POTENCY_MIN,
    STATUS_POTENCY_MAX,
    STATUS_CRIT_RATE_MIN,
    STATUS_CRIT_RATE_MAX,
    LEADER_STATS,
    LEADER_FLAT_BONUS_STATS,
    LEADER_CARRY_BONUS_BY_STAT,
    LEADER_AURA_BONUS_BY_STAT,
    CLASS_SPECIALTY_STAT
}
