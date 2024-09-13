const PASSIVES = ['sharp_blades', 'cloud_of_zen', 'frenzy', 'fortify', 'spread_the_fear', 'cleansing_aura', 'channel_the_coven', 'clan_momentum']
const DEBUFF_STATUSES = ['bleed', 'stun']
const BUFF_STATUSES = ['taunt']

const BUFF_MULT_EFFECTS = {
    power_up_1: {
        magic: 0.2,
        physical: 0.15
    },
    power_up_2: {
        crit: 0.5,
        magic: 0.6,
        physical: 0.4
    },
    fortify: {
        armor: 1
    },
    taunt: {
        armor: 0.4
    }
}

const BUFF_FLAT_EFFECTS = {
    fortify: {
        armor: 80
    },
    frenzy: {
        crit: 20
    }
}

// Combine all buffs
const BUFFS = [...PASSIVES, ...BUFF_STATUSES, ...Object.keys(BUFF_MULT_EFFECTS), ...Object.keys(BUFF_FLAT_EFFECTS)]

const DEBUFF_MULT_EFFECTS = {

}

const DEBUFF_FLAT_EFFECTS = {

}

// Combine all debuffs
const DEBUFFS = [...DEBUFF_STATUSES, ...Object.keys(DEBUFF_MULT_EFFECTS), ...Object.keys(DEBUFF_FLAT_EFFECTS)]

const MULTS = {
    FRONT_ROW_PHY_ATK: 1.1,
    FRONT_ROW_PHY_DEF: 0.9,
    EXPIRE_LEADERSKILL: 0,
    SPEED_PENALTY: 2.5,
    MAX_STATUSES: 3,
    CRIT_MULTIPLIER_FAST: 1.8,
    CRIT_MULTIPLIER_SLOW: 1.8,
    FORTIFY_COUNTER_CHANCE: 20,
    COUNTER_CHANCE_MIN: 0,
    COUNTER_SPEED_BONUS: 20,
    COUNTER_DAMAGE: 1.4,
    SHARP_BLADES_BLEED_CHANCE: 1,
    BLEED_DAMAGE: 8,
    SPECTRAL_STRIKE_DAMAGE: 1.3,
    CLEAVE_DAMAGE: 1.05,
    CURSE_DAMAGE: 1.5,
    CURSE_SPEED_PENALTY: 0,
    SPREAD_THE_FEAR_CHANCE: 1,
    SPREAD_THE_FEAR_SPEED_PENALTY: 0.15,
    BLESSING_HEAL: 5,
    BLESSING_HEAL_SPEED_PENALTY: 2,
    CLEANSING_AURA_HEAL: 7,
    BLESSING_HEAL_CRIT_MULTIPLIER: 1.3,
    CLEANSING_AURA_REGEN: 1,
    CLEANSING_AURA_NON_HEALER_REGEN: 10,
    THUNDER_DAMAGE_SLOW: 1,
    THUNDER_DAMAGE_FAST: 0.8,
    CHANNEL_THE_COVEN_CRIT_MULTIPLIER: 1.4,
    CHANNEL_THE_COVEN_DAMAGE_CHANCE: 0.75,
    CHANNEL_THE_COVEN_DAMAGE_SLOW: 1,
    CHANNEL_THE_COVEN_DAMAGE_FAST: 0.8,
    DEVESTATING_SMASH_DAMAGE: 3.2,
    DEVESTATING_SMASH_SPEED_PENALTY: 2.5,
    CLAN_MOMENTUM_DAMAGE: 3.2
}

const passiveIcons = {
    'sharp_blades': 'https://game-icons.net/1x1/lorc/plain-dagger.html',
    'cloud_of_zen': 'https://game-icons.net/1x1/lorc/meditation.html',
    'frenzy': 'https://game-icons.net/1x1/lorc/totem-head.html',
    'fortify': 'https://game-icons.net/1x1/lorc/crenulated-shield.html',
    'spread_the_fear': 'https://game-icons.net/1x1/lorc/evil-book.html',
    'cleansing_aura': 'https://game-icons.net/1x1/lorc/aura.html',
    'channel_the_coven': 'https://game-icons.net/1x1/lorc/witch-flight.html',
    'clan_momentum': 'https://game-icons.net/1x1/delapouite/bully-minion.html'
}

const debuffIcons = {
    'bleed': 'https://game-icons.net/1x1/lorc/broken-heart.html',
    'stun': 'https://game-icons.net/1x1/sbed/electric.html',
    'fear': 'https://game-icons.net/1x1/lorc/screaming.html'
}

const buffIcons = {
    'taunt': 'https://game-icons.net/1x1/lorc/archery-target.html',
    'power_up_1': 'https://game-icons.net/1x1/lorc/strong.html',
    'power_up_2': 'https://game-icons.net/1x1/delapouite/mighty-force.html'
}

module.exports = {
    PASSIVES,
    DEBUFF_STATUSES,
    BUFF_STATUSES,
    BUFF_MULT_EFFECTS,
    BUFF_FLAT_EFFECTS,
    BUFFS,
    DEBUFF_MULT_EFFECTS,
    DEBUFF_FLAT_EFFECTS,
    DEBUFFS,
    MULTS
}

// node services/game-logic/constants.js
if (require.main === module) {
    console.log("Buffs", BUFFS)
    console.log("Debuffs", DEBUFFS)
    process.exit(0)
}