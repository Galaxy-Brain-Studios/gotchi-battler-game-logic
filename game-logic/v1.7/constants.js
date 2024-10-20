const PASSIVES = ['sharp_blades', 'cloud_of_zen', 'frenzy', 'fortify', 'spread_the_fear', 'cleansing_aura', 'channel_the_coven', 'clan_momentum']
const DEBUFF_STATUSES = ['bleed', 'stun', 'fear']
const BUFF_STATUSES = ['taunt']

const BUFF_MULT_EFFECTS = {
    power_up_1: {
        magic: 0.175,
        physical: 0.175
    },
    power_up_2: {
        crit: 0.4,
        resist: 0.4,
        magic: 0.4,
        physical: 0.4
    },
    frenzy: {
        crit: 1
    },
    fortify: {
        armor: 2.2
    },
    taunt: {
        armor: 2
    },
    channel_the_coven: {
        magic: 0.2
    },
    clan_momentum: {
        physical: 0.175
    }
}

const BUFF_FLAT_EFFECTS = {
    fortify: {
        armor: 100
    },
    frenzy: {
        crit: 15
    }
}

// Combine all buffs
const BUFFS = [...PASSIVES, ...BUFF_STATUSES, ...Object.keys(BUFF_MULT_EFFECTS), ...Object.keys(BUFF_FLAT_EFFECTS)]

const DEBUFF_MULT_EFFECTS = {
    fear: {
        resist: 0.5
    },
    stun: {
        speed: 0.2
    }
}

const DEBUFF_FLAT_EFFECTS = {
    
}

// Combine all debuffs
const DEBUFFS = [...DEBUFF_STATUSES, ...Object.keys(DEBUFF_MULT_EFFECTS), ...Object.keys(DEBUFF_FLAT_EFFECTS)]

const MULTS = {
    // General
    FRONT_ROW_PHY_ATK: 1.1,
    FRONT_ROW_PHY_DEF: 0.8,
    EXPIRE_LEADERSKILL: 0,
    SPEED_PENALTY: 2.5,
    MAX_STATUSES: 3,
    CRIT_MULTIPLIER_FAST: 1.8,
    CRIT_MULTIPLIER_SLOW: 1.8,
    // Ninja
    SHARP_BLADES_BLEED_CHANCE: 0.7,
    BLEED_DAMAGE: 10,
    SPECTRAL_STRIKE_DAMAGE: 1.5,
    // Enlightened
    // Cleaver
    CLEAVE_DAMAGE: 1.35,
    // Tank
    COUNTER_CHANCE_MIN: 20,
    FORTIFY_COUNTER_CHANCE: 20,
    COUNTER_DAMAGE: 1.5,
    // Cursed
    SPREAD_THE_FEAR_CHANCE: 0.9,
    SPREAD_THE_FEAR_SPEED_PENALTY: 0,
    CURSE_DAMAGE: 1,
    CURSE_HEAL: 1,
    CURSE_SPEED_PENALTY: 0,
    // Healer
    CLEANSING_AURA_REGEN: 0.45,
    CLEANSING_AURA_NON_HEALER_REGEN: 5,
    CLEANSING_AURA_HEAL: 3,
    CLEANSING_AURA_HEAL_SPEED_PENALTY: 1,
    BLESSING_HEAL: 2.5,
    BLESSING_HEAL_SPEED_PENALTY: 1,
    BLESSING_HEAL_CRIT_MULTIPLIER: 1.25,
    // Mage
    CHANNEL_THE_COVEN_STUN_CHANCE: 1,
    THUNDER_STUN_CHANCE: 0.3,
    THUNDER_DAMAGE: 0.6,
    // Troll
    CLAN_MOMENTUM_CHANCE: 0.4,
    DEVESTATING_SMASH_X2_CHANCE: 0.2,
    DEVESTATING_SMASH_DAMAGE: 1.8,
    DEVESTATING_SMASH_X2_DAMAGE: 0.8,
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