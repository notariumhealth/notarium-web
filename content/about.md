# About

<!-- The trailing "- Sophia" below is read as a signature only because it is the
     only dash-led block in this file. Adding any bullet list here will turn it
     into a plain list item instead - see tools/render.mjs in notarium-web. -->

I'm Sophia Daw. I built Notarium because I needed it for myself and the apps I'd been using couldn't be stitched together into anything that worked.

Sometime in my thirties I came down with POTS and dysautonomia, with full syncope episodes. The diagnoses kept growing: hypermobile Ehlers-Danlos, chronic fatigue, post-exertional malaise, long COVID. There's the neurodivergence and the mental-health overlap that often comes with this kind of body. I'm on sixteen medications and supplements. Exercise makes me worse instead of better. My life was documented in spreadsheets and data exports because no app held the whole picture.

When my employer's accommodations process started, I wasn't as ready as I could have been. Almost a year went by before stay-at-work accommodations came through. During that year I got written up for health-related tardiness while waiting on the very paperwork that would have made the tardiness a protected event. I didn't have a clean record of what was happening day to day, what I'd reported, or when. The interface between my body, my work, and the legal process didn't exist in any tool I was using.

The apps I'd tried weren't bad. Daylio has a beautiful interface but a thin notion of factors and flares. Bearable has the data model but a tedious entry flow that wore me down. Medisafe handles a missed dose but not a stretch of missed doses, and it's pharma-backed in ways I don't trust with my health data. My Google Forms were a bandaid. I left feedback for the developers of each of these. The features I needed never came.

So I started consulting with a friend who is a senior developer, and the project that became Notarium took shape. It's a private, local-first mobile app for people doing what I'm doing: living in a body that requires documentation, navigating a workplace process that requires evidence, and trying to spend as few clicks per day on the logging as possible.

## Why trust the engineering

My background is in security engineering for regulated industries: healthcare for several years, then financial services. I've been in IT and security since 2009, when my first job was at Dell. I hold a CISSP certification from ISC2. The decisions about how Notarium handles your data come from over a decade of doing the same job for healthcare PHI and financial PII.

That means: everything stays on your device by default. Any future sync is opt-in per row of data, never global. There are no analytics, no crash reporting, no ad SDKs, no third-party telemetry. Notarium will be open source, so you'll be able to verify these claims yourself.

## What Notarium stands for

Built with accessibility in mind, because when we build for everyone, everyone benefits.

That means designing for one-tap logging when your hands shake or your brain is foggy. It means producing organized, timestamped documentation that you can share with HR, an attorney, or the EEOC if your accommodation process needs it. It means the app survives missing inputs. Engineers call that graceful degradation. The reference is the Muji flashlight that takes one to four AA batteries: four make it brightest, three make it less bright, one is still useful. Notarium is built the same way. A wearable that didn't sync, a Health Connect permission you haven't granted, a day of medication logs: any of these can be missing, and Notarium still gives you something useful.

## What you can do from here

Notarium is in development. Join the waitlist at [notarium.health](https://notarium.health) and I'll let you know the moment it's ready for Android. When it ships it'll be free, on both F-Droid and Google Play.

If you've been stitching apps together and exporting spreadsheets to make sense of your own body and health, you're not alone.

- Sophia
