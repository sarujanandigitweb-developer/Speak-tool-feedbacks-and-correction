# How to export the Apps Script source

> **Status: done for Unit 3 Lampshade.** Those 5 files are in [scripts/](../scripts/) and
> reviewed in
> [02-code-walkthrough.md](../documentation/02-code-walkthrough.md). The seven questions
> below are all answered there except #7.
>
> **Still to do: the other five stations.** Each runs its own copy and none have been
> diffed. That diff measures the drift and sizes the consolidation work in
> [Upgrade Proposal §5](../capability/upgrade-proposal.md).

---

## Option A — copy by hand (2 minutes, no setup)

1. Open the station sheet, e.g.
   [Unit 3 Lampshade](https://docs.google.com/spreadsheets/d/1AMQMzxukdx3GMNSPmL20_8X6f-w_iUgCJVOyAjneSMU/edit?gid=0)
2. `Extensions → Apps Script`
3. In the left file list, open each file — typically `Code.gs` plus one or more `.html`
   files (the modal is an HTML service dialog).
4. Copy each file's contents into this repo under `documentation/script/<station>/`.

Do this for **all six stations** if possible. The diff between copies is itself a finding —
it will show how far the six have drifted (see
[Upgrade Proposal §5](../capability/upgrade-proposal.md)).

## Option B — `clasp` (proper, and sets up version control)

```bash
npm install -g @google/clasp
clasp login

# script ID is in the Apps Script editor under Project Settings
clasp clone <SCRIPT_ID> --rootDir ./documentation/script/unit3-lampshade
```

Repeat per station. Then commit — this gives the script a git history for the first time,
which [Upgrade Proposal §5](../capability/upgrade-proposal.md) recommends anyway.

---

## The seven questions — answers

Full working in
[02-code-walkthrough.md](../documentation/02-code-walkthrough.md).

| # | Question | Answer |
|---|---|---|
| 1 | Utterance assembly — any SSML? | **No SSML.** Postcodes *are* split per character, but the internal space is dropped (`Lithursan.gs:188`) and product names pass through raw — `split(" ").join(" ")` at `:174` is a no-op. |
| 2 | Recognition restart? | `continuous = true`, but `stop()` is followed immediately by `start()` (`:886`), which throws; `onerror` does not restart. The mic also stays open while the tool speaks, so it **triggers its own "post code" command**. |
| 3 | How are merges grouped? | By the `Merge Order` column, but only across **physically adjacent rows** (`cleaned.gs:80`). Combo rows inside a merge get no label at all. The `merge order total: N` wording FB-140 objected to is generated at `cleaned.gs:93`. |
| 4 | Names sheet read live? | **Yes** (`cleaned.gs:13`) — nothing was lost. The fault is the lookup key: `slice(0, -3)` strips 3 chars to remove a 2-char `"PK"` (`:112`), and a failed lookup blanks the quantity (`:116`). |
| 5 | Columns by name or index? | Both. `Lithursan.gs:29` matches by name, first-match-wins, so the duplicate P/Q are ignored. `cleaned.gs` uses hardcoded column numbers, and hardcodes the SKU `"RPR44WH"` in shared cleaning logic (`:280`). |
| 6 | Blank `Name`/`Quantity`/`Post Code`? | Silent. 12px grey text in `#voiceFeedback` and the tool moves on (`:728`). |
| 7 | How different are the six copies? | **Still open** — only one was exported. |

---
