# Troubleshooting HENCC Entries

When a source does not look or behave as expected, start with the metadata HENCC already exposes. Most useful checks can be performed without guessing: confirm the Title ID, version, source file, format, process, Notes and Issue state in order.

This guide is about diagnosing **collection-entry and compatibility information**. It does not provide instructions for bypassing console security or jailbreaking hardware.

## 1. Confirm the Title ID

Do not rely on the game title alone. HENCC can contain several entries with the same or similar title under different Title IDs.

Compare the complete `CUSA...` or `PPSA...` identifier with the entry you intended to use. If the ID is different, locate the correct game entry before investigating anything else.

## 2. Confirm the selected version

Next, check the active version tab. A source listed under one update version should not be assumed to work with another update version.

If you arrived through a shared link, verify the version in both the detail view and the URL. HENCC direct links include the selected version specifically to avoid losing that context.

## 3. Confirm the exact source file

A game/version can contain several files. Two files can share the same format while coming from different creators or containing different cheat rows.

Identify the exact source by its displayed filename and creator list. When reporting a problem, “the Elden Ring SHN” can be ambiguous if several SHN sources exist; the filename/source is much more useful.

## 4. Check the format

Verify that the source format is the format you intended to use. HENCC currently labels JSON, MC4 and SHN sources separately and does not treat them as interchangeable.

The version tab shows a summary of available formats, while the individual source row shows the actual format for that file.

## 5. Check the process field

Source metadata can include the target process, such as `eboot.bin` or another process name. If the source expects a different process from the one you assumed, that is meaningful compatibility information.

HENCC displays the process as source metadata; it does not silently rewrite it.

## 6. Read Notes

If a source contains Notes, read them before assuming the source is broken. Notes can contain source-specific context that does not apply to every other file in the same game/version.

Because Notes belong to the individual source, switching to another file can legitimately show different information.

## 7. Check the Issue state

A source marked with an **Issue** warning has already been flagged as having a reported problem. Treat that warning as relevant evidence rather than ignoring it because the file remains visible.

The file may still be useful for investigation or for users who understand the specific issue, but the warning means HENCC is intentionally communicating that the source should not be treated as problem-free.

## 8. Consider conflicting cheats

Some cheat combinations can conflict with each other. If a source contains many rows and the unexpected behavior appears only after several options are enabled together, reduce the test to the smallest relevant set rather than assuming the entire file is invalid.

Source row names may also include their own requirements or ordering hints. Preserve and read those names as written; HENCC does not normalize the creator's labels.

## 9. Do not “correct” source text automatically

Cheat row names are displayed from the source data stored by HENCC. A typo, unusual capitalization or repeated symbol in a row name can originate in the source itself.

HENCC intentionally preserves that source text instead of silently rewriting the creator's labels. If the wording is confusing but the underlying source is otherwise valid, that is different from a parser or website error.

## 10. Compare another source for the same version

If several source files exist for the same Title ID/version, compare them. Another source may have a different creator, format, row set, process or Issue/Notes state.

The existence of an alternative source does not prove the first source is bad, but it can help determine whether the problem is source-specific or affects the entire game/version entry.

## 11. Distinguish website problems from source problems

A **website problem** is something like:

- the wrong file is downloaded for the source you clicked;
- a hidden source appears unexpectedly;
- a source's metadata is shown under the wrong version;
- the detail page fails to load a valid version JSON;
- a direct game/version URL opens the wrong entry.

A **source problem** is something like a specific cheat row not behaving as expected while the website correctly identifies and downloads the intended file.

Both can be reported, but describing which category you observed helps maintenance.

## 12. Report the exact source

Use the Report Issue action on the expanded source whenever possible. HENCC opens the GitHub Cheat issue form and pre-fills its Cheat information with:

- game ID;
- version;
- source ID/file context;
- game title;
- creator information;
- a direct link back to the exact game/version.

Keep that identifying information in the report and add a concise description of what you observed.

## Quick checklist

Before reporting a source, confirm:

- [ ] The game title is the one you intended.
- [ ] The full Title ID matches.
- [ ] The selected game version matches.
- [ ] You identified the exact source file.
- [ ] The file format matches your intended workflow.
- [ ] You checked the process field.
- [ ] You read any Notes.
- [ ] You noticed any existing Issue warning.
- [ ] You considered whether enabled cheats conflict.
- [ ] You can describe whether the problem is in the website or in the source behavior.

For basic navigation before troubleshooting, see [Getting Started](/guides/getting-started/).
