# Title IDs and Game Versions

A game name is not enough to uniquely identify the correct HENCC entry. The two most important compatibility fields in the catalog are the **Title ID** and the **game version**.

HEN Cheats Collection keeps these values visible on cards, direct links and detail pages because they help distinguish releases that may look identical by title but are not the same target.

## What is a Title ID?

A Title ID is an identifier associated with a particular PlayStation title/package. In HENCC, PlayStation 4 entries normally use identifiers beginning with `CUSA`, while PlayStation 5 entries normally use identifiers beginning with `PPSA`.

Examples of the shapes are:

- `CUSA18723` — a PlayStation 4-style ID;
- `PPSAxxxxx` — a PlayStation 5-style ID.

The important point is not the prefix alone. The full ID matters.

## Why can the same game name have multiple IDs?

The same commercial game title can appear under more than one Title ID. Different releases, regions or packages can have different identifiers even when the displayed game name is the same or almost the same.

For that reason, searching only by title can return several legitimate HENCC entries. The Title ID shown on the card/detail page is how you distinguish them.

## What is the game version?

The version identifies the game/update revision represented by that HENCC entry. A Title ID can have several versions in the collection, and the detail page exposes those versions as a horizontal version strip.

For example, version `01.22` and version `01.21` are treated as different catalog targets even when they belong to the same Title ID.

## Why does the version matter?

Cheats frequently depend on the executable/data layout of a specific game update. When a game is updated, relevant addresses, offsets or code can change. HENCC therefore does not assume that a source created for one version automatically works on another.

A file listed under `01.22` should be treated as a `01.22` source unless its own Notes explicitly provide broader compatibility information. The absence of a warning is not a guarantee of cross-version compatibility.

## Title ID + version is the useful pair

A practical way to think about HENCC is:

**Game title** helps a human find the game.

**Title ID + version** identifies the catalog target.

**Source file** identifies the specific cheat file within that target.

When sharing a problem report, all three levels are useful.

## Direct links preserve the pair

HENCC direct game links use this structure:

`/game/<TITLE_ID>/<VERSION>/`

For example, a direct link can point to one exact Title ID and version instead of merely opening the catalog at a game title.

The Copy link button in the detail page uses the currently selected version so the recipient receives the same context you were viewing.

## How version selection works on the website

When you open a game card, HENCC selects the numerically newest version available for that catalog entry. You can then switch to another listed version using the version strip.

Switching versions changes the version-specific source data and updates the clean game/version URL. The source files shown below belong to the active version.

## What if Added or Updated is blank?

HENCC derives these summary dates per Title ID from optional public metadata. Added is the earliest recorded date for the ID. Updated is the latest recorded update date, but the interactive summary shows a dash when Updated is missing or when it is identical to Added because there is no separate update date to present. This does not change the Title ID/version match.

## How to choose an entry

Before downloading a source:

1. Find the correct game title.
2. Confirm the full Title ID.
3. Select the exact version you intend to use.
4. Inspect the available source files for that version.
5. Check format, process, Notes and Issue metadata.

If the Title ID or version does not match what you expected, stop there and locate the correct catalog entry rather than assuming a nearby version is equivalent.

## CUSA versus PPSA in HENCC

HENCC uses the identifier prefix to present the platform badge:

- `CUSA…` entries are shown as **PS4**;
- `PPSA…` entries are shown as **PS5**;
- other identifiers can be categorized as **Other** by the catalog filter.

This platform inference helps browsing, but the full Title ID still remains the actual catalog identifier.

## Matching is more important than popularity

A source with more rows, more creators or a more familiar format is not automatically the correct source. Matching the intended Title ID and version comes first.

When a source does not work as expected, version mismatch is therefore one of the first things to check. Continue with [Troubleshooting HENCC Entries](/guides/troubleshooting/) for a structured diagnostic list.
