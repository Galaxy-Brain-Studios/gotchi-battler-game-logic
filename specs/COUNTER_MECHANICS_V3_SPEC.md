# Counter Mechanics v3 Spec

Status: implementation-ready proposal  
Date: 2026-06-26

## Summary

Counter should become a build-identity mechanic for fast, lower-health Tanks rather than a generic defensive bonus that also works well on already-durable high-health Tanks.

The new Counter system should:

- make Counter chance depend on the countering Gotchi's own base speed-to-health profile;
- make high-health Tanks rarely Counter, even if they have the `counter` status;
- let successful Counters reduce incoming direct damage, so fast/low-health Tanks are not simply killed before they can use the status;
- keep the game-logic package standalone, with no dependency on the backend trait service, BRS formula, or trait-map constants.

This spec only covers game-logic behavior. Any data changes to `Fortress Stance`, `Warden Stance`, or other Specials are balance/content follow-ups.

## Motivation

Player feedback raised three related issues around Tank builds:

1. High-speed, low-health Tanks feel bad because they are still too squishy to function as Tanks.
2. Existing Counter chance buffs are not enough to make these fast Tanks reliable.
3. High-health Tanks become too powerful when they can both soak most incoming damage and Counter consistently.

The current Counter formula compares the target's modified speed to the attacker's modified speed:

```js
chance = clamp(
  0.5 + (counteringGotchi.speed - attackingGotchi.speed) / SPEED_COUNTER_COEFFICIENT,
  0.05,
  0.95
)
```

That has two problems:

- the `0.5` baseline means even slow high-health Tanks can Counter often;
- the attacker comparison makes Counter too matchup-dependent when what we really need is a build filter: fast Tanks should Counter, high-health Tanks should usually not.

The new system should instead ask: "Is this Gotchi speed-specialised enough, relative to its max health, to be a good Counter user?"

## Non-goals

- Do not import or duplicate the backend trait service inside game logic.
- Do not copy BRS base values, BRS-per-level values, or trait-map anchors into game logic.
- Do not rebalance Specials in this implementation.
- Do not introduce source-specific Counter profiles yet, such as different Counter formulas for different Specials.
- Do not require Unity log schema changes.

## Current behavior to replace

At the time of writing:

- Counter is checked after the target has already taken damage.
- The target must survive the full unreduced hit before it can Counter.
- Counter chance uses modified speed from both the defender and attacker.
- Counter does not reduce incoming damage.
- Counter attack damage uses `COUNTER_ATTACK_MULTIPLIER = 0.3`.

This makes Counter unreliable for fast/low-health Tanks and too available to high-health Tanks.

## New constants

Add or update the following constants in game logic:

```js
const COUNTER_HEALTH_TO_SPEED_RATIO = 45
const COUNTER_SCORE_THRESHOLD = 1.15
const COUNTER_CHANCE_SCALE = 4
const COUNTER_CHANCE_MIN = 0.02
const COUNTER_CHANCE_MAX = 0.75
const COUNTER_DAMAGE_REDUCTION = 0.75
const COUNTER_ATTACK_MULTIPLIER = 0.25
```

Constant meanings:

- `COUNTER_HEALTH_TO_SPEED_RATIO`: converts health into the rough speed-equivalent scale used by the Counter formula. A value of `45` means about `45 max health ~= 1 speed` for Counter identity.
- `COUNTER_SCORE_THRESHOLD`: the score a Gotchi must exceed before it gets above the minimum Counter chance.
- `COUNTER_CHANCE_SCALE`: how quickly Counter chance rises once the threshold is exceeded.
- `COUNTER_CHANCE_MIN`: minimum chance for any Gotchi with Counter.
- `COUNTER_CHANCE_MAX`: maximum chance for highly speed-specialised Gotchis.
- `COUNTER_DAMAGE_REDUCTION`: percentage of triggering direct damage prevented by a successful Counter.
- `COUNTER_ATTACK_MULTIPLIER`: damage multiplier for the Counter attack.

## Counter chance formula

Counter chance should be based only on the countering Gotchi's own base speed and base/max health:

```js
const counterScore = (baseSpeed * COUNTER_HEALTH_TO_SPEED_RATIO) / baseMaxHealth

const counterChance = clamp(
  (counterScore - COUNTER_SCORE_THRESHOLD) * COUNTER_CHANCE_SCALE,
  COUNTER_CHANCE_MIN,
  COUNTER_CHANCE_MAX
)
```

Equivalent expanded form:

```js
const counterChance = clamp(
  ((baseSpeed * 45) / baseMaxHealth - 1.15) * 4,
  0.02,
  0.75
)
```

If `baseMaxHealth <= 0` or either stat is missing/invalid, fall back to `COUNTER_CHANCE_MIN`.

### Which stats to use

Use the Gotchi's base battle stats for this formula:

- include permanent stat values already baked into the battle Gotchi, such as items or crystals;
- exclude temporary status modifiers like `spd_up`, `spd_down`, `def_up`, `atk_down`, etc.;
- use max/base health, not current health.

Important: current health must not be used in the formula. Otherwise an injured high-health Tank would become more likely to Counter simply because its current health is lower.

If the current battle model mutates `gotchi.health` directly, cache a non-mutating value at battle setup, for example `baseHealth`, `maxHealth`, or `originalHealth`. Sequential battles that carry damaged health forward should still use the Gotchi's original max/base health for Counter chance.

## Counter resolution order

Counter must be checked before applying the triggering direct damage, because successful Counter can reduce that damage.

For each direct damaging hit against a target:

1. Calculate the incoming direct damage as normal.
2. If the target is alive and has the `counter` status, calculate its Counter chance using the formula above.
3. Roll Counter chance with the battle RNG.
4. If Counter fails, apply full incoming damage and do not Counter attack.
5. If Counter succeeds:
   - reduce the incoming direct damage by `COUNTER_DAMAGE_REDUCTION`;
   - apply the reduced damage to the target;
   - if the target is still alive after the reduced damage, perform a Counter attack against the attacker using `COUNTER_ATTACK_MULTIPLIER`;
   - Counter attack crit behavior should continue to use the existing crit multiplier logic.

Suggested pseudocode:

```js
let appliedDamage = incomingDamage
let counterSucceeded = false

if (incomingDamage > 0 && target.health > 0 && hasStatus(target, 'counter')) {
  counterSucceeded = counterCheck(target, rng)

  if (counterSucceeded) {
    appliedDamage = Math.floor(incomingDamage * (1 - COUNTER_DAMAGE_REDUCTION))
  }
}

applyDamage(target, appliedDamage)

if (counterSucceeded && target.health > 0) {
  const counterCritMultiplier = getCritMultiplier(target, rng)
  const counterDamage = getDamage(
    target,
    attacker,
    COUNTER_ATTACK_MULTIPLIER * counterCritMultiplier
  )

  applyDamage(attacker, counterDamage)
  logCounterOutcome(...)
}
```

Damage rounding should follow the existing damage rounding conventions used elsewhere in the engine. If the current engine rounds in `getDamage` or `applyDamage`, keep that behavior centralized rather than introducing a second rounding style.

## What Counter mitigation affects

`COUNTER_DAMAGE_REDUCTION` applies only to direct damage from the triggering hit.

It should not prevent or reduce:

- debuff/status application from the triggering move;
- buff removal or cleanse effects;
- damage-over-time ticks;
- leader passive damage;
- environment/global damage;
- any future non-direct damage sources unless explicitly opted in.

This is important because Counter is meant to help fast Tanks survive direct pressure, not become a full immunity or cleanse mechanic.

## Logging and Unity compatibility

Preserve the existing Unity-facing Counter log shape as much as possible.

The existing Counter outcome entry should continue to work:

```js
{
  target: attackingGotchi.id,
  source: counteringGotchi.id,
  damage: counterDamage,
  outcome: 'counter',
  critical: isCounterCrit
}
```

Optional extra fields may be added if safe:

```js
{
  incomingDamage,
  damagePrevented,
  damageAfterReduction,
  damageReduction: COUNTER_DAMAGE_REDUCTION
}
```

If there is any risk that Unity's current log parser rejects unknown fields, omit the optional fields. The gameplay behavior is the priority; richer log detail is nice-to-have.

No changes are required to carried `startingState` or status instance serialization for this spec.

## Representative formula outcomes

These examples use representative level-scaled stat profiles from the backend trait model, but the implemented game-logic formula does not depend on that model.

| Profile | Level 10 | Level 30 | Level 50 | Level 70 |
|---|---:|---:|---:|---:|
| Speed A / Health 0 | 71.8% | 75.0% | 75.0% | 75.0% |
| Speed B / Health 0 | 59.6% | 63.1% | 62.3% | 61.9% |
| Speed C / Health 0 | 47.4% | 39.7% | 36.4% | 37.5% |
| Speed 0 / Health 0 | 4.7% | 2.0% | 2.0% | 2.0% |
| Speed 0 / Health C | 2.0% | 2.0% | 2.0% | 2.0% |
| Speed 0 / Health B | 2.0% | 2.0% | 2.0% | 2.0% |
| Speed 0 / Health A | 2.0% | 2.0% | 2.0% | 2.0% |
| Speed A / Health A | 2.0% | 2.0% | 2.0% | 2.0% |

The desired shape is:

- fast, low-health Tanks Counter often;
- mid-speed, low-health Tanks get meaningful but not capped Counter chance;
- neutral Tanks rarely Counter;
- high-health Tanks almost never Counter, even if they also have high speed.

## Acceptance criteria

### Formula tests

Add deterministic unit tests for `counterCheck` or the extracted chance helper.

Recommended cases:

- high-speed / low-health level 50 profile clamps at `COUNTER_CHANCE_MAX`;
- speed-B / low-health level 50 profile is around `62%`;
- neutral speed / neutral health level 50 profile clamps at `COUNTER_CHANCE_MIN`;
- low-speed / high-health profile clamps at `COUNTER_CHANCE_MIN`;
- high-speed / high-health profile clamps at `COUNTER_CHANCE_MIN`;
- damaged current health does not increase Counter chance.

Where possible, test the exact helper output separately from RNG success/failure.

### Combat behavior tests

Add seeded battle/unit tests proving:

- Counter roll occurs before applying direct damage.
- Successful Counter reduces incoming direct damage by `COUNTER_DAMAGE_REDUCTION`.
- A target that would have died from full damage can survive if the reduced damage is low enough.
- If the target dies from reduced damage, no Counter attack is emitted.
- If the target survives reduced damage, it Counter attacks with `COUNTER_ATTACK_MULTIPLIER`.
- Counter attack crit behavior still works through the existing crit logic.
- Status/debuff side effects from the triggering move still apply even when direct damage is reduced.
- Non-direct damage sources are not reduced by Counter.

### Compatibility tests

- Existing battle determinism tests continue to pass.
- Existing replay/log compatibility tests continue to pass.
- Existing Unity-facing Counter log fields remain present.
- Existing status carry-over behavior is unchanged.

## Balance validation after implementation

After implementation, validate in the backend balancing repo before making larger data changes:

1. Run the fast Specials isolation sim for v3.
2. Run the fast Leader Skill isolation sim for v3.
3. Prepare and run the v3 threat gauntlet.
4. Inspect Tank Specials specifically:
   - `Fortress Stance`
   - `Warden Stance`
   - other Taunt/Counter moves
5. Compare high-speed Tank and high-health Tank performance slices if the reports make that practical.

Only after this mechanic is stable should balance data be adjusted around it.

## Content follow-ups outside this spec

The following are likely balance/content decisions, not required game-logic changes:

- whether `Fortress Stance` should gain `counter`;
- whether `Warden Stance` should keep its current defensive downside;
- whether `Fortress Stance` should become the defensive Taunt/Counter move while `Warden Stance` becomes the aggressive Taunt/Counter move;
- whether Counter-bearing Specials need lower or higher status durations once timed statuses are actively used for balance.

## Open questions

These do not block the initial implementation, but are worth revisiting after the first sim run:

- Should Counter damage reduction be shown explicitly in battle logs/UI?
- Should different Specials eventually provide different Counter profiles?
- Should Counter consume duration only on attempted attacks, successful Counters, or normal turn expiry only?

