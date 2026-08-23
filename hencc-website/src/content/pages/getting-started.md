# Getting Started with HEN Cheats Collection

HEN Cheats Collection is designed to help you move from a game name to the exact catalog entry that matches the game information you already have. The most important habit is to treat **Title ID and game version as part of the identity of an entry**, not as optional details.

## 1. Search the catalog

The main search field accepts game titles, Title IDs and creator names. Search is tolerant of punctuation and formatting differences, so you normally do not need to type a title exactly as it appears on the card.

Examples of useful searches include a game name, a `CUSA` or `PPSA` identifier, or the name of a creator whose files you want to find. Results update while you type, while the shareable `?q=` URL is updated after typing settles so the browser history is not filled with one entry per keystroke.

You can also narrow results with the platform and format filters, then sort the catalog by featured order, recently added date, title or number of versions.

## 2. Open the correct game

A game card shows the Title ID, available formats, version count and creator information. Similar or identical game names can exist under more than one Title ID, so do not choose an entry only because the title looks correct.

Opening a card takes you to the newest available version for that catalog entry. The detail view has a clean shareable path in this form:

`/game/<TITLE_ID>/<VERSION>/`

That route keeps the exact Title ID and selected version in the link.

## 3. Check the version tabs

The horizontal version strip lists the versions HENCC currently has for that Title ID. Selecting another version changes the version-specific data shown below it.

The format labels under each version tab summarize the formats available for that particular version. They do not mean every source in that version has every listed format.

Before choosing a file, confirm that the version you selected is the version you intended to inspect. A file made for one game update should not be assumed to work with another update just because the game title is the same.

For a deeper explanation, read [Title IDs and Game Versions](/guides/title-ids-and-versions/).

## 4. Read the game summary

The detail page shows ID-level summary information:

- **Files Total**, the number of visible source files across all versions of the Title ID;
- **Updated**, the latest recorded update date for the Title ID when it differs from Added;
- **Added**, the earliest recorded date for the Title ID.

In the interactive view, a dash means the date is not recorded. For Updated, a dash can also mean the latest Updated date is the same as Added, so there is no separate update date to show. This is not an error in the game entry.

## 5. Inspect the individual source files

Each source file is presented separately. A source row can show:

- creator or creators;
- file format;
- row count;
- the exported filename;
- an Issue state when a known problem has been marked;
- Notes when source-specific information is available.

Expand a source to see its cheat rows and any additional source information. HENCC intentionally keeps sources separate because two files for the same game/version may come from different creators or contain different cheats.

## 6. Understand the format label

HENCC currently exposes JSON, MC4 and SHN source formats. The label describes the source-file format in the collection; it does not imply that the formats are interchangeable.

If several formats are available, choose the one that matches the software/workflow you already use. See [Cheat File Formats in HENCC](/guides/file-formats/) for the collection-specific explanation.

## 7. Read Notes and Issue warnings

A source with an **Issue** marker has been flagged as having a reported problem. Treat that warning as relevant information before downloading or relying on that source.

A source can also include **Notes**. Notes are rendered directly in the expanded source view and may contain compatibility information or other context that belongs specifically to that source.

Do not ignore these fields just because another source for the same game/version has no warning. Issue and Notes metadata are source-specific.

## 8. Download the source you selected

The download action belongs to an individual source file. The website builds the download from the source's exported path in the HEN Cheats Collection repository.

After a successful browser-initiated download, HENCC stores a local Downloaded marker in your browser so the interface can indicate that the source has previously been downloaded on that device/browser profile.

This marker is only local browser state. It is not an account, cloud history or verification that the file was used successfully.

## 9. Use Favorites for games you revisit

The heart button adds or removes a game from Favorites. Favorites are stored locally in your browser and can be viewed through the Favorites catalog mode.

Favorites are identified by game ID. Clearing browser storage, using another browser/profile or using another device can therefore produce a different Favorites list.

## 10. Copy an exact game/version link

The **Copy link** action creates a link to the currently selected game/version. This is preferable to sending only a game title because the link carries the exact Title ID and version context.

If you are discussing a problem with someone else, share the direct game/version link and identify the specific source file when possible.

## 11. Report a problem with a source

Expanded sources provide a **Report Issue** workflow that opens a pre-filled GitHub issue for the exact game, version and source file. The generated report includes identifying information so TeeKay87 can tell which source you mean.

Before reporting, check the existing Issue state, Notes, Title ID and version. If the problem remains, describe what happened as clearly as possible without removing the generated identifying information from the report.

## Recommended workflow

For most visitors the safest HENCC workflow is:

1. Search for the game or exact Title ID.
2. Confirm the Title ID.
3. Select the intended game version.
4. Compare the available source files and formats.
5. Read Issue and Notes information.
6. Expand the source and inspect its cheat rows.
7. Download only the source you intended to use.
8. Report source-specific problems with the built-in reporting link.

If something still looks wrong, continue with the [Troubleshooting guide](/guides/troubleshooting/).
