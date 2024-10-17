const PASSIVES = ['sharp_blades', 'cloud_of_zen', 'frenzy', 'fortify', 'spread_the_fear', 'cleansing_aura', 'channel_the_coven', 'clan_momentum']
const DEBUFF_STATUSES = ['bleed', 'stun', 'fear']
const BUFF_STATUSES = ['taunt']

const BUFF_MULT_EFFECTS = {
    power_up_1: {
        magic: 0.15,
        physical: 0.15
    },
    power_up_2: {
        crit: 0.5,
        resist: 0.25,
        magic: 0.435,
        physical: 0.335
    },
    fortify: {
        armor: 1.5
    },
    taunt: {
        armor: 1
    }
}

const BUFF_FLAT_EFFECTS = {
    fortify: {
        armor: 80
    },
    frenzy: {
        crit: 23
    }
}

// Combine all buffs
const BUFFS = [...PASSIVES, ...BUFF_STATUSES, ...Object.keys(BUFF_MULT_EFFECTS), ...Object.keys(BUFF_FLAT_EFFECTS)]

const DEBUFF_MULT_EFFECTS = {
    fear: {
        resist: 0.5
    }
}

const DEBUFF_FLAT_EFFECTS = {
    
}

// Combine all debuffs
const DEBUFFS = [...DEBUFF_STATUSES, ...Object.keys(DEBUFF_MULT_EFFECTS), ...Object.keys(DEBUFF_FLAT_EFFECTS)]

const MULTS = {
    // General
    FRONT_ROW_PHY_ATK: 1.1,
    FRONT_ROW_PHY_DEF: 0.9,
    EXPIRE_LEADERSKILL: 0,
    SPEED_PENALTY: 2.5,
    MAX_STATUSES: 3,
    CRIT_MULTIPLIER_FAST: 1.8,
    CRIT_MULTIPLIER_SLOW: 1.8,
    // Ninja
    SHARP_BLADES_BLEED_CHANCE: 1,
    BLEED_DAMAGE: 9,
    SPECTRAL_STRIKE_DAMAGE: 1.1,
    // Enlightened
    // Cleaver
    CLEAVE_DAMAGE: 1.3,
    // Tank
    FORTIFY_COUNTER_CHANCE: 20,
    COUNTER_CHANCE_MIN: 40,
    COUNTER_SPEED_BONUS: 20,
    COUNTER_DAMAGE: 1.4,
    // Cursed
    SPREAD_THE_FEAR_CHANCE: 0.8,
    SPREAD_THE_FEAR_SPEED_PENALTY: 0,
    CURSE_DAMAGE: 1,
    CURSE_HEAL: 0.5,
    CURSE_SPEED_PENALTY: 0,
    // Healer
    CLEANSING_AURA_REGEN: 0.5,
    CLEANSING_AURA_NON_HEALER_REGEN: 10,
    CLEANSING_AURA_HEAL: 4,
    CLEANSING_AURA_HEAL_SPEED_PENALTY: 1,
    BLESSING_HEAL: 4,
    BLESSING_HEAL_SPEED_PENALTY: 1,
    BLESSING_HEAL_CRIT_MULTIPLIER: 1.25,
    // Mage
    CHANNEL_THE_COVEN_CRIT_MULTIPLIER: 1.4,
    CHANNEL_THE_COVEN_DAMAGE_SLOW: 1.1,
    CHANNEL_THE_COVEN_DAMAGE_FAST: 0.8,
    THUNDER_DAMAGE_SLOW: 1.15,
    THUNDER_DAMAGE_FAST: 0.95,
    THUNDER_CRIT_MULTIPLIER: 1.4,
    // Troll
    DEVESTATING_SMASH_DAMAGE: 2.2,
    DEVESTATING_SMASH_SPEED_PENALTY: 2.5,
    CLAN_MOMENTUM_DAMAGE: 2.5
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