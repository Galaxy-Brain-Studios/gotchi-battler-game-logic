const PASSIVES = ['sharp_blades', 'cloud_of_zen', 'frenzy', 'fortify', 'spread_the_fear', 'cleansing_aura', 'channel_the_coven', 'clan_momentum']
const DEBUFF_STATUSES = ['bleed', 'stun']
const BUFF_STATUSES = ['taunt']

const BUFF_MULT_EFFECTS = {
    power_up_1: {
        magic: 0.125,
        physical: 0.125
    },
    power_up_2: {
        crit: 0.5,
        magic: 0.425,
        physical: 0.425
    },
    fortify: {
        armor: 0.8
    },
    taunt: {
        armor: 0.4
    }
}

const BUFF_FLAT_EFFECTS = {
    fortify: {
        armor: 60
    },
    frenzy: {
        crit: 16
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
    COUNTER_CHANCE_MIN: 10,
    COUNTER_DAMAGE: 1.2,
    SHARP_BLADES_BLEED_CHANCE: 0.8,
    BLEED_DAMAGE: 7,
    SPECTRAL_STRIKE_DAMAGE: 1.4,
    CLEAVE_DAMAGE: 0.9,
    CURSE_DAMAGE: 1.5,
    CURSE_SPEED_PENALTY: 0,
    SPREAD_THE_FEAR_CHANCE: 0.9,
    SPREAD_THE_FEAR_SPEED_PENALTY: 0.4,
    BLESSING_HEAL: 4,
    BLESSING_HEAL_SPEED_PENALTY: 0,
    CLEANSING_AURA_HEAL: 6,
    BLESSING_HEAL_CRIT_MULTIPLIER: 1.5,
    CLEANSING_AURA_REGEN: 0.75,
    CLEANSING_AURA_NON_HEALER_REGEN: 7,
    THUNDER_DAMAGE_SLOW: 0.65,
    THUNDER_DAMAGE_FAST: 0.65,
    CHANNEL_THE_COVEN_DAMAGE_SLOW: 0.65,
    CHANNEL_THE_COVEN_DAMAGE_FAST: 0.45,
    DEVESTATING_SMASH_DAMAGE: 2.4,
    DEVESTATING_SMASH_SPEED_PENALTY: 2.5,
    CLAN_MOMENTUM_DAMAGE: 2.5
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
