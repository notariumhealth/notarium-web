# Roadmap

Notarium is in active development. This page is the plain version of where things stand: what already works, what release is current, and what comes next. It gets updated when milestones land, not on a marketing schedule.

The release naming is simple. The alpha is the 0.8 series, which is where the project is today. The beta will be 0.9.0. The first stable release will be 1.0.0, on F-Droid and Google Play, free.

## Built and working today

The core promise works now. You can log symptoms, moods, flares, medications, treatments like physical therapy or acupuncture, notes, and health events in one or two taps, from inside the app or straight from a home-screen widget. Structured clinical assessments (PHQ-9, GAD-7, ASRS) score themselves as you fill them in. Everything is stored on your device, encrypted in layers, with no account and no telemetry.

The documentation side is the reason Notarium exists, and it shipped early. You can keep timestamped records of health-related leave and workplace-accommodation requests, attach files as evidence, and generate organized PDF reports for a clinician, HR, or an attorney. Generated reports are sealed into the app's tamper-evident record, so you can show that what you exported is what you logged.

Your history can come with you. Importers work today for Bearable, Daylio, Flaredown, drip., Medisafe, MedTimer, MyTherapy, Apple Health exports, Visible, Privacy Friendly Pain Diary, and generic CSV, alongside Health Connect for wearable and fitness data from sources like Fitbit and Google Fit. A combined History feed brings all of it into one timeline, with a two-pane layout on tablets and foldables. Insights show your data back to you as health-metric trend charts, a home-screen sparkline card, and an opt-in correlation view that is deliberately careful about what it claims: association is a starting point for a conversation, not proof. Weather correlation works the same way and is off by default.

Rounding out the alpha: encrypted local backup and restore, an emergency medical ID card, goals and pacing, cycle tracking that can be hidden across the entire app, and a guided first-run setup.

## Now: closing out the alpha

The current release is 0.8.1. The work right now is not features. It is the unglamorous part: hardening, real-device testing, and standing up the support infrastructure a beta needs.

## Next: a small beta

Version 0.9.0 goes to the early-access list first. If you want in, join the waitlist on the [home page](https://notarium.health/#waitlist) and you will hear from us when invites go out. Beta feedback drives fit and finish for the stable release, and the F-Droid and Play Store submissions get finalized during this window.

## Then: 1.0

The first stable release lands on F-Droid and Google Play, free. It ships when it passes its release gates for quality, data safety, and security posture, not on a fixed date.

## After 1.0

Three directions are planned, none with promised dates. Optional sync, end-to-end encrypted, that you can point at a server you host yourself; it will be opt-in, off by default, and the server will only ever see ciphertext. An iOS version, which is already partially built under the hood. And better paths for wearables and automation that do not require cloud accounts.

## What will never be on this page

Analytics, advertising, crash reporters, third-party SDKs, engagement mechanics, or anything that sells, shares, or phones home with your data. This section exists so you can hold us to it. The code is public at [github.com/notariumhealth/notarium](https://github.com/notariumhealth/notarium), so you do not have to take our word for anything above.
