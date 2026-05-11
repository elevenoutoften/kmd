# Pranayama Library — Full Execution Specification

**Document type:** Implementation-proof practice library specification  
**Language:** English  
**Version:** 2.0  
**Purpose:** Replace vague pranayama descriptions with precise execution rules, phase timing, breath mechanics, body focus, and advanced-variant rules.  
**Scope:** All pranayama practices present in the app kit library, including split variants where the original kit grouped multiple techniques under one item.

---

## 0. Important Interpretation Rules

This document is written to prevent developers, designers, or content writers from inventing breathing mechanics.

### 0.1 “Exact seconds” are app execution timings, not claims of one universal lineage

Pranayama is taught differently across schools. Many classical sources use **counts** rather than seconds, and the practitioner’s capacity matters. For implementation, this spec converts those counts into concrete second-based defaults.

Use these timings as the app’s executable default unless a variant explicitly overrides them.

### 0.2 Base practice vs advanced variant

Every technique has a **base version**. Some techniques also have **advanced variants**.

Do not merge advanced features into base practices. In particular:

```text
Do not add retention, nostril switching, or bandhas to a base pranayama unless the specific variant says so.
```

### 0.3 Bandhas are not normal breathing phases

Bandhas are **locks** used primarily during **kumbhaka / breath retention**. They are not part of ordinary inhale/exhale loops.

```text
Bandhas appear only in explicit kumbhaka/retention variants.
Never add bandhas automatically to base pranayama modes.
Never apply bandhas during rapid Kapalabhati pulses or Bhastrika pumping breaths.
```

### 0.4 Kapalabhati and Bhastrika are not the same timing model

These two techniques must not be implemented as generic “fast breathing.”

```text
Kapalabhati = active sharp exhale pulse + passive rebound inhale.
Bhastrika = active inhale + active exhale, equal force and equal duration.
```

For Kapalabhati, the app controls **pulse frequency**, not inhale duration.

For Bhastrika, the app controls **breath frequency**, where each breath includes an active inhale and active exhale.

---

## 1. Global Safety Rules

These rules belong in the content system and should also guide animation/audio intensity.

### 1.1 Stop conditions

Stop the practice and return to natural breathing if the user experiences:

- dizziness;
- tingling or numbness;
- chest pain;
- headache pressure;
- panic increase;
- breath hunger that feels forced;
- facial, throat, or eye strain;
- loss of smooth control.

### 1.2 Practices requiring extra caution

The following practices are **not casual relaxation loops**:

- Kapalabhati;
- Bhastrika;
- any Kumbhaka;
- any Kumbhaka with Bandhas;
- any advanced retention variant of Nadi Shodhana, Surya Bhedana, Chandra Bhedana, Ujjayi, Sheetali, or Sheetkari.

### 1.3 Safety level labels

Use these internal labels:

```yaml
safety_levels:
  gentle:
    description: "No retention, no forceful breathing, no bandhas."
  controlled:
    description: "Structured breathing; no forceful pumping; no strong retention."
  advanced:
    description: "Retention, forceful breath, or bandha mechanics present."
  gated:
    description: "Requires explicit warning, prerequisites, and conservative duration."
```

---

## 2. Universal Bandha Module

This is a shared advanced module. It is not a standalone breathing rhythm by itself.

### 2.1 The three main bandhas

| Bandha | English name | Physical cue | Primary use in this spec |
|---|---|---|---|
| **Jalandhara Bandha** | Chin/throat lock | Chin gently drops toward the notch between the collarbones; back of neck long | Main lock during internal retention |
| **Mula Bandha** | Root lock | Gentle lift of pelvic floor/root | Optional advanced addition during retention |
| **Uddiyana Bandha** | Abdominal lock | Abdomen draws inward/upward after exhale | Mainly external retention; do not use on full lungs |
| **Maha Bandha** | Great lock | Jalandhara + Uddiyana + Mula together | Advanced external-retention finish, especially after some Bhastrika variants |

### 2.2 Internal retention / Antara Kumbhaka sequence

Use after inhale.

```text
inhale → hold full → apply Jalandhara → optionally apply Mula → release Mula → release Jalandhara → exhale
```

Implementation phases:

| Phase | Duration default | Cue |
|---|---:|---|
| Inhale | 4–6s | Fill smoothly, no strain |
| Internal hold | 2–8s depending on variant | Stay calm; do not grip throat |
| Jalandhara | during hold | Chin lock, neck long |
| Optional Mula | during hold | Gentle root lift |
| Release locks | 0.5–1.0s | Release before exhale |
| Exhale | 6–8s | Smooth release |

**Do not use Uddiyana Bandha in basic internal retention with full lungs.**

### 2.3 External retention / Bahya Kumbhaka sequence

Use after exhale.

```text
exhale → hold empty → apply Jalandhara → apply Uddiyana → optionally apply Mula → release Mula → release Uddiyana → release Jalandhara → inhale
```

Implementation phases:

| Phase | Duration default | Cue |
|---|---:|---|
| Exhale | 6–8s | Empty smoothly; do not collapse |
| External hold | 2–6s beginner advanced; longer only teacher-led | Hold empty calmly |
| Jalandhara | during hold | Chin lock |
| Uddiyana | during hold | Abdomen gently inward/upward |
| Optional Mula | during hold | Gentle root lift |
| Release locks | 0.5–1.0s | Release before inhale |
| Inhale | 4–6s | Smooth recovery inhale |

### 2.4 Where bandhas are valid in this library

| Practice | Base uses bandhas? | Advanced bandha variant valid? | Notes |
|---|---:|---:|---|
| Natural Breath Awareness | No | No | Observation only |
| Dirgha | No | Not as pure Dirgha | Can be used as prep for Kumbhaka, but not part of base technique |
| Sama Vritti | No | Yes, only if converted to retention/square variant | Base equal breath has no locks |
| Extended Exhale | No | No | Keep it calming and non-retentive |
| Nadi Shodhana | No | Yes | Common advanced retention variant |
| Bhramari | No | Rare/optional, not included as executable default | Keep base technique about humming |
| Ujjayi | No | Yes | Retention with Jalandhara may be taught separately |
| Sheetali | No | Yes | Cooling inhale plus optional internal retention variant |
| Sheetkari | No | Yes | Same logic as Sheetali |
| Chandra Bhedana | No | Yes, softer/optional | Usually cooling/softening; do not force retention |
| Surya Bhedana | No | Yes | Important classical retention variant |
| Viloma I/II/III | No | No | The short pauses are not bandha-retentions |
| Gentle Kumbhaka | No in base | Yes | Jalandhara first; Mula optional later |
| Kapalabhati | No during pulses | Optional after-round retention variant | Never during each pulse |
| Bhastrika | No during pumping | Yes, after-round external retention/Maha Bandha variant | Never during each pumping breath |
| Kumbhaka with Bandhas | Yes | This is the bandha module | Universal advanced module |

---

# 3. Executable Practice Specifications

---

## 3.1 Natural Breath Awareness

```yaml
id: natural_breath_awareness
name: Natural Breath Awareness
level: basic
safetyLevel: gentle
basePattern: natural_observation
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Teaches awareness of breathing without controlling breathing.

### Correct execution

The user breathes naturally. The app does not impose inhale or exhale timing.

### Timing

No fixed breath phases.

Use attention phases instead:

| Attention phase | Duration suggestion | Cue |
|---|---:|---|
| Nostrils | 30–60s | Notice air touching the nostrils |
| Chest | 30–60s | Notice subtle chest movement |
| Belly/diaphragm | 30–60s | Notice the belly rise and fall naturally |
| Whole body | 30–60s | Let the whole body breathe |

### Body focus

- nostrils;
- chest;
- belly/diaphragm;
- whole body.

### Do not

- Do not cue “breathe in now” or “breathe out now.”
- Do not impose a visual breathing bubble rhythm.
- Do not add holds.
- Do not add bandhas.

---

## 3.2 Dirgha Pranayama / Three-Part Breath / Full Yogic Breath

```yaml
id: dirgha_pranayama
name: Dirgha Pranayama
englishName: Three-Part Breath / Full Yogic Breath
level: basic
safetyLevel: gentle
basePattern: three_part_wave
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Teaches body-zone breathing and expands awareness from belly to ribs to chest.

### Correct execution

The inhale fills the body in three zones from low to high:

```text
belly → ribs/diaphragm → upper chest
```

The exhale releases in reverse order:

```text
upper chest → ribs/diaphragm → belly
```

### Default timing

One full cycle = **12 seconds**.

| Phase | Duration | Body focus | Cue |
|---|---:|---|---|
| Inhale 1 | 2.0s | Belly | Let the lower belly expand softly |
| Inhale 2 | 2.0s | Ribs/diaphragm | Let the side ribs widen |
| Inhale 3 | 2.0s | Upper chest | Let the upper chest fill gently |
| Exhale 1 | 2.0s | Upper chest | Soften the chest |
| Exhale 2 | 2.0s | Ribs/diaphragm | Let the ribs fall inward |
| Exhale 3 | 2.0s | Belly | Let the belly fall back naturally |

### Variants

| Variant | Timing | Notes |
|---|---:|---|
| Learning | 3s inhale / 3s exhale | 1s per zone; only for demonstration |
| Default | 6s inhale / 6s exhale | 2s per zone |
| Slow | 9s inhale / 9s exhale | 3s per zone; only if comfortable |

### Body focus

- belly expansion;
- lower ribs widening;
- upper chest lift;
- reverse release on exhale.

### Common mistakes

- Lifting shoulders instead of expanding ribs.
- Forcing the belly outward.
- Collapsing chest suddenly on exhale.
- Turning it into breath retention.

### Implementation YAML

```yaml
phases:
  - label: Inhale Belly
    duration: 2.0
    breathAction: inhale
    zoneCue: belly
  - label: Inhale Ribs
    duration: 2.0
    breathAction: inhale
    zoneCue: diaphragm_ribs
  - label: Inhale Chest
    duration: 2.0
    breathAction: inhale
    zoneCue: chest
  - label: Exhale Chest
    duration: 2.0
    breathAction: exhale
    zoneCue: chest
  - label: Exhale Ribs
    duration: 2.0
    breathAction: exhale
    zoneCue: diaphragm_ribs
  - label: Exhale Belly
    duration: 2.0
    breathAction: exhale
    zoneCue: belly
```

---

## 3.3 Sama Vritti / Equal Breath

```yaml
id: sama_vritti
name: Sama Vritti
englishName: Equal Breath
level: basic
safetyLevel: gentle
basePattern: equal_inhale_exhale
bandhaUsage:
  base: none
  advancedVariants:
    - sama_vritti_with_kumbhaka
    - sama_vritti_with_kumbhaka_and_jalandhara
```

### Purpose

Stabilizes attention through equal inhale and exhale.

### Correct base execution

Nasal inhale and nasal exhale are equal length. No holds in the base version.

### Default timing

One full cycle = **8 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale | 4.0s | Smooth nasal inhale |
| Exhale | 4.0s | Smooth nasal exhale |

### Variants

| Variant | Timing | Bandhas |
|---|---:|---|
| Beginner | 3s in / 3s out | None |
| Default | 4s in / 4s out | None |
| Slow | 5s in / 5s out | None |
| Sama Vritti with Kumbhaka | 4s in / 4s hold / 4s out / 4s hold | No bandhas by default |
| Sama Vritti with Kumbhaka + Jalandhara | 4s in / 4s internal hold with Jalandhara / 4s out / no external hold | Advanced only |

### Body focus

- nostrils;
- brow center;
- even rhythm;
- no strain.

### Common mistakes

- Adding retention to the base practice.
- Making exhale longer; that becomes Extended Exhale, not Sama Vritti.
- Overfilling the lungs to “complete” the inhale.

### Implementation YAML

```yaml
phases:
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
  - label: Exhale
    duration: 4.0
    breathAction: exhale
    route: nose
```

---

## 3.4 Extended Exhale Breathing

```yaml
id: extended_exhale
name: Extended Exhale Breathing
level: basic
safetyLevel: gentle
basePattern: inhale_shorter_exhale_longer
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Calming practice using a longer exhale.

### Correct execution

Inhale through the nose. Exhale through the nose for longer than the inhale.

### Default timing

One full cycle = **10 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale | 4.0s | Soft nasal inhale |
| Exhale | 6.0s | Longer nasal exhale; soften downward |

### Variants

| Variant | Timing | Notes |
|---|---:|---|
| Beginner | 3s inhale / 5s exhale | Gentle calming |
| Default | 4s inhale / 6s exhale | Main version |
| Deep calming | 4s inhale / 8s exhale | Only if comfortable |

### Body focus

- belly and diaphragm;
- ribs lowering;
- jaw soft;
- shoulders relaxed.

### Do not

- Do not add holds.
- Do not add bandhas.
- Do not force all air out.

### Implementation YAML

```yaml
phases:
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
    zoneCue: diaphragm
  - label: Exhale
    duration: 6.0
    breathAction: exhale
    route: nose
    zoneCue: belly
```

---

## 3.5 Nadi Shodhana / Alternate Nostril Breath

```yaml
id: nadi_shodhana
name: Nadi Shodhana
englishName: Alternate Nostril Breath
level: basic_to_intermediate
safetyLevel: controlled
basePattern: alternate_nostril_left_right
bandhaUsage:
  base: none
  advancedVariants:
    - nadi_shodhana_with_internal_kumbhaka
    - nadi_shodhana_with_internal_kumbhaka_jalandhara
    - nadi_shodhana_with_internal_kumbhaka_jalandhara_mula
    - nadi_shodhana_with_internal_and_external_kumbhaka_advanced
```

### Purpose

Balances attention through alternating nostril flow.

### Hand position

Use **Vishnu Mudra / Nasagra Mudra** with the right hand:

- thumb closes the right nostril;
- ring finger closes the left nostril;
- index/middle fingers rest or fold depending on style.

### Correct base execution

One full cycle:

```text
inhale left → exhale right → inhale right → exhale left
```

No retention in the base version.

### Default timing

One full cycle = **20 seconds**.

| Phase | Duration | Nostril | Cue |
|---|---:|---|---|
| Inhale Left | 4.0s | Left open, right closed | Draw breath through the left side |
| Switch | 0.5s | Both lightly closed during hand transition | Close left, open right |
| Exhale Right | 6.0s | Right open, left closed | Release through the right side |
| Inhale Right | 4.0s | Right open, left closed | Draw breath through the right side |
| Switch | 0.5s | Both lightly closed during hand transition | Close right, open left |
| Exhale Left | 6.0s | Left open, right closed | Release through the left side |

The 0.5s switch is not a breath hold. It is a procedural hand-transition buffer.

### Advanced variant: internal retention without bandhas

```text
inhale left → hold → exhale right → inhale right → hold → exhale left
```

Example timing:

| Phase | Duration |
|---|---:|
| Inhale | 4.0s |
| Internal hold | 4.0s |
| Exhale | 8.0s |

### Advanced variant: internal retention with bandhas

```text
inhale left → internal hold with Jalandhara, optionally Mula → release locks → exhale right → inhale right → internal hold with Jalandhara, optionally Mula → release locks → exhale left
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Inhale | 4.0s | None |
| Internal hold | 4.0–8.0s | Jalandhara; Mula optional |
| Release locks | 0.5–1.0s | Release before exhale |
| Exhale | 6.0–8.0s | None |

### Body focus

- left/right nostril sensation;
- brow center;
- hand precision;
- smoothness and silence.

### Common mistakes

- Starting on the wrong side without clear intent.
- Adding retention to the base practice.
- Squeezing nostrils too hard.
- Treating the 0.5s switch as a formal kumbhaka.

### Implementation YAML — base

```yaml
phases:
  - label: Inhale Left
    duration: 4.0
    breathAction: inhale
    route: left_nostril
    sideCue: left
  - label: Switch
    duration: 0.5
    breathAction: transition
    route: both_closed_lightly
  - label: Exhale Right
    duration: 6.0
    breathAction: exhale
    route: right_nostril
    sideCue: right
  - label: Inhale Right
    duration: 4.0
    breathAction: inhale
    route: right_nostril
    sideCue: right
  - label: Switch
    duration: 0.5
    breathAction: transition
    route: both_closed_lightly
  - label: Exhale Left
    duration: 6.0
    breathAction: exhale
    route: left_nostril
    sideCue: left
```

---

## 3.6 Bhramari / Humming Bee Breath

```yaml
id: bhramari
name: Bhramari
englishName: Humming Bee Breath
level: basic
safetyLevel: gentle
basePattern: inhale_nose_hum_exhale
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Soothing sound-based pranayama using vibration on the exhale.

### Correct execution

Inhale softly through the nose. Exhale with one steady humming sound.

```text
nasal inhale → continuous humming exhale
```

### Default timing

One full cycle = **12 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale | 4.0s | Soft nasal inhale |
| Humming exhale | 8.0s | Continuous “mmmm” sound |

### Optional hand variation

Base version may be done without hands.

Optional variation:

- gently close or cover the ears;
- keep jaw relaxed;
- hum softly into the skull/face.

### Body focus

- face vibration;
- skull resonance;
- throat softness;
- chest resonance.

### Common mistakes

- Humming too loudly.
- Tensing jaw or throat.
- Turning the hum into a forced vocal performance.
- Adding retention or bandhas.

### Implementation YAML

```yaml
phases:
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
    sound: none
  - label: Hum
    duration: 8.0
    breathAction: exhale
    route: nose_or_closed_mouth_resonance
    sound: humming
    zoneCue: face_skull_throat
```

---

## 3.7 Ujjayi / Ocean Breath

```yaml
id: ujjayi
name: Ujjayi
englishName: Ocean Breath / Victorious Breath
level: basic_to_intermediate
safetyLevel: controlled
basePattern: nasal_breath_with_gentle_glottis_constriction
bandhaUsage:
  base: none
  advancedVariants:
    - ujjayi_with_internal_kumbhaka
    - ujjayi_with_internal_kumbhaka_jalandhara
```

### Purpose

Teaches breath texture, inner sound, and steady attention.

### Correct base execution

Breathing is through the nose only. The throat/glottis is gently narrowed to create a soft ocean-like or whisper-like sound.

```text
nasal inhale with gentle throat sound → nasal exhale with gentle throat sound
```

Important distinction:

```text
Ujjayi throat narrowing is not Jalandhara Bandha.
```

Jalandhara is a chin/throat lock during retention. Ujjayi is a soft glottis/throat texture during breathing.

### Default timing

One full cycle = **10 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Ujjayi inhale | 5.0s | Gentle ocean sound inside the throat |
| Ujjayi exhale | 5.0s | Same soft sound; no scraping |

### Calming variant

| Phase | Duration |
|---|---:|
| Ujjayi inhale | 4.0s |
| Ujjayi exhale | 6.0s |

### Advanced variant: Ujjayi with internal retention and Jalandhara

```text
Ujjayi inhale → internal hold with Jalandhara → release Jalandhara → Ujjayi exhale
```

Example timing:

| Phase | Duration | Notes |
|---|---:|---|
| Ujjayi inhale | 5.0s | Soft sound |
| Internal hold | 2.0–5.0s | Apply Jalandhara only after inhale completes |
| Release lock | 0.5–1.0s | Release before exhale |
| Ujjayi exhale | 5.0–8.0s | Soft sound returns |

### Body focus

- throat/glottis;
- inner sound;
- chest;
- brow/attention.

### Common mistakes

- Breathing through the mouth.
- Making a harsh snoring sound.
- Compressing the throat.
- Confusing Ujjayi texture with Jalandhara Bandha.

### Implementation YAML — base

```yaml
phases:
  - label: Ujjayi Inhale
    duration: 5.0
    breathAction: inhale
    route: nose
    throatAction: gentle_glottis_constriction
    sound: soft_ocean
  - label: Ujjayi Exhale
    duration: 5.0
    breathAction: exhale
    route: nose
    throatAction: gentle_glottis_constriction
    sound: soft_ocean
```

---

## 3.8 Sheetali / Cooling Breath with Rolled Tongue

```yaml
id: sheetali
name: Sheetali
englishName: Cooling Breath / Rolled Tongue Cooling Breath
level: basic_to_intermediate
safetyLevel: controlled
basePattern: inhale_through_rolled_tongue_exhale_through_nose
bandhaUsage:
  base: none
  advancedVariants:
    - sheetali_with_internal_kumbhaka
    - sheetali_with_internal_kumbhaka_jalandhara
    - sheetali_with_internal_kumbhaka_jalandhara_mula
```

### Purpose

Cooling pranayama using a mouth/tongue inhale and nasal exhale.

### Correct base execution

1. Roll the tongue into a tube.
2. Inhale through the rolled tongue.
3. Draw the tongue in and close the mouth.
4. Exhale through the nose.

```text
rolled-tongue mouth inhale → close mouth → nasal exhale
```

### Default timing

One full cycle = **10 seconds**.

| Phase | Duration | Route | Cue |
|---|---:|---|---|
| Cooling inhale | 4.0s | Rolled tongue / mouth | Sip cool air through the tongue |
| Close mouth | 0.5s | Transition | Tongue in, lips closed |
| Nasal exhale | 6.0s | Nose | Exhale smoothly through the nose |

The 0.5s transition is procedural, not retention.

### Advanced variant: Sheetali with internal retention and bandhas

```text
rolled-tongue inhale → close mouth → internal hold with Jalandhara, optionally Mula → release locks → nasal exhale
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Cooling inhale | 4.0s | None |
| Internal hold | 2.0–6.0s | Jalandhara; Mula optional |
| Release locks | 0.5–1.0s | Release before exhale |
| Nasal exhale | 6.0s | None |

### Body focus

- tongue;
- mouth;
- throat cooling sensation;
- chest softening.

### Common mistakes

- Exhaling through the mouth in the base version.
- Forcing the inhale noisily.
- Holding the breath without explicit advanced variant.
- Using Sheetali if the tongue cannot roll; use Sheetkari instead.

### Implementation YAML — base

```yaml
phases:
  - label: Cooling Inhale
    duration: 4.0
    breathAction: inhale
    route: rolled_tongue_mouth
    mouthAction: tongue_rolled
  - label: Close Mouth
    duration: 0.5
    breathAction: transition
    mouthAction: tongue_in_mouth_closed
  - label: Exhale Nose
    duration: 6.0
    breathAction: exhale
    route: nose
```

---

## 3.9 Sheetkari / Cooling Breath through Teeth

```yaml
id: sheetkari
name: Sheetkari
englishName: Cooling Breath through Teeth
level: basic_to_intermediate
safetyLevel: controlled
basePattern: inhale_through_teeth_exhale_through_nose
bandhaUsage:
  base: none
  advancedVariants:
    - sheetkari_with_internal_kumbhaka
    - sheetkari_with_internal_kumbhaka_jalandhara
    - sheetkari_with_internal_kumbhaka_jalandhara_mula
```

### Purpose

Cooling pranayama for users who cannot or should not perform rolled-tongue Sheetali.

### Correct base execution

1. Keep teeth lightly together or close enough to create a narrow air path.
2. Keep lips slightly open.
3. Inhale through the teeth.
4. Close the mouth.
5. Exhale through the nose.

```text
teeth-mouth inhale → close mouth → nasal exhale
```

### Default timing

One full cycle = **10 seconds**.

| Phase | Duration | Route | Cue |
|---|---:|---|---|
| Cooling inhale | 4.0s | Teeth/mouth | Sip air gently through the teeth |
| Close mouth | 0.5s | Transition | Lips close; jaw stays soft |
| Nasal exhale | 6.0s | Nose | Smooth nasal exhale |

### Advanced variant

Same structure as Sheetali:

```text
inhale through teeth → close mouth → internal hold with Jalandhara, optionally Mula → release locks → nasal exhale
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Cooling inhale | 4.0s | None |
| Internal hold | 2.0–6.0s | Jalandhara; Mula optional |
| Release locks | 0.5–1.0s | Release before exhale |
| Nasal exhale | 6.0s | None |

### Body focus

- teeth/mouth airflow;
- tongue and palate cooling;
- throat;
- chest.

### Common mistakes

- Clenching the teeth hard.
- Making the jaw rigid.
- Exhaling through the mouth.
- Treating the sound as the main goal.

### Implementation YAML — base

```yaml
phases:
  - label: Cooling Inhale
    duration: 4.0
    breathAction: inhale
    route: teeth_mouth
    mouthAction: teeth_lightly_together_lips_parted
  - label: Close Mouth
    duration: 0.5
    breathAction: transition
    mouthAction: lips_closed_jaw_soft
  - label: Exhale Nose
    duration: 6.0
    breathAction: exhale
    route: nose
```

---

## 3.10 Chandra Bhedana / Moon Piercing Breath

```yaml
id: chandra_bhedana
name: Chandra Bhedana
englishName: Moon Piercing Breath / Left Nostril Inhale Breath
level: intermediate
safetyLevel: controlled
basePattern: inhale_left_exhale_right
bandhaUsage:
  base: none
  advancedVariants:
    - chandra_bhedana_with_internal_kumbhaka
    - chandra_bhedana_with_internal_kumbhaka_jalandhara
    - chandra_bhedana_with_internal_kumbhaka_jalandhara_mula
```

### Purpose

Cooling/softening single-nostril pranayama.

### Correct base execution

```text
inhale through left nostril → exhale through right nostril
```

This repeats the same direction every round. It is not Nadi Shodhana.

### Default timing

One full cycle = **10.5 seconds**.

| Phase | Duration | Nostril | Cue |
|---|---:|---|---|
| Inhale Left | 4.0s | Left open, right closed | Draw breath through the left side |
| Switch | 0.5s | Transition | Close left, open right |
| Exhale Right | 6.0s | Right open, left closed | Release through the right side |

### Advanced variant with internal retention and bandhas

```text
left inhale → internal hold with Jalandhara, optionally Mula → release locks → right exhale
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Left inhale | 4.0s | None |
| Internal hold | 2.0–6.0s | Jalandhara; Mula optional |
| Release locks | 0.5–1.0s | Release before exhale |
| Right exhale | 6.0–8.0s | None |

### Body focus

- left side of nose/face;
- cooling sensation;
- softening down the body;
- brow center.

### Common mistakes

- Alternating direction like Nadi Shodhana.
- Exhaling through the same nostril in this implementation.
- Adding retention in the base version.

### Implementation YAML — base

```yaml
phases:
  - label: Inhale Left
    duration: 4.0
    breathAction: inhale
    route: left_nostril
    sideCue: left
  - label: Switch
    duration: 0.5
    breathAction: transition
    route: nostril_switch
  - label: Exhale Right
    duration: 6.0
    breathAction: exhale
    route: right_nostril
    sideCue: right
```

---

## 3.11 Surya Bhedana / Sun Piercing Breath

```yaml
id: surya_bhedana
name: Surya Bhedana
englishName: Sun Piercing Breath / Right Nostril Inhale Breath
level: intermediate
safetyLevel: controlled
basePattern: inhale_right_exhale_left
bandhaUsage:
  base: none
  advancedVariants:
    - surya_bhedana_with_internal_kumbhaka
    - surya_bhedana_with_internal_kumbhaka_jalandhara
    - surya_bhedana_with_internal_kumbhaka_jalandhara_mula
```

### Purpose

Warming/activating single-nostril pranayama.

### Correct base execution

```text
inhale through right nostril → exhale through left nostril
```

This repeats the same direction every round. It is not Nadi Shodhana.

### Default timing

One full cycle = **10.5 seconds**.

| Phase | Duration | Nostril | Cue |
|---|---:|---|---|
| Inhale Right | 4.0s | Right open, left closed | Draw breath through the right side |
| Switch | 0.5s | Transition | Close right, open left |
| Exhale Left | 6.0s | Left open, right closed | Release through the left side |

### Advanced variant with internal retention and bandhas

This is an important classical-style variant.

```text
right inhale → internal hold with Jalandhara + optional Mula → release locks → left exhale
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Right inhale | 4.0s | None |
| Internal hold | 4.0–8.0s | Jalandhara; Mula optional |
| Release locks | 0.5–1.0s | Release before exhale |
| Left exhale | 6.0–8.0s | None |

### Body focus

- right nostril/face;
- warmth;
- alertness;
- spine upright.

### Common mistakes

- Alternating sides like Nadi Shodhana.
- Adding forceful pumping.
- Adding retention in the base version.
- Making it too intense for evening/sleep contexts.

### Implementation YAML — base

```yaml
phases:
  - label: Inhale Right
    duration: 4.0
    breathAction: inhale
    route: right_nostril
    sideCue: right
  - label: Switch
    duration: 0.5
    breathAction: transition
    route: nostril_switch
  - label: Exhale Left
    duration: 6.0
    breathAction: exhale
    route: left_nostril
    sideCue: left
```

---

## 3.12 Viloma I / Interrupted Inhale

```yaml
id: viloma_i_interrupted_inhale
name: Viloma I
englishName: Interrupted Inhale
level: intermediate
safetyLevel: controlled
basePattern: segmented_inhale_smooth_exhale
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Builds breath awareness through stepwise inhalation.

### Correct execution

The inhale is divided into segments with brief pauses. The exhale is smooth and uninterrupted.

```text
inhale segment → pause → inhale segment → pause → inhale segment → smooth exhale
```

### Default timing

One full cycle = **14 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale segment 1 | 2.0s | Fill lower lungs/belly area |
| Pause | 1.0s | Stop gently; no bandha |
| Inhale segment 2 | 2.0s | Fill ribs/mid chest |
| Pause | 1.0s | Stop gently; no bandha |
| Inhale segment 3 | 2.0s | Fill upper chest |
| Smooth exhale | 6.0s | Release steadily through the nose |

### Body focus

- lower/middle/upper breath zones;
- gentle pauses;
- no throat gripping.

### Important rule

Viloma pauses are **not** advanced bandha-retentions.

```text
Do not add Jalandhara, Mula, or Uddiyana to Viloma pauses.
```

### Implementation YAML

```yaml
phases:
  - label: Inhale Low
    duration: 2.0
    breathAction: inhale
    zoneCue: belly
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Inhale Middle
    duration: 2.0
    breathAction: inhale
    zoneCue: ribs
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Inhale High
    duration: 2.0
    breathAction: inhale
    zoneCue: chest
  - label: Smooth Exhale
    duration: 6.0
    breathAction: exhale
    route: nose
```

---

## 3.13 Viloma II / Interrupted Exhale

```yaml
id: viloma_ii_interrupted_exhale
name: Viloma II
englishName: Interrupted Exhale
level: intermediate
safetyLevel: controlled
basePattern: smooth_inhale_segmented_exhale
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Builds breath control through stepwise exhalation.

### Correct execution

The inhale is smooth. The exhale is divided into segments with brief pauses.

```text
smooth inhale → exhale segment → pause → exhale segment → pause → exhale segment
```

### Default timing

One full cycle = **14 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Smooth inhale | 6.0s | Fill smoothly through the nose |
| Exhale segment 1 | 2.0s | Release upper chest |
| Pause | 1.0s | Stop gently; no bandha |
| Exhale segment 2 | 2.0s | Release ribs |
| Pause | 1.0s | Stop gently; no bandha |
| Exhale segment 3 | 2.0s | Release belly/diaphragm |

### Body focus

- controlled release;
- ribs softening;
- belly settling.

### Do not

- Do not make the pauses hard retentions.
- Do not add bandhas.
- Do not squeeze all air out forcefully.

### Implementation YAML

```yaml
phases:
  - label: Smooth Inhale
    duration: 6.0
    breathAction: inhale
    route: nose
  - label: Exhale High
    duration: 2.0
    breathAction: exhale
    zoneCue: chest
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Exhale Middle
    duration: 2.0
    breathAction: exhale
    zoneCue: ribs
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Exhale Low
    duration: 2.0
    breathAction: exhale
    zoneCue: belly
```

---

## 3.14 Viloma III / Interrupted Inhale and Exhale

```yaml
id: viloma_iii_interrupted_inhale_exhale
name: Viloma III
englishName: Interrupted Inhale and Exhale
level: intermediate_to_advanced
safetyLevel: controlled
basePattern: segmented_inhale_segmented_exhale
bandhaUsage:
  base: none
  advancedVariants: []
```

### Purpose

Combines both Viloma directions: interrupted inhale and interrupted exhale.

### Correct execution

```text
inhale segment → pause → inhale segment → pause → inhale segment → exhale segment → pause → exhale segment → pause → exhale segment
```

### Default timing

One full cycle = **16 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale segment 1 | 2.0s | Fill lower zone |
| Pause | 1.0s | Gentle stop; no bandha |
| Inhale segment 2 | 2.0s | Fill middle zone |
| Pause | 1.0s | Gentle stop; no bandha |
| Inhale segment 3 | 2.0s | Fill upper zone |
| Exhale segment 1 | 2.0s | Release upper zone |
| Pause | 1.0s | Gentle stop; no bandha |
| Exhale segment 2 | 2.0s | Release middle zone |
| Pause | 1.0s | Gentle stop; no bandha |
| Exhale segment 3 | 2.0s | Release lower zone |

### Body focus

- breath segmentation;
- smooth stop/start control;
- no strain in throat or face.

### Common mistakes

- Treating every pause as kumbhaka.
- Adding bandhas.
- Making the breath jerky or panicked.

### Implementation YAML

```yaml
phases:
  - label: Inhale Low
    duration: 2.0
    breathAction: inhale
    zoneCue: belly
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Inhale Middle
    duration: 2.0
    breathAction: inhale
    zoneCue: ribs
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Inhale High
    duration: 2.0
    breathAction: inhale
    zoneCue: chest
  - label: Exhale High
    duration: 2.0
    breathAction: exhale
    zoneCue: chest
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Exhale Middle
    duration: 2.0
    breathAction: exhale
    zoneCue: ribs
  - label: Pause
    duration: 1.0
    breathAction: gentle_pause
    bandhas: none
  - label: Exhale Low
    duration: 2.0
    breathAction: exhale
    zoneCue: belly
```

---

## 3.15 Gentle Kumbhaka

```yaml
id: gentle_kumbhaka
name: Gentle Kumbhaka
englishName: Gentle Breath Retention
level: intermediate
safetyLevel: advanced
basePattern: inhale_internal_hold_exhale
bandhaUsage:
  base: none
  advancedVariants:
    - gentle_kumbhaka_with_jalandhara
    - gentle_kumbhaka_with_jalandhara_mula
```

### Purpose

Introduces breath retention without force.

### Correct base execution

```text
inhale → soft internal hold → exhale
```

Base Gentle Kumbhaka does not use bandhas. It is a retention introduction.

### Default timing

One full cycle = **12 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Inhale | 4.0s | Fill smoothly through the nose |
| Internal hold | 2.0s | Hold softly; no throat clamp |
| Exhale | 6.0s | Release through the nose |

### Advanced variant: Gentle Kumbhaka with Jalandhara

```text
inhale → internal hold with Jalandhara → release Jalandhara → exhale
```

Example timing:

| Phase | Duration | Bandha |
|---|---:|---|
| Inhale | 4.0s | None |
| Internal hold | 2.0–4.0s | Jalandhara |
| Release lock | 0.5–1.0s | Release before exhale |
| Exhale | 6.0s | None |

### Advanced variant: Gentle Kumbhaka with Jalandhara + Mula

Only after the user understands both retention and Jalandhara.

```text
inhale → internal hold with Jalandhara + gentle Mula → release Mula → release Jalandhara → exhale
```

### Body focus

- calm fullness;
- center of chest;
- relaxed face/eyes;
- stable spine.

### Common mistakes

- Holding beyond comfort.
- Clamping the throat.
- Adding Uddiyana on full lungs.
- Turning a gentle retention into a competition.

### Implementation YAML — base

```yaml
phases:
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
  - label: Hold
    duration: 2.0
    breathAction: internal_retention
    bandhas: none
  - label: Exhale
    duration: 6.0
    breathAction: exhale
    route: nose
```

---

## 3.16 Kapalabhati / Skull-Shining Breath

```yaml
id: kapalabhati
name: Kapalabhati
englishName: Skull-Shining Breath
level: advanced
safetyLevel: gated
basePattern: active_exhale_pulses_passive_rebound_inhale
bandhaUsage:
  base: none_during_pulses
  advancedVariants:
    - kapalabhati_after_round_retention_optional
```

### Purpose

A forceful cleansing/energizing practice based on repeated active exhale pulses.

### Correct execution model

Kapalabhati is not implemented as “active exhale + timed active inhale.”

Correct model:

```text
sharp active nasal exhale pulse → passive rebound inhale → next exhale pulse
```

The abdominal wall snaps inward on each exhale pulse. Then the belly releases, and the inhale returns by rebound.

### Critical implementation rule

```text
The app cues the exhale pulse frequency.
The app must not cue the passive inhale as an active timed inhale phase.
```

### Default tempo model

Use pulses per minute.

| Level | Pulses/min | Pulse interval | Active exhale cue window | Rebound window | Notes |
|---|---:|---:|---:|---:|---|
| Training slow | 40/min | 1.500s | 0.150s | 1.350s | For learning abdominal snap only |
| Beginner | 60/min | 1.000s | 0.150s | 0.850s | Slow but valid teaching pace |
| Standard default | 90/min | 0.667s | 0.120s | 0.547s | App default for normal practice feel |
| Experienced | 120/min | 0.500s | 0.100s | 0.400s | Common fast visual/video tempo |
| Advanced | 140/min | 0.429s | 0.080s | 0.349s | Only for trained users |

The “rebound window” is not a command to inhale. It is simply the available time before the next pulse.

### Round structure

Use rounds, not endless loops.

| Level | Pulses per round | Rest after round |
|---|---:|---:|
| Training | 11–20 pulses | 30–60s natural breathing |
| Beginner | 20–30 pulses | 30–60s natural breathing |
| Standard | 30–60 pulses | 30–90s natural breathing |
| Experienced | 60–108 pulses | 60–120s natural breathing |

### Base phase structure

At standard default tempo:

```text
pulse every 0.667 seconds
active abdominal exhale snap during first ~0.120 seconds
passive rebound until next pulse
```

### Advanced after-round retention variant

Some schools add a retention after a Kapalabhati round. This is not part of the base pulse mechanic.

Represent as a separate variant only:

```text
Kapalabhati pulses → recovery breath → optional retention → release → normal breathing
```

Do not implement a single universal after-round retention because lineages differ on whether retention follows inhale or exhale.

### Body focus

- lower belly snaps inward on exhale;
- nostrils clear and sharp;
- chest relatively stable;
- shoulders relaxed;
- inhale rebounds naturally.

### Common mistakes

- Actively sucking air in after every pulse.
- Moving shoulders or chest dramatically.
- Making both inhale and exhale forceful; that becomes Bhastrika-like.
- Adding bandhas during each pulse.
- Continuing despite dizziness.

### Implementation YAML — standard default

```yaml
tempo:
  unit: pulses_per_minute
  default: 90
  pulseIntervalSeconds: 0.667
  activeExhaleCueWindowSeconds: 0.120
  passiveReboundWindowSeconds: 0.547
phases:
  - label: Exhale Pulse
    duration: 0.120
    breathAction: active_exhale_pulse
    route: nose
    bodyAction: lower_belly_snap_inward
  - label: Passive Rebound
    duration: 0.547
    breathAction: passive_rebound_inhale
    route: nose
    cueUserAction: false
rounds:
  beginner:
    pulses: 20
    restSeconds: 45
  standard:
    pulses: 40
    restSeconds: 60
bandhas:
  duringPulses: none
```

---

## 3.17 Bhastrika / Bellows Breath

```yaml
id: bhastrika
name: Bhastrika
englishName: Bellows Breath
level: advanced
safetyLevel: gated
basePattern: active_inhale_active_exhale_equal_force
bandhaUsage:
  base: none_during_pumping
  advancedVariants:
    - bhastrika_after_round_external_retention
    - bhastrika_after_round_maha_bandha
```

### Purpose

A vigorous bellows-style pranayama using active inhalations and active exhalations.

### Correct execution model

Bhastrika is not Kapalabhati.

Correct model:

```text
active inhale → active exhale
```

Both directions are active, forceful, and equal in duration and force.

### Default tempo model

There is no single universal canonical tempo. Implement tempo levels.

| Level | Breaths/sec | Full cycle duration | Active inhale | Active exhale | Notes |
|---|---:|---:|---:|---:|---|
| Slow training | 1.0/sec | 1.000s | 0.500s | 0.500s | Learning tempo; may look slow in videos |
| Standard default | 1.5/sec | 0.667s | 0.333s | 0.333s | Good app default if user expects real Bhastrika feel |
| Experienced fast | 2.0/sec | 0.500s | 0.250s | 0.250s | Fast video-like tempo; advanced |

### Round structure

| Level | Breaths per round | Rest after round |
|---|---:|---:|
| Training | 7–10 breaths | 30–60s natural breathing |
| Standard | 10–20 breaths | 45–90s natural breathing |
| Experienced | 20–40 breaths | 60–120s natural breathing |

### Base phase structure — standard default

One full breath = **0.667 seconds**.

| Phase | Duration | Cue |
|---|---:|---|
| Active inhale | 0.333s | Draw air in actively; belly/diaphragm expands |
| Active exhale | 0.333s | Push air out actively; belly/diaphragm contracts |

### Advanced after-round external retention

This is separate from the pumping breaths.

```text
Bhastrika pumping breaths → deep inhale → slow complete exhale → external retention → release → recovery inhale
```

Example timing:

| Phase | Duration | Cue |
|---|---:|---|
| Bhastrika pumping | 10–20 breaths | Active equal inhale/exhale |
| Deep inhale | 4.0s | Fill smoothly |
| Slow exhale | 6.0s | Empty completely but without collapse |
| External hold | 2.0–6.0s | Hold empty calmly |
| Recovery inhale | 4.0s | Smooth inhale |
| Rest | 30–90s | Natural breathing |

### Advanced after-round Maha Bandha variant

Only after external retention is understood.

```text
Bhastrika pumping breaths → deep inhale → complete exhale → external retention with Maha Bandha → release locks → recovery inhale
```

Maha Bandha sequence:

```text
external hold → Jalandhara → Uddiyana → Mula → release Mula → release Uddiyana → release Jalandhara → inhale
```

### Body focus

- diaphragm/abdomen pumping;
- active inhale and active exhale;
- equal rhythm;
- chest stable but not rigid;
- no facial strain.

### Common mistakes

- Performing Kapalabhati instead, with passive inhale.
- Making exhale stronger than inhale.
- Hyperventilating beyond control.
- Adding bandhas during every fast breath.
- Skipping recovery breathing between rounds.

### Implementation YAML — standard default

```yaml
tempo:
  unit: breaths_per_second
  default: 1.5
  fullCycleSeconds: 0.667
  activeInhaleSeconds: 0.333
  activeExhaleSeconds: 0.333
phases:
  - label: Active Inhale
    duration: 0.333
    breathAction: active_inhale
    route: nose
    bodyAction: diaphragm_abdomen_expand
  - label: Active Exhale
    duration: 0.333
    breathAction: active_exhale
    route: nose
    bodyAction: diaphragm_abdomen_contract
rounds:
  training:
    breaths: 10
    restSeconds: 45
  standard:
    breaths: 20
    restSeconds: 60
bandhas:
  duringPumping: none
  afterRoundVariants:
    - external_retention
    - maha_bandha
```

---

## 3.18 Kumbhaka with Bandhas / Advanced Retention with Locks

```yaml
id: kumbhaka_with_bandhas
name: Kumbhaka with Bandhas
englishName: Breath Retention with Locks
level: advanced
safetyLevel: gated
basePattern: retention_with_locks
bandhaUsage:
  base: explicit_bandha_module
  advancedVariants:
    - internal_retention_jalandhara
    - internal_retention_jalandhara_mula
    - external_retention_maha_bandha
```

### Purpose

This is the universal advanced retention-and-lock module used by applicable pranayamas.

It should not be presented as “the only pranayama where bandhas exist.” Instead, it defines how bandhas are added to appropriate pranayama variants.

### Internal retention version

```text
inhale → hold full → Jalandhara → optional Mula → release locks → exhale
```

Default beginner-advanced timing:

| Phase | Duration | Cue |
|---|---:|---|
| Inhale | 4.0s | Smooth nasal inhale |
| Internal hold | 4.0s | Hold full without strain |
| Apply Jalandhara | within hold | Chin lock, neck long |
| Optional Mula | within hold | Gentle root lift |
| Release locks | 0.5–1.0s | Release before exhale |
| Exhale | 6.0–8.0s | Smooth nasal exhale |

### External retention version / Maha Bandha

```text
exhale → hold empty → Jalandhara → Uddiyana → Mula → release Mula → release Uddiyana → release Jalandhara → inhale
```

Default beginner-advanced timing:

| Phase | Duration | Cue |
|---|---:|---|
| Exhale | 6.0s | Empty smoothly |
| External hold | 2.0–6.0s | Hold empty without panic |
| Apply Jalandhara | within hold | Chin lock |
| Apply Uddiyana | within hold | Abdomen inward/upward |
| Optional Mula | within hold | Gentle root lift |
| Release locks | 0.5–1.0s | Release before inhale |
| Inhale | 4.0s | Recovery inhale |

### Valid host practices

This module may be used in explicit advanced variants of:

- Nadi Shodhana;
- Ujjayi;
- Sheetali;
- Sheetkari;
- Chandra Bhedana;
- Surya Bhedana;
- Gentle Kumbhaka;
- Kapalabhati after-round retention only;
- Bhastrika after-round retention/Maha Bandha only;
- Sama Vritti only if converted into a formal retention variant.

### Invalid uses

Do not use this module in:

- Natural Breath Awareness;
- base Dirgha;
- base Extended Exhale;
- base Bhramari;
- Viloma pauses;
- individual Kapalabhati pulses;
- individual Bhastrika pumping breaths.

### Implementation YAML — internal retention with Jalandhara + Mula

```yaml
phases:
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
  - label: Internal Hold with Jalandhara and Mula
    duration: 4.0
    breathAction: internal_retention
    bandhas:
      - jalandhara
      - mula_optional
  - label: Release Locks
    duration: 0.75
    breathAction: transition
    bandhas: release_all_before_exhale
  - label: Exhale
    duration: 6.0
    breathAction: exhale
    route: nose
```

### Implementation YAML — external retention with Maha Bandha

```yaml
phases:
  - label: Exhale
    duration: 6.0
    breathAction: exhale
    route: nose
  - label: External Hold with Maha Bandha
    duration: 4.0
    breathAction: external_retention
    bandhas:
      - jalandhara
      - uddiyana
      - mula_optional
  - label: Release Locks
    duration: 0.75
    breathAction: transition
    bandhas: release_all_before_inhale
  - label: Inhale
    duration: 4.0
    breathAction: inhale
    route: nose
```

---

# 4. Quick Developer Rule Table

| Practice | Base timing | Base bandhas | Advanced bandha variant? |
|---|---:|---:|---:|
| Natural Breath Awareness | Natural | No | No |
| Dirgha | 6s in / 6s out | No | No, not as pure Dirgha |
| Sama Vritti | 4s in / 4s out | No | Yes, only if retention variant |
| Extended Exhale | 4s in / 6s out | No | No |
| Nadi Shodhana | 4s in / 6s out by nostril | No | Yes |
| Bhramari | 4s in / 8s hum out | No | Not included by default |
| Ujjayi | 5s in / 5s out | No | Yes |
| Sheetali | 4s mouth in / 6s nose out | No | Yes |
| Sheetkari | 4s teeth in / 6s nose out | No | Yes |
| Chandra Bhedana | 4s left in / 6s right out | No | Yes, soft/optional |
| Surya Bhedana | 4s right in / 6s left out | No | Yes |
| Viloma I | 2+1+2+1+2 in / 6 out | No | No |
| Viloma II | 6 in / 2+1+2+1+2 out | No | No |
| Viloma III | segmented in + segmented out | No | No |
| Gentle Kumbhaka | 4 in / 2 hold / 6 out | No | Yes |
| Kapalabhati | 90 exhale pulses/min default | No during pulses | Optional after-round only |
| Bhastrika | 1.5 breaths/sec default | No during pumping | Yes, after-round only |
| Kumbhaka with Bandhas | retention module | Yes | It is the module |

---

# 5. Common Implementation Mistakes to Avoid

## 5.1 Do not convert every practice into a bubble inhale/exhale loop

Some practices are procedural, not symmetric loops:

- Nadi Shodhana has nostril direction.
- Sheetali/Sheetkari have mouth mechanics.
- Bhramari has sound on exhale.
- Kapalabhati is exhale-pulse frequency.
- Bhastrika is active equal pumping.
- Kumbhaka with Bandhas has locks and release order.

## 5.2 Do not add retention to base practices

Retention changes the technique and safety level.

Bad:

```yaml
sama_vritti:
  phases: [inhale, hold, exhale, hold]
```

Correct:

```yaml
sama_vritti_base:
  phases: [inhale, exhale]

sama_vritti_with_kumbhaka:
  phases: [inhale, hold, exhale, hold]
```

## 5.3 Do not add bandhas to short pauses

A 1-second Viloma pause is not a bandha retention.

## 5.4 Do not time Kapalabhati as active inhale/exhale

Bad:

```yaml
kapalabhati:
  exhale: 0.3
  inhale: 0.7
```

Correct:

```yaml
kapalabhati:
  pulseInterval: 0.667
  activeExhaleCueWindow: 0.120
  passiveReboundWindow: 0.547
  cuePassiveInhale: false
```

## 5.5 Do not slow Bhastrika into an unrealistic only-default

A 1.0s full cycle is valid as a learning tempo, but many demonstrations use faster pacing. Therefore Bhastrika must expose tempo levels.

Correct:

```yaml
bhastrika_tempos:
  slow_training:
    breathsPerSecond: 1.0
    inhale: 0.5
    exhale: 0.5
  standard_default:
    breathsPerSecond: 1.5
    inhale: 0.333
    exhale: 0.333
  experienced_fast:
    breathsPerSecond: 2.0
    inhale: 0.25
    exhale: 0.25
```

---

# 6. Source Notes

This specification uses second-based implementation defaults, while many yoga sources use counts, rounds, or qualitative pacing. The exact defaults above are chosen to be executable and consistent, not to claim that all lineages use identical seconds.

Key cross-checks used for this version:

1. **Dirgha / Three-Part Breath** — belly, ribs, upper chest sequence; reverse or complete release on exhale.  
   Sources: Kripalu, Liforme, Biyome.

2. **Nadi Shodhana** — left inhale → right exhale → right inhale → left exhale sequence; advanced versions may add retention.  
   Sources: Yoga in Daily Life, Tummee, Gaia Retreat.

3. **Bhramari** — nasal inhale followed by one long continuous humming exhale.  
   Sources: YogaEasy, Tummee, Art of Living Retreat Center.

4. **Ujjayi** — nasal breathing with gentle throat/glottis constriction and soft ocean/whisper sound.  
   Sources: Nourish Yoga Training, Healthline, Wikipedia summary of Iyengar/Jois practice.

5. **Sheetali / Sheetkari** — cooling inhale through rolled tongue or teeth, close mouth, exhale through nose.  
   Sources: PMC study description, Banyan Botanicals, Tummee.

6. **Chandra Bhedana / Surya Bhedana** — single-nostril directional breathing: Chandra left-in/right-out; Surya right-in/left-out.  
   Sources: Yoga Journal, Tummee, Biyome.

7. **Viloma** — interrupted inhalation, interrupted exhalation, or both.  
   Sources: YogaEasy, Tummee, Oakwood Yoga PDF excerpt.

8. **Kapalabhati** — active exhale with passive inhale/rebound; tempo commonly expressed as pulses per minute.  
   Sources: Yoga International, YinYoga, ResearchGate summary, Metropolis India overview.

9. **Bhastrika** — active inhalation and active exhalation; can start around one breath per second and progress toward two breaths per second.  
   Sources: Yoga International, Banyan Botanicals, Yoga in Daily Life, World Yoga Forum.

10. **Bandhas and Kumbhaka** — bandhas belong to retention contexts, especially Jalandhara/Mula for internal retention and Uddiyana/Maha Bandha for external retention.  
    Sources: Himalayan Institute, Swara Yoga, Shvasa, Yoga in Daily Life, World Yoga Forum.

---

# 7. Reference Links

- https://kripalu.org/living-kripalu/how-do-three-part-breath-dirgha-pranayama
- https://liforme.com/blogs/blog/three-part-breath-dirga-pranayama
- https://biyome.com.au/pranayama-manual/dirgha-pranayama/
- https://www.yogaindailylife.org/system/en/level-4/nadi-shodhana-pranayama-level-4
- https://www.tummee.com/yoga-poses/alternate-nostril-breathing-chair
- https://www.gaiaretreat.com.au/pranayama-for-calm-and-wellbeing
- https://www.yogaeasy.com/artikel/bhramari-pranayama-humming-like-a-bumble-bee
- https://www.tummee.com/yoga-poses/bhramari-pranayama/how-to-do/2
- https://artoflivingretreatcenter.org/blog/bhramari-pranayama-bee-breath/
- https://nourishyogatraining.com/how-to-ujjayi-pranayama/
- https://www.healthline.com/health/fitness-exercise/ujjayi-breathing
- https://en.wikipedia.org/wiki/Ujjayi
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6438091/
- https://www.banyanbotanicals.com/pages/ayurvedic-sheetali-pranayama
- https://www.tummee.com/yoga-poses/sitali/how-to-do
- https://www.yogajournal.com/practice/energetics/pranayama/single-nostril-breath/
- https://www.tummee.com/yoga-poses/chandra-bhedana-pranayama
- https://biyome.com.au/pranayama-manual/surya-bhedana-chandra-bhedana-pranayama/
- https://www.yogaeasy.com/artikel/viloma-pranayama
- https://www.tummee.com/yoga-poses/viloma-pranayama/steps
- https://oakwoodyoga.co.uk/wp-content/uploads/2021/01/Viloma-Pranayama.pdf
- https://yogainternational.com/article/view/learn-kapalabhati-skull-shining-breath/
- https://yinyoga.com/yinsights/kapalabhati/
- https://www.researchgate.net/publication/24040576_A_Nonrandomized_Non-Naive_Comparative_Study_of_the_Effects_of_Kapalabhati_and_Breath_Awareness_on_Event-Related_Potentials_in_Trained_Yoga_Practitioners
- https://www.metropolisindia.com/blog/preventive-healthcare/kapalbhati-benefits
- https://yogainternational.com/article/view/learn-bhastrika-pranayama-bellows-breath/
- https://www.banyanbotanicals.com/pages/ayurvedic-bhastrika-pranayama
- https://www.yogaindailylife.org/system/en/level-8/bhastrika-pranayama-with-maha-bandha
- https://worldyogaforum.com/pranayama/bhastrika-pranayama/
- https://himalayaninstitute.org/online/bandhas-and-mudras/
- https://swarayoga.org/bandha
- https://www.shvasa.com/yoga-blog/what-are-the-bandhas
