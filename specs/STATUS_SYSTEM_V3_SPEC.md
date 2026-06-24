# Status System v3 — Game Logic Specification

**Status:** Implemented in game logic v5.0.0; Unity smoke test and release follow-up pending  
**Date:** 2026-06-23 (implementation reconciled 2026-06-24)  
**Owner:** Gotchi Battler game logic

## Decision summary

The battle engine will represent statuses internally as **rich status instances**, while preserving the existing string-based battle-log contract consumed by the Unity replayer.

- A status instance records its code, origin, removability, and optional duration.
- Every active instance still projects to the existing string status code. Two `atk_down` instances therefore still appear as `['atk_down', 'atk_down']` in legacy fields and logs.
- Statuses granted by a Leader Skill at battle start are permanent for that battle and cannot be removed by a cleanse or dispel. They remain active after the leader dies.
- Ordinary statuses remain removable by default. Existing effects stay permanent unless a duration is explicitly configured.
- Timed statuses expire after a defined number of complete turns taken by the affected Gotchi, and use the existing string-based `statusesExpired` log event.
- Battle-log fields already consumed by Unity remain strings. Rich state is available only as an additive engine-state payload where it is necessary to carry or rerun timed/source-aware statuses.

This is deliberately a game-logic foundation change, not a Unity migration.

## Implementation status

The game-logic work described here is implemented. `statusInstances` is canonical runtime and carry state; Unity-facing status fields remain string arrays or strings. The package and lockfile are versioned at `5.0.0`.

The following are deliberately external follow-up steps, not unrecorded implementation gaps:

- Manually load `tests/fixtures/status-system-v3-unity-compatibility.json` in GotchiBattlerReplayer to complete the Unity smoke test.
- Tag and publish the package only when separately authorised.
- Rebaseline balance simulations after release.

## Why this is needed now

### Production balance evidence

The final Beta analysis used the three high-stakes production tournaments (IDs 85, 100, and 115). Those tournaments had the strongest incentives and the strongest players, making them the best available evidence of an emergent competitive meta.

The analysis found production team compositions whose performance was materially stronger than the isolated Special and Leader Skill simulations predicted. The clearest interaction is:

1. **Brilliant Soul** grants the whole team both `regenerate` and two stacks of `atk_down`.
2. **Immunize** can cleanse the `atk_down` stacks from every ally.
3. **Dispel** removes the opposing team’s buffs.

The resulting Brilliant Soul + Immunize + Dispel core kept the upside of the Leader Skill while deleting its intended downside. A controlled four-way check confirmed the interaction: the production threats won about 78.9% with the current Brilliant Soul/Immunize pairing, versus about 58.0% when Immunize's debuff removal was disabled. This is an interaction problem, not simply proof that any one numeric value is too high.

The current representation cannot distinguish:

```js
['atk_down', 'atk_down'] // granted by Brilliant Soul; should be protected
['atk_down']             // inflicted by an enemy Special; should be cleanseable
```

They are the same string. `remove_debuff` consequently selects a status code and removes every copy of that code. This makes it impossible to make a Leader Skill downside permanent without also making normal instances of the same status permanent.

### Player feedback and future balance room

Players also reported two genuine mechanical issues:

- Critical Rate and Critical Damage have little impact for a high-Focus Gotchi when its move does not make a damaging or healing roll.
- On an ally-buff move such as Enchant Armor, Focus and critical stats currently have little or no influence. Friendly status application always passes the Focus/Resistance check.

The v3 status model must not solve this by making allies randomly resist beneficial support. A player should not watch their own buff or cleanse fail because their teammate had high Resistance. Instead, source-aware, timed statuses give the engine a safe foundation for a later, explicit support-stat model: for example, stronger potency, duration, or a tightly bounded critical-support bonus.

That tuning is intentionally separate from this refactor. We first need a reliable status model, then a fresh simulation baseline.

## Goals

1. Make source, removal policy, and duration first-class properties of every active status.
2. Make battle-start Leader Skill statuses non-removable and permanent for the whole battle.
3. Allow future Specials, auto-attack effects, environmental effects, items, and other systems to create timed statuses.
4. Preserve the Unity replayer's current string-based status fields and existing visual behaviour.
5. Preserve deterministic battle simulation and reproducible logs for a fixed game-logic version and seed.
6. Make v3 `startingState.statuses` carry rich status objects, while accepting old string-array starting states as a legacy input.
7. Centralise all status reads and mutations so future changes do not require scattered array manipulation.

## Non-goals for this change

- Rewriting the Unity app or changing its status DTOs.
- Replacing existing status codes or adding new Unity status icons.
- Making friendly buffs, heals, or cleanses use a hostile Focus-vs-Resistance failure check.
- Selecting exact durations for every existing Special.
- Tuning Immunize, Dispel, Brilliant Soul, Enchant Armor, or every affected Special in the same code change. Those changes should be measured from the v3 baseline.
- Changing the current per-status maximum-stack rules unless a separate balance decision explicitly does so.

## Existing constraints

### Unity battle-log compatibility is a hard constraint

The Unity replayer models `Gotchi.statuses`, effect `statuses`, and `StatusEffect.status` as strings. It uses those codes to count stacks and select existing visual effects. The existing fields must continue to have the same shapes:

```json
{
  "statuses": ["atk_down", "atk_down", "regenerate"],
  "statusesExpired": [
    { "target": 123, "status": "atk_down" }
  ]
}
```

In particular:

- Do **not** replace a string with a status object in `logs.gotchis[].statuses`.
- Do **not** replace strings in `actionEffects[].statuses`, `additionalEffects[].statuses`, `statusEffects[].status`, or `statusesExpired[].status`.
- Do **not** rename status codes as part of this refactor.
- Extra, additive JSON fields are acceptable only after a replayer smoke test confirms that they are ignored as expected.

### Game-logic reproducibility is a hard constraint

Battle logs contain `meta.gameLogicVersion` so a result can be reproduced using the matching package tag. Status expiry and removal must therefore be deterministic: no wall-clock time or iteration-order ambiguity.

The behavioural change warrants a new major game-logic release. Historical logs are reproduced with their recorded version; v3 logs are reproduced with the new version.

### Carry state is different from presentation state

The current dungeon/campaign flow can pass a winner's health, `statuses`, and Special bar into the next battle through `startingState`. String codes alone cannot faithfully carry a temporary status: they lose remaining duration, origin, and protection policy.

`startingState` is not read by Unity, so v3 may and should change `startingState.statuses` from `string[]` to an array of rich status instances. This is required for deterministic carry state, not for Unity rendering.

## Terminology

| Term | Meaning |
| --- | --- |
| **Status definition** | Static entry in `game-logic/statuses.json`: code, category, stat modifiers, turn effects, max stack, etc. |
| **Status instance** | One active application of a status to one Gotchi. One instance represents one stack. |
| **Subject** | The Gotchi currently carrying the status. |
| **Source** | The system and origin that created a status instance, such as a Leader Skill or Special. |
| **Legacy projection** | The ordered `string[]` of active codes derived from instances for existing consumers. |
| **Protected status** | An active instance whose `removable` flag is false. It is ignored by dispels and cleanses. |
| **Permanent status** | An instance with no duration. It does not expire naturally. It may still be removable unless protected. |

## Canonical runtime model

`gotchi.statusInstances` becomes the canonical runtime state. `gotchi.statuses` remains a derived compatibility projection and must never be mutated directly by combat code.

One object represents one stack. This retains today's stack semantics and makes a partial cleanse or expiry unambiguous.

```js
{
  // Required. References game-logic/statuses.json.
  code: 'atk_down',

  // Required for newly created instances.
  source: {
    kind: 'leader_skill', // leader_skill | special | auto_attack | item | crystal | environment | system | legacy
    code: 'brilliant_soul',
    gotchiId: 101 // nullable when there is no Gotchi source
  },

  // Leader-skill status instances are false. Normal instances default to true.
  removable: false,

  // null means permanent. A positive integer is a duration measured in the subject's completed turns.
  remainingSubjectTurns: null
}
```

`code`, source, removability, and duration are the semantic fields. Runtime code may use object identity to distinguish duplicate stacks; no instance identifier is serialized or carried between battles.

### Legacy projection

The projection is always generated in insertion order:

```js
gotchi.statuses = gotchi.statusInstances.map(instance => instance.code)
```

Thus an internal state of:

```js
[
  { code: 'atk_down', removable: false, ... },
  { code: 'atk_down', removable: false, ... },
  { code: 'regenerate', removable: false, ... }
]
```

still emits:

```js
['atk_down', 'atk_down', 'regenerate']
```

The projection must be synchronised after every status mutation and before a result or log object is returned. It is compatibility data, not a second source of truth.

## Lifecycle rules

### Applying a status

All current callers must route through one status service, conceptually:

```js
applyStatus(gotchi, {
  code,
  count,
  source,
  removable,
  durationTurns
})
```

The service must:

1. Validate the status definition.
2. Enforce the existing maximum stack count across **all** instances with the same code, including protected instances.
3. Create one instance per accepted stack.
4. Apply the default policy when the caller does not specify one: removable and permanent.
5. Refresh the legacy string projection.
6. Return the same success/failure information required by current effect logging.

No combat code may push, splice, filter, or assign `gotchi.statuses` directly after this migration.

### Leader Skill statuses

When `addLeaderToTeam` applies statuses from `leaderSkillExpanded.statuses`, every created instance must have:

```js
source: { kind: 'leader_skill', code: leaderSkill.code, gotchiId: leader.id }
removable: false
remainingSubjectTurns: null
```

This means a Leader Skill's stated trade-off is reliable. Brilliant Soul's team-wide `atk_down` cannot be erased by Immunize, while an enemy-applied `atk_down` can still be cleansed.

These are battle-start passives, not a live aura tied to the leader's health. They stay active after the leader dies and until the battle ends. This rule applies only to status-based Leader Skill effects; it does not alter the separate carry/aura stat-mechanics system.

### Timed statuses

An effect may opt into a duration with a positive integer `durationTurns`. Omitted or `null` duration means permanent, preserving all current content by default.

Duration is measured in **complete turns taken by the subject**, not global turns and not the source Gotchi's turns.

- A duration of `1` survives through the subject's next complete turn and expires after that turn resolves.
- The turn in which a status is applied never consumes one of its duration turns, including a self-applied status.
- A skipped turn still counts as a completed subject turn for duration purposes.
- Do not tick the duration if the subject dies during start-of-turn effects, or if those effects end the battle before the subject resolves an action or status-caused skip.
- At the end of the qualifying subject turn, decrement the duration. When it reaches zero, remove that one instance and append the existing `{ target, status }` record to `statusesExpired`.
- A dead Gotchi does not need expiry events; its battle state is no longer actionable.

This avoids the unintuitive result where a self-buff with duration one disappears immediately at the end of the casting turn.

### Removal and cleansing

Every removal effect must operate on instances, never on raw string arrays.

| Operation | Eligible instances | Intended behaviour |
| --- | --- | --- |
| `remove_buff` | removable buff instances | Select one eligible status code using the current stack-weighted selection semantics, then remove all **removable** copies of that selected code. |
| `remove_debuff` | removable debuff instances | Same as `remove_buff`, but for debuffs. |
| `remove_all_buffs` | removable buff instances | Remove every eligible instance. |
| `remove_all_debuffs` | removable debuff instances | Remove every eligible instance. |
| `cleanse_target` / `cleanse_self` | removable debuff instances | Same stack-weighted selected-code behaviour as `remove_debuff`: remove all removable copies of the selected code. |
| Self-consuming turn effect | the triggering instance | Consume exactly that instance, regardless of `removable`. |
| Natural expiry | timed instances whose timer reaches zero | Remove exactly that instance, regardless of `removable`. |

The selection pool excludes protected instances. If the only matching instances are protected, the removal has no status change and emits no expiry event. This is the essential rule that prevents a cleanse from deleting a Leader Skill penalty.

All current random cleanse and removal effects use the selected-code, all-removable-copies behaviour. Self-consuming effects use `consumeStatusInstance`; this is distinct from an external cleanse or dispel and may consume a protected instance.

## Effect configuration changes

Status-applying effect schemas need an optional duration field:

```js
{
  effectType: 'status',
  status: 'def_up',
  target: 'all_allies',
  chance: 1,
  durationTurns: 2 // optional; omitted means permanent
}
```

The equivalent auto-attack status effect shape supports the same field. Leader Skill status definitions do not use a configured duration: their source policy always creates permanent, protected instances.

Validation requirements:

- `durationTurns` is a positive integer when present.
- Existing effect data without `durationTurns` remains valid and preserves present behaviour.
- The engine, not authored JSON, owns source type and removability. Content cannot accidentally make a normal enemy debuff protected merely by setting a raw flag.

Special effects are validated by `EffectSchema` when the team is parsed. Auto-attack effects are static status-definition data and are validated by `applyStatus` when they apply; there is currently no separate static auto-attack effect schema.

## Focus, Resistance, Crit, and support effects

The current resolver makes friendly Focus/Resistance checks automatically succeed. That is correct for the present model and remains correct in this change.

The v3 resolution policy is:

| Effect direction | Resolution policy |
| --- | --- |
| Hostile status application | Focus vs. target Resistance, unless the effect explicitly skips the check. |
| Hostile buff removal / dispel | Focus vs. target Resistance, unless explicitly skipped. |
| Friendly status application, heal, cleanse | Deterministic success when its own effect chance succeeds; no ally Resistance check. |

This refactor must leave room for a later support-stat design without creating frustrating friendly failures. Candidate follow-up designs include Focus increasing a friendly buff's potency or duration, and a carefully capped critical-support bonus. Those need an independent written rule and controlled simulations before implementation.

In particular, do not silently make Enchant Armor or any other existing buff stronger as a side effect of this refactor. The player feedback is a reason to design this deliberately, not a reason to add an unmeasured global multiplier.

## Battle-log and state-transfer contract

### Fields consumed by Unity: unchanged

The following remain string-based and preserve their current names and shapes:

- `logs.gotchis[].statuses: string[]`
- `logs.turns[].action.actionEffects[].statuses: string[]`
- `logs.turns[].action.additionalEffects[].statuses: string[]`
- `logs.turns[].statusEffects[].status: string`
- `logs.turns[].statusesExpired[].status: string`
- `logs.result.winningTeam[].statuses: string[]`

The Unity replayer can therefore continue to count stacks and play existing effects without any code or asset change. A natural timeout is displayed using the same existing removal event as a cleanse.

### Engine-state data and `startingState`

In v3, a `startingState` entry carries the canonical instances directly in `statuses`:

```json
{
  "id": 123,
  "health": 400,
  "statuses": [
    {
      "code": "def_up",
      "source": { "kind": "special", "code": "enchant_armor", "gotchiId": 101 },
      "removable": true,
      "remainingSubjectTurns": 2
    }
  ],
  "specialBar": 67
}
```

`StartingStateSchema` validates these objects and the preparation step derives the runtime string projection from them. This avoids an unnecessary wrapper and makes the carry contract honest: it is game state, not a UI DTO.

For compatibility, `StartingStateSchema` must also accept the old `string[]` form as input. The old form is normalised into equivalent legacy instances:

```js
{
  source: { kind: 'legacy', code: null, gotchiId: null },
  removable: true,
  remainingSubjectTurns: null
}
```

The engine must not guess that a string from an old log was a protected Leader Skill status. Old data did not preserve that distinction. Fresh v3 battles and v3 carry state will preserve it correctly.

To make a v3 battle reproducible when its initial state was itself carried from an earlier battle, `logs.gotchis[]` and `logs.result.winningTeam[]` also include an additive `statusInstances: StatusInstance[]` field. Their existing `statuses: string[]` fields remain unchanged for Unity and other legacy readers. The package exports `buildStartingStateFromLog(logs)` for campaign callers; it clones the winning team's rich instances into the next `startingState.statuses` and rejects pre-v5 logs without them.

### Log size and privacy

`statusInstances` contains only status mechanics already inferable from the battle and has no private player data. It should stay compact: one short object per active stack, emitted only where state must be reconstructed. Per-turn effect and expiry events remain the established compact string form.

## Migration and implementation plan

### Phase 1 — status-store foundation with no intended content changes

1. Add a status-store module or equivalent central helpers for initialise, query, apply, remove, expire, and project operations.
2. Initialise `statusInstances` in battle preparation and derive `statuses` from it.
3. Replace every direct read/mutation of `gotchi.statuses` in combat, targeting, stat modification, turn effects, setup, replay, and result construction with status-store calls.
4. Keep existing definitions permanent/removable by default.
5. Add the `startingState.statuses` normaliser: rich objects are canonical; old string arrays become legacy instances.

This phase should reproduce the existing behaviour for ordinary, permanent statuses.

### Phase 2 — source-aware Leader Skill policy and carry-state transfer

1. Route `addLeaderToTeam` through the status store with the protected leader policy.
2. Change `StartingStateSchema.statuses` to rich status instances, while retaining a legacy string-array input branch.
3. Add the additive `statusInstances` field to the log and winning-team result DTOs, and update the replay helper to use it when present.
4. Export `buildStartingStateFromLog(logs)` and use it for campaign callers to map `winningTeam.statusInstances` to the next battle's `startingState.statuses`.
5. Add a Unity JSON smoke fixture containing additive `statusInstances` and confirm existing string-status presentation remains unchanged.

### Phase 3 — durations

1. Add `durationTurns` validation to the Special effect schema and the shared status-application path used by auto-attack effects.
2. Add the end-of-subject-turn expiry step, including skipped turns.
3. Emit one existing `statusesExpired` entry for each expired stack.
4. Leave all existing content without a duration until individual balance decisions are approved.

### Phase 4 — rebalance from a clean v3 baseline

1. Rerun Leader Skill and Special isolation simulations.
2. Rerun the production threat gauntlet, including the persistent production compositions.
3. Re-run the Brilliant Soul × Immunize × Dispel interaction matrix.
4. Decide whether Dispel should remove one removable buff rather than all removable buffs, whether Immunize's cleanse/chance changes, and which effects should become timed.
5. Only then consider a separately specified support-stat model for Focus and critical stats.

## Test plan and acceptance criteria

### Unit tests

- Projection preserves insertion order and duplicate stacks.
- Existing max-stack limits count protected, temporary, and ordinary instances together.
- Legacy string-only `startingState.statuses` normalises to permanent removable instances.
- Rich `startingState.statuses` validates its instance fields and produces the correct string projection.
- An ordinary status and a protected Leader Skill status with the same code coexist correctly.
- `remove_debuff` removes ordinary `atk_down` instances but not Brilliant Soul's protected `atk_down` instances.
- `remove_all_buffs` and `remove_all_debuffs` retain protected instances.
- Existing all-copies removal tests retain their result when every copied status is removable.
- `cleanse_target` and `cleanse_self` remove all removable copies of their randomly selected debuff code.
- A duration-one self-buff survives the casting turn and the subject's next complete turn, then emits exactly one normal expiry record.
- Multi-stack timed statuses expire stack-by-stack with one expiry record per stack.
- Skipped turns advance a subject's durations.
- A subject dying during start-of-turn effects does not decrement its timed statuses.
- An enemy team dying during pre-action effects does not decrement the acting subject's timed statuses.
- Fixed seed + fixed game-logic version yields stable battle logs when `meta.timestamp` is excluded.

### Integration tests

- Existing status, replay, carry-state, leader-mechanics, and deterministic rerun tests continue to pass where behaviour is intentionally unchanged.
- A v3 Unity fixture containing additive `statusInstances` is ready for a manual replayer smoke test; the existing string status icons/counts must remain unchanged.
- An older log without `statusInstances` can still be replayed through its legacy path.
- `buildStartingStateFromLog` clones v5 rich winner state and rejects a pre-v5 winner lacking `statusInstances`.
- A carried timed status preserves source, removability, remaining duration, and legacy projection into the next battle.
- A fresh Brilliant Soul + Immunize battle proves that Immunize cannot remove the protected Leader Skill `atk_down`, while it can remove an enemy-applied `atk_down`.

### Implementation readiness

- No game-logic combat path directly mutates `gotchi.statuses`.
- Existing Unity-consumed fields remain string fields with the same names and shapes.
- Rich engine state is present wherever a later battle or rerun needs it.
- All game-logic tests and lint pass.
- The v3 Unity fixture is present for manual replayer verification.
- `package.json` and `package-lock.json` are versioned at `5.0.0`.

### Release follow-up

- Complete the Unity replayer smoke test using the v3 fixture.
- Tag and publish the new major version when authorised.
- Rebaseline the balance suite against the published version.

## Decisions deliberately deferred to balance testing

These are important follow-up questions, but they are not safe to decide inside the data-model refactor:

1. Which current Specials become timed, and their exact duration values.
2. Whether Dispel becomes one-buff removal, receives a lower chance, or both.
3. Whether a future effect should intentionally remove a single status instance rather than every removable copy of a selected code, and any Immunize chance or Resistance bonus.
4. The exact support-stat rule that gives Focus, Critical Rate, and Critical Damage meaningful roles for non-damaging moves.
5. Any numeric changes to Brilliant Soul or the other Enlightened Specials that benefit from the Brilliant Soul core.

The status model makes those choices testable without another architectural rewrite. It should be implemented first, then measured through the isolation suite, production threat gauntlet, and targeted interaction tests.
