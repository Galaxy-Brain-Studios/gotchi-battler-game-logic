# Status Potency v1 Spec

## Motivation

The v3 balancing work surfaced a structural issue with Focus, Critical Rate, and Critical Damage:

- Focus is valuable when applying enemy statuses because the existing Focus/Resistance check can decide whether the status lands, but Focus has little value for friendly status effects because friendly applications currently always succeed.
- Critical Rate and Critical Damage are valuable for direct damage/healing rolls, but have little value for specials whose main impact is applying statuses.
- This makes those stats feel volatile: a Gotchi can feel excellent with one special and underpowered with another depending on whether that special happens to use the existing damage/heal crit path.

Status Potency v1 makes Focus, Critical Rate, and Critical Damage relevant to numeric status effects without changing targeting, duration, removability, leader-skill protection, or Unity-facing simple status strings.

## Design Summary

When a special applies a potency-enabled status, the created status instance receives a `potency` multiplier.

The multiplier is calculated per status instance from:

- caster Focus versus target Resistance;
- a status critical roll using caster Critical Rate;
- caster Critical Damage when that status critical roll succeeds.

The status instance keeps this potency value, and numeric effects from that status instance are multiplied by it when calculating modified stats or turn effects.

Example:

```js
{
  code: 'def_up',
  remainingSubjectTurns: 2,
  removable: true,
  potency: 1.45
}
```

If `def_up` normally gives `+10% DEF`, this instance gives `+14.5% DEF`.

## Status Eligibility

Potency eligibility must be data-driven from `game-logic/statuses.json`.

Add a boolean `potencyEnabled` field to status definitions:

```json
{
  "code": "def_up",
  "name": "Increase DEF",
  "category": "stat_modifier",
  "isBuff": true,
  "potencyEnabled": true,
  "statModifiers": [
    {
      "statName": "defense",
      "value": 10,
      "valueType": "percent"
    }
  ]
}
```

For behavioural statuses:

```json
{
  "code": "taunt",
  "name": "Taunt",
  "category": "targeting",
  "isBuff": true,
  "potencyEnabled": false
}
```

Rules:

- `potencyEnabled: true` means this status receives a potency roll when applied by a special and uses potency when applying numeric status effects.
- `potencyEnabled: false` means this status behaves as before and should use potency `1`.
- Omitted `potencyEnabled` defaults to `false`.
- The engine should not maintain a separate hardcoded list of potency-enabled status codes.
- `statuses.json` should add `potencyEnabled` to the appropriate statuses as part of this implementation.

### Recommended v1 potency-enabled statuses

Set `potencyEnabled: true` for direct numeric statuses:

- `spd_up`
- `atk_up`
- `def_up`
- `crt_up`
- `crd_up`
- `res_up`
- `foc_up`
- `spd_down`
- `atk_down`
- `def_down`
- `crt_down`
- `crd_down`
- `res_down`
- `foc_down`
- `regenerate`
- `bleed`

### Recommended v1 potency-disabled statuses

Set `potencyEnabled: false` for behavioural statuses and proc-style statuses:

- `taunt`
- `counter`
- `fear`
- attack-proc statuses such as `bleeding_strike`, `dispelling_strike`, `cleansing_strike`, and similar statuses whose effect is to later trigger another effect
- any pure targeting, skip-turn, control, or behaviour-only status

Proc-style statuses are intentionally excluded from v1 to avoid introducing second-order questions such as whether potency should increase the proc chance or the potency of the status applied by the proc.

## Formula

Add these constants:

```js
const STATUS_FOCUS_COEFFICIENT = 50
const STATUS_CRIT_DAMAGE_COEFFICIENT = 200
const STATUS_POTENCY_MIN = 1
const STATUS_POTENCY_MAX = 1.75
const STATUS_CRIT_RATE_MIN = 5
const STATUS_CRIT_RATE_MAX = 100
```

Potency formula:

```js
function getStatusPotencyMultiplier(caster, target, rng) {
  const casterStats = getModifiedStats(caster)
  const targetStats = getModifiedStats(target)

  const focusBonus =
    Math.max(0, casterStats.focus - targetStats.resist)
    / STATUS_FOCUS_COEFFICIENT

  const statusCritChance =
    clamp(casterStats.criticalRate, STATUS_CRIT_RATE_MIN, STATUS_CRIT_RATE_MAX)
    / 100

  const isStatusCrit = rng() < statusCritChance

  const critBonus = isStatusCrit
    ? casterStats.criticalDamage / STATUS_CRIT_DAMAGE_COEFFICIENT
    : 0

  return clamp(
    1 + focusBonus + critBonus,
    STATUS_POTENCY_MIN,
    STATUS_POTENCY_MAX
  )
}
```

Formula examples:

| Situation | Potency |
|---|---:|
| No Focus advantage, no status crit | `1.00x` |
| Focus beats Resistance by 5, no status crit | `1.10x` |
| Focus beats Resistance by 10, no status crit | `1.20x` |
| Focus beats Resistance by 15, no status crit | `1.30x` |
| Critical Damage 50 status crit, no Focus advantage | `1.25x` |
| Focus beats Resistance by 10 + Critical Damage 50 status crit | `1.45x` |
| Extreme result | capped at `1.75x` |

## Application Rules

### Per target, per status instance

Potency is rolled/calculated separately for each potency-enabled status instance applied.

Examples:

- `Enchant Armor` applies `def_up` to all allies. Each ally receives its own potency calculation and its own status crit roll.
- `Precise Shuriken` applies multiple `crt_up` and `crd_up` stacks to self. Each stack receives its own potency calculation and status crit roll.

If a status is not potency-enabled, do not consume a status crit RNG roll for it.

### Friendly status application

Friendly statuses should still always apply if their normal chance roll succeeds.

Focus/Resistance does not become a pass/fail check for friendly statuses in v1.

Instead:

- Focus beating Resistance increases potency.
- If Focus does not beat Resistance, potency receives no Focus bonus.
- Potency never falls below `1`.

This avoids the bad player experience of friendly buffs missing or becoming weaker than baseline.

### Enemy status application

Enemy status application should preserve current application rules.

The existing Focus/Resistance pass/fail check still happens first.

If the enemy status is resisted, no status instance is created and no potency matters.

If the enemy status lands and is potency-enabled, calculate potency for the created status instance using the same formula.

This means Focus helps enemy statuses in two ways:

1. improved chance to apply through the existing check;
2. improved potency when the status lands.

Resistance helps against enemy statuses in two ways:

1. improved chance to resist through the existing check;
2. reduced or eliminated Focus potency bonus if the status lands.

## Status Instance Shape

Status instances should support an optional numeric `potency` field:

```js
{
  code: 'def_up',
  source: {
    kind: 'special',
    code: 'enchant_armor',
    gotchiId: 123
  },
  removable: true,
  remainingSubjectTurns: 2,
  potency: 1.25
}
```

Rules:

- If `potency` is omitted, default to `1`.
- If `potency` is invalid, `null`, `NaN`, or non-finite, treat it as `1`.
- Clamp runtime potency to `[1, STATUS_POTENCY_MAX]`.
- Legacy string statuses normalize to potency `1`.
- Potency should be preserved on rich status instances when copied, carried, or replayed.

## Applying Potency to Status Effects

### Stat modifiers

Apply potency to the modifier value before applying the modifier to the stat.

Percent modifier example:

```txt
def_up value = +10%
potency = 1.25
effective modifier = +12.5%
```

Flat modifier example:

```txt
crt_up value = +10
potency = 1.25
effective modifier = +12.5
```

Negative modifier example:

```txt
def_down value = -10%
potency = 1.25
effective modifier = -12.5%
```

Potency increases the magnitude of both buffs and debuffs.

### Turn effects

Apply potency to numeric turn-effect values.

Example:

```txt
bleed damage = 5
potency = 1.4
effective bleed damage = 7
```

Rounding should follow the existing rounding behaviour for that effect type where possible. Apply potency before the existing rounding step.

## Logging and Unity Compatibility

Unity consumes simple status strings and should not require changes for v1.

Maintain existing simple string projections:

```js
gotchi.statuses = ['def_up', 'atk_up']
```

Rich status instances may include potency:

```js
gotchi.statusInstances = [
  { code: 'def_up', potency: 1.25 }
]
```

Do not alter existing Unity-facing fields that list simple status strings.

If low-risk, effect log entries may include optional debugging metadata:

```js
{
  target: 123,
  statuses: ['def_up'],
  outcome: 'success',
  potency: 1.25,
  statusCrit: true
}
```

This metadata is optional and must not replace or alter existing fields Unity relies on. If there is any Unity compatibility risk, keep potency only on `statusInstances`.

## Replay / Backward Compatibility

Old logs and old carry state may contain statuses as strings or rich objects without potency.

Those statuses should replay with potency `1`.

Replaying an old log on the new game-logic version is expected to produce the new-version outcome, not necessarily the original historical outcome.

Exact historical replay still requires using the game-logic version recorded in the log metadata.

## Carry State / Sequential Battles

When building starting state from a previous battle log, preserve potency on surviving status instances.

Example:

```js
{
  code: 'def_up',
  remainingSubjectTurns: 1,
  removable: true,
  potency: 1.32
}
```

If potency is missing from carried state, default to `1`.

This matters for Crystal Temple / dungeon-style sequential battles.

## Determinism

Status potency must be deterministic for a given seed and battle state.

Status crit rolls must use the existing seeded RNG, not `Math.random`.

The order of RNG calls should be stable and covered by tests:

- one status crit roll per created potency-enabled status instance;
- no status crit roll if the status does not apply;
- no status crit roll if the enemy status is resisted;
- no status crit roll for potency-disabled statuses such as `taunt`, `counter`, or `fear`.

## Tests

Add tests covering:

1. Legacy string status normalizes to potency `1`.
2. Rich status without potency normalizes to potency `1`.
3. `potencyEnabled` omitted defaults to `false`.
4. `statuses.json` enables potency for the intended direct numeric statuses.
5. `def_up` with potency `1.5` gives `+15% DEF`, not `+10% DEF`.
6. `def_down` with potency `1.5` gives `-15% DEF`, not `-10% DEF`.
7. Flat modifier statuses are multiplied by potency, e.g. `crt_up`.
8. Turn-effect statuses are multiplied by potency, e.g. `bleed` or `regenerate`.
9. Friendly status applies at baseline when Focus does not beat Resistance and no status crit occurs.
10. Friendly status gets Focus potency when Focus beats Resistance.
11. Enemy status still requires the existing Focus/Resistance application check.
12. Enemy status that is resisted does not roll or store potency.
13. Status crit uses Critical Rate and Critical Damage.
14. Status potency is capped at `STATUS_POTENCY_MAX`.
15. Behavioural statuses such as `taunt`, `counter`, and `fear` are unaffected.
16. Proc-style statuses are unaffected in v1.
17. Carry-state/replay preserves potency on status instances.
18. Existing simple `statuses` string projection is unchanged.

## Acceptance Criteria

- `statuses.json` owns potency eligibility through `potencyEnabled`.
- Existing statuses without potency behave as before.
- Existing battle logs remain Unity-compatible through simple string `statuses`.
- Numeric statuses can be stronger when applied by high-Focus/high-crit casters.
- Friendly buffs do not miss due to Focus/Resistance.
- Enemy debuffs preserve existing resistance behaviour.
- Sequential battle starting state preserves potency.
- Tests pass.
