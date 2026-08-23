# Cheat File Formats in HENCC

HEN Cheats Collection can contain several source files for the same game and version. One of the reasons is that the collection supports more than one file format. The website currently labels supported sources as **JSON**, **MC4** or **SHN**.

The format badge is descriptive metadata. It tells you how that source is stored in the collection and helps you distinguish otherwise similar sources. HENCC does not treat the formats as interchangeable names for one universal file.

## JSON

JSON sources are structured text files. Within HENCC they can contain the game/version metadata and the cheat definitions represented by that source. On the website, a JSON source is displayed as its own file with its creator information, process, row count, Notes/Issue metadata and cheat rows.

The fact that a source is JSON does not mean every JSON source has the same internal content or that one JSON file can replace another source for the same game. The file still belongs to a specific Title ID/version entry.

## MC4

MC4 is another cheat-file format represented in the collection. HENCC keeps MC4 sources separate from JSON and SHN rather than silently converting them for presentation.

A version tab can show MC4 alongside other format labels when at least one source for that version uses MC4. Expand the individual sources to see which file actually carries that format.

## SHN

SHN sources are also represented as distinct physical files. Like JSON and MC4, an SHN source retains its own creator attribution, process metadata, row count, Notes and Issue state.

Multiple SHN files can exist for the same Title ID/version when they are genuinely separate sources. HENCC does not collapse them merely because the format badge is the same.

## Why can one version have several files?

Several situations can produce multiple files under one game/version:

- different creators supplied different sources;
- different file formats exist for the same version;
- two sources contain different cheat sets;
- separate sources were retained because they are not byte-for-byte or logically identical;
- a source contains Notes or an Issue state that should remain attached to that specific file.

This is why the detail page presents a list of source files instead of a single “download everything” button.

## Format is not the only compatibility check

The correct format alone is not enough to identify the right entry. You should also confirm:

- the game Title ID;
- the game version;
- the individual source file;
- process metadata when relevant;
- Notes and Issue information.

For example, a JSON file listed under one Title ID/version should not be assumed to match another Title ID/version simply because both are JSON.

## Version-tab format summaries

Each version tab shows the set of formats available for that version. This is a summary for quick scanning. The source list below is authoritative for which physical files are actually available.

If a version tab says `JSON · SHN`, that means at least one visible JSON source and at least one visible SHN source are present for that version. It does not mean there is one combined JSON/SHN file.

## Creator attribution remains source-specific

A creator name shown on one source belongs to that source's metadata. Another format under the same version can have a different creator or creator list.

When discussing or reporting a problem, identify the exact source filename or source creator in addition to the format whenever possible.

## What HENCC does not do on this page

This guide explains how HENCC **labels and presents** its file formats. It is not a guide for bypassing console security, modifying firmware or jailbreaking PlayStation hardware. HENCC's public documentation intentionally stays focused on the collection, its metadata and compatibility-oriented browsing.

For choosing the correct game/version before selecting a format, read [Title IDs and Game Versions](/guides/title-ids-and-versions/).
