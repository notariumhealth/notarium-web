# Credits

Notarium was designed after a close study of the health-tracking apps that already exist, and much of what shaped it came from open-source and source-available projects whose authors published their code, data models, and export formats for anyone to read.

Notarium does not contain their code. What it contains is the result of reading their work and, in a number of places, adopting a data shape, an import format, an interaction pattern, or a design principle they got right. This page records what was learned and who built it.

Where a project's license is copyleft (GPL or AGPL), the source was read for understanding and interoperability only, and none of its code was incorporated into Notarium. The credit below is the courtesy attribution good practice asks for regardless of whether a license compels it.

## Open-source projects

### Pain Tracker

- **Source:** [github.com/CrisisCore-Systems/pain-tracker](https://github.com/CrisisCore-Systems/pain-tracker)
- **Author:** CrisisCore-Systems
- **License:** MIT

Pain Tracker's Protective Computing framing was adopted wholesale. It designs for use under pain, fatigue, interruption, and coercive conditions, and it treats employers, insurers, abusive partners, and opposing counsel as part of the threat model rather than treating a lost phone as the whole of it. That framing shaped Notarium's own threat model and its trauma-informed logging floor. Its zero-knowledge, AES-GCM, no-sync-by-default posture is the closest reference for any opt-in sync Notarium adds later.

### drip. and sympto

- **Source:** [gitlab.com/bloodyhealth/drip](https://gitlab.com/bloodyhealth/drip), with the method rules at [gitlab.com/bloodyhealth/sympto](https://gitlab.com/bloodyhealth/sympto)
- **Authors:** the Bloody Health collective
- **License:** GPL-3.0, read for understanding and interoperability, code not incorporated

drip.'s cycle-day schema confirmed the decision to scope menstrual logging to bleeding for symptom correlation rather than to fertility prediction. Its bleeding-intensity values map one to one onto Notarium's flow intensity, which makes an import from drip. lossless, and drip.'s CSV export is a first-class importer source. Its values carried over as well: keeping the method rules in a separate auditable repository, a design that is inclusive rather than defaulted to pink, and storage that stays on the device.

### MedTimer

- **Source:** [github.com/Futsch1/medTimer](https://github.com/Futsch1/medTimer)
- **Author:** Futsch1
- **License:** MIT

MedTimer sets the reminder-reliability bar Notarium's medication engine has to match on day one. Its database entities were read as a reference while shaping the medication schema, and its JSON and CSV exports are a primary importer path. Reading its CSV export code corrected an error in Notarium's own importer specification.

### Flaredown

- **Source:** [github.com/rubyforgood/Flaredown](https://github.com/rubyforgood/Flaredown)
- **Authors:** Ruby for Good and the original Flaredown creators
- **License:** GPL-3.0, read for understanding and interoperability, code not incorporated

Flaredown's polymorphic trackable schema is the reference behind Notarium's factor and trigger model, which is how user-defined tracking stays flexible without a schema change per new thing tracked. Notarium also mirrors Flaredown's decision to model a condition as a separate entity from a symptom, which Flaredown gets right. Its open codebase and its public dataset make it an importer source too.

### Gadgetbridge

- **Source:** [codeberg.org/Freeyourgadget/Gadgetbridge](https://codeberg.org/Freeyourgadget/Gadgetbridge)
- **Authors:** the Gadgetbridge contributors
- **License:** GPL-3.0, read for understanding and interoperability, code not incorporated

Gadgetbridge is the privacy-respecting route to wearable data, including heart rate, heart-rate variability, sleep, steps, and blood oxygen, with no vendor account and nothing leaving the device. It demonstrates that pacing features do not require a vendor cloud. Notarium treats a live Health Connect bridge as the primary path and Gadgetbridge's database export as the way to bring in deep history.

### Privacy Friendly Pain Diary

- **Source:** published by the SECUSO research group at Karlsruhe Institute of Technology, distributed on F-Droid
- **Authors:** the SECUSO research group
- **License:** GPL-3.0, read for understanding and interoperability, code not incorporated

An academic reference for what a small, honest pain-diary schema contains: location, intensity, nature, and time, plus medications and notes. It is also an importer source, through its PDF export and, for people who want it, its raw database file.

### OpenScale

- **Source:** [github.com/oliexdev/openScale](https://github.com/oliexdev/openScale)
- **Author:** oliexdev and contributors
- **License:** GPL-3.0, read for understanding and interoperability, code not incorporated

OpenScale is where the principle came from that the absence of a permission is a stronger privacy guarantee than a promise about how a permission is used. It ships with no internet permission at all. That is the model for Notarium's core, which holds no internet permission either.

### HealthLog

- **Source:** [github.com/MBombeck/HealthLog](https://github.com/MBombeck/HealthLog)
- **Author:** Marc Bombeck
- **License:** AGPL-3.0 for the work studied, read for understanding and interoperability, code not incorporated

The best free Apple Health importer design available to read: a documented parser that streams the export archive rather than loading it. It is prior art for Notarium's own importer. Its versioned key map with zero-downtime rotation is prior art worth rereading before building key rotation, and its write-up of fail-closed cryptography, where every failure path throws rather than silently writing plaintext, states the same principle Notarium holds.

## Source-available projects

These projects publish their source under a license that is not an OSI open-source license, so they are listed separately. The design and interaction ideas below were reimplemented independently in Notarium's own code. No source was copied or adapted.

### Clove

- **Source:** [github.com/colbyb2/clove-ios](https://github.com/colbyb2/clove-ios)
- **Author:** Colby Brown
- **License:** Creative Commons Attribution-NonCommercial 4.0 International, source-available and non-commercial rather than open source

Clove's single-form, fatigue-aware daily entry is the pattern Notarium's logging flow was studied against, along with its compassionate approach to symptom tracking. The specific patterns adopted:

- **Two-tier daily logging.** Inline sliders for light fields, collapsible sheets for heavier entries, so a full day of logging does not demand a full day's attention.
- **A continuity card for yesterday.** A low-friction prompt that appears only when there is something to catch up on.
- **One-time symptoms.** Logging an intermittent symptom for a single day without it permanently joining the tracking list.
- **Accessible inputs.** A user-switchable preference between sliders and large steppers.
- **Plain-English insights.** Correlations led by plain language with a glossary, and technical detail available underneath rather than in front.
- **Fatigue-aware onboarding.** Progressive disclosure and educational empty states, so a person with a chronic condition is not met with everything at once.
- **Manual weather correlation with no network call**, as the baseline that works before any integration is granted.

## The wider landscape

These projects informed the landscape study without contributing one specific pattern. They are credited for the reference.

- The medication apps surveyed for reminder, multi-profile, and refill patterns: [MediTrak](https://github.com/AdamGuidarini/MediTrak), [RxDroid](https://github.com/jclehner/rxdroid), Calendula, Daily Pill, Simpill, and Medic Log.
- The minimalist mood and journaling apps surveyed: MyMood, My Brain, Tempo, moreDays, and Mini Moods. Mini Moods showed how minimal a daily mood entry can be while still feeling worth doing, and that minimalism informed Notarium's own quick-log flow.

## Building blocks

Notarium stands on open-source infrastructure as well. These are dependencies rather than apps whose ideas were studied, but they deserve the nod: SQLCipher by Zetetic for the encrypted database, Syncthing as the recommended user-side encrypted-backup transport, Automerge and Yjs as candidate libraries for any future opt-in sync, and Open-Meteo as the keyless, opt-in weather source.

## Icons

The four line icons on the home page are drawn in the visual idiom of Feather
Icons by Cole Bemis, MIT licensed, and its fork Lucide, ISC licensed. The paths
are not identical to either set, but the vocabulary is theirs and the credit
belongs to them.

## A note on proprietary sources

Notarium also studied a number of closed-source apps, mostly in order to build importers so that their users can leave without losing their history. These are not open source and are named here only for interoperability and context, not for any code or design reused from them: Bearable, Daylio, Medisafe, MyTherapy, Visible, Human Health, and Apple Health as an export format.
