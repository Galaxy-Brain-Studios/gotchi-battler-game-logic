# Status Potency v2: Context-Aware Friendly Buff Scaling

## Motivation

Status potency v1 uses `caster Focus - target Resistance` for every potency-enabled status. This is good for hostile debuffs, but it creates a hidden downside for high-Resistance allies: they receive weaker friendly buffs. It also allows self/friendly drawbacks, such as `spd_down` on a self-buffing move, to become stronger when the caster has high Focus/Crit.

## Required behaviour

Keep `status.potencyEnabled` as the source of truth for whether a status can receive potency. When potency is enabled, choose the formula by application context:

1. **Hostile status application**
   - Target is on the opposing team.
   - Keep the existing v1 formula:
   - `focusBonus = max(0, caster.focus - target.resist) / STATUS_FOCUS_COEFFICIENT`
   - Crit bonus and potency clamp remain unchanged.

2. **Friendly/self beneficial status application**
   - Target is on the caster's team and `status.isBuff === true`.
   - Do not use target Resistance.
   - Use caster-side Focus only:
   - `focusBonus = min(caster.focus / STATUS_FRIENDLY_FOCUS_COEFFICIENT, STATUS_FRIENDLY_FOCUS_MAX_BONUS)`
   - Add two constants:
     - `STATUS_FRIENDLY_FOCUS_COEFFICIENT = 150`
     - `STATUS_FRIENDLY_FOCUS_MAX_BONUS = 0.35`
   - Crit bonus and potency clamp remain unchanged.

3. **Friendly/self harmful status application**
   - Target is on the caster's team and `status.isBuff === false`.
   - Use fixed `potency = 1`.
   - Do not roll status crit and do not increment caster crit stats for this drawback application.

## Implementation notes

- `handleSpecialEffect` already receives `attackingTeam`, `attackingGotchi`, and `target`; use those to determine whether the target is friendly.
- `getStatusPotencyResult` can accept a small options object, e.g. `{ friendlyBeneficial, fixedPotency }`, or a clearer context enum if preferred.
- Battle log shape should not change. Existing `statusInstances[].potency` remains a number.
- This is a balance-behaviour change, not a schema/API break. Suggested package version: `5.0.3`.

## Acceptance tests

- Hostile debuff potency remains unchanged from v1 for equivalent Focus/Resistance/Crit inputs.
- Friendly buff potency increases with caster Focus and is unaffected by target Resistance.
- Friendly buff status crits still use caster Critical Rate and Critical Damage.
- Self/friendly harmful statuses apply with `potency = 1` even when the caster has high Focus/Crit.
- Existing battle logs still replay with the new logic in the standard replay path.
