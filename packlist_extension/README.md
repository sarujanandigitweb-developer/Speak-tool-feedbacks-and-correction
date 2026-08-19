# Speak Tool — Order Pack List extension

Voice packing added **on top of** the dashboard's existing Order Pack List page.
The pack list UI is not changed, not restyled and not rebuilt.

---

## Install

Add **one line** before `</body>` of the pack list page:

```html
<script src="packlist-speak.js"></script>
```

That is the whole installation. `packlist-speak.js` is self-contained — it carries the
names master, the Lampshade SOT and the packing rules inside it, so it makes no network
calls and needs no Google authentication.

### The loader page — open any pack list, no file editing

**`speak-loader.html`** is a single self-contained page.

```
packlist_extension/speak-loader.html     ← open this in Chrome
```

**The whole flow is two steps.** Drop the Order Packing HTML on it, and *this page becomes
the pack list*, with the Speak Tool running and the whole window to work in. **← Open
another** in the top right, or the browser Back button, returns to the chooser.

There is no frame and nothing to detect. An earlier version showed the pack list inside an
iframe and then asked the frame whether the tool had started — but a page loaded from
`file://` is a different origin, so that question always threw, and a tool that was running
perfectly well got reported as *"did not start"*. Navigating removes the question entirely.

Nothing is edited, nothing is uploaded anywhere, and the original file on disk is never
touched.

**Save a copy** on the same page writes `<name>.speak.html` — the same pack list with the
tool inside — for sending to another computer.

### Using it with a new pack list you have downloaded

On the live dashboard you add the line **once** and every future pack list has the tool
automatically. For a one-off HTML file you saved to disk, use the injector:

```bash
node packlist_extension/add-speak.js  ~/Downloads/packlist-today.html
```

It writes **`packlist-today.speak.html`** beside the original and leaves the original
untouched. The tool is inlined, so that one file is self-contained — move it, copy it to a
station, double-click it, it works.

```
node packlist_extension/add-speak.js  a.html b.html c.html    # several at once
node packlist_extension/add-speak.js  a.html --link           # link instead of inline
node packlist_extension/add-speak.js  a.html --force          # replace an existing output
```

Running it twice on the same file is safe — it detects the tool is already there and skips.

### Voice needs http — one command

A page opened from disk has the URL `file:///…` and therefore the origin **`null`**. Chrome
cannot attach a microphone permission to a null origin, so voice commands are refused no
matter what anyone clicks. It is not a setting, and no change to the tool can lift it.
`http://localhost` **is** a trusted origin, so serving the same file over it fixes voice with
no other change.

```bash
node packlist_extension/serve.js ~/Downloads/11.speak.html
```

```
  Speak Tool is being served with the microphone enabled.

    http://localhost:8000/11.speak.html
```

It opens the browser for you, picks another port if 8000 is busy, and serves only the folder
you named. Pass a folder instead of a file to serve all of them, or no argument to serve the
loader.

Speech **output** and every button and key work on `file://` regardless — this is only about
voice commands.

### Try it right now, before touching the dashboard

Open **`demo/1.html`** in Chrome. It is a byte-for-byte copy of `order_details/1.html`
with that one line added, and nothing else. Chrome will ask for the microphone.

---

## What it adds to the page

| | |
|---|---|
| A control bar | Fixed to the bottom of the window |
| A collection dialog | Shown on the same page when a lampshade collection triggers |
| An auto-zoom | The picture of the SKU being spoken, opened by itself |
| An outline | On the order currently being packed |

Nothing else. No existing element is edited, removed, restyled or re-ordered. All four live
inside a single `#stx-root` container, so removing that one element takes the whole tool off
the page — the guarantee is structural, not a list a test has to keep up with.

The outline uses CSS `outline`, which is drawn **outside** the box and takes no layout
space, so no part of the pack list moves. To remove even that, run `STX.highlight = false`
in the console, or edit the one line in `src/speak-extension.js`.

**Verified, not asserted.** The test harness snapshots `document.body.innerHTML` before the
extension loads, removes only the extension's own container afterwards, and compares. The
result is byte-identical on all three pack lists.

---

## How it behaves

| Say / press | What happens |
|---|---|
| **Next** | Next component of this order. After the last one, the next order — and the page scrolls to it |
| **Back** | Previous component, then the previous order |
| **Repeat** | The current component again |
| **Postcode** | Reads just the postcode, and stays where it is |
| **Restart** | Back to the first order |
| Pause button / ↓ | Pause and resume speech |

Keyboard: `→` Next · `←` Back · `↑` Repeat · `↓` Pause · `Enter` Restart · `Esc` closes the zoom.
Keys are ignored while you are typing in one of the pack list's own fields, so the page
keeps working exactly as it does now.

### Auto-zoom

As each component is spoken, its picture opens large, with the name, the SKU and the count.

This matters because the pack list shows products in the **dashboard's** order while the tool
speaks them in **packing-priority** order — so the item being called out is rarely the one the
eye lands on. The zoom ties the two together. It replaces the numbered thumbnail strip the
sheet build used, which cannot be added here without changing the page.

The page's **own** zoom is tried first, so on the live dashboard the packer gets the viewer
they already know. Whether the page has one is decided once, by clicking an image and
watching for a new element; the saved pack lists carry no zoom code at all, so there the tool
falls back to its own.

The backdrop is `pointer-events:none`, so the pack list underneath stays clickable, and the
panel is inset above the control bar. Escape or the **×** closes it; the **Zoom** button turns
it off for the session.

```js
STX.zoom = 'auto'    // default — page's own zoom if it has one, otherwise ours
STX.zoom = 'own'     // always use the extension's zoom
STX.zoom = 'native'  // always click the page's image and let the page respond
STX.zoom = 'off'
```

### Voice, and why it now hears you

Three things were making commands unreliable, and all three are fixed.

**It listens while the tool is talking.** The microphone used to be switched off for the
whole utterance, so a packer who said *"next"* the moment they had the item in hand — the
natural moment — was not heard at all. Recognition now stays on. The tool's own voice is
filtered instead: it knows exactly what it is saying, so it ignores a command that appears in
its own current sentence. It says *":Post Code:"* out loud, so **postcode** is filtered while
that plays; it never says next, back, repeat or restart, so those always get through.
Set `STX.listenWhileSpeaking = false` if a station without a headset hears itself.

**It acts on the interim result.** Chrome can take a second or more to mark a phrase final,
and if you speak again before that it may never finalise — the word was heard and thrown
away. Commands now fire as soon as the word is recognised, with a 1-second de-duplicate so
the final does not fire it twice.

**It reads every guess, and the near-misses.** Chrome ranks five alternatives and *"next"* is
often second or third. All are read. The wrong words it returns for each command are accepted
too, because none of them means anything else here:

| Command | Also accepted |
|---|---|
| **next** | nest · necks · neck · text · nexus · net · forward · go on · next one |
| **back** | bag · buck · previous · prev |
| **repeat** | repeated · respeak · again · replay · read it |
| **postcode** | postal code · post card |
| **restart** | start again · start over |
| **pause** | paused · hold on · wait · stop |
| **resume** | continue · carry on · go ahead · unpause |

A phrase longer than five words is still ignored, so ordinary talk containing "next" does not
move the queue.

### Reliability — one action per phrase, and a recogniser that cannot stay dead

Two defects were behind *"it skips a product"*, *"it speaks the wrong one"* and *"I say Next ten
times and nothing happens"*. Both are fixed and both are tested.

**A spoken phrase now causes exactly one action.** The old guard was *"the same command within
1000 ms"* — a clock, not a phrase. Chrome emits interim results repeatedly while it refines its
guess, and when those ran past a second the same *"next"* fired **twice**: two steps taken, the
first product cut off mid-word and the second spoken. Chrome keeps one result index per phrase, so
the index is now the phrase's identity and it is acted on once, however long Chrome takes.

**The recogniser is restarted whether or not the tool is speaking.** `micStart()` refused to start
while `micMuted` was set, and `onend` refused to schedule a restart for the same reason. So if
recognition ended during an utterance — Chrome's idle timeout, or a no-speech — nothing revived it
until the 45-second speech watchdog. That is the ten-unanswered-Nexts report.

On top of that a **health check** runs every 2.5s. Every recognition event stamps a timestamp; if
the recogniser claims to be running but has been silent for 15 seconds, it is force-cycled. Chrome
can stop without firing `onend`, and nothing in the API reports it.

| | |
|---|---|
| One "next", interims spanning 1.5s | **1** step |
| Three separate "next" phrases | **3** steps |
| Tool's own "post code" heard back | **0** steps |
| Recogniser dies mid-utterance | revived |

### One microphone permission, not two

Recognition and the level meter both want the microphone. Asking twice is what produced repeated
permission prompts, and two independent captures is what produced the audio conflicts.
`getUserMedia` is now called **exactly once**, before recognition starts; the grant is per origin,
so recognition inherits it. If it is refused, recognition still starts — you lose the meter, not the
commands. Turning the mic off releases the capture, so Chrome stops showing the tab as recording.

**If the prompt keeps coming back on every load, the origin cannot store a grant.** `file://` has
the origin `null` and never can. Serve the page over http and it is asked once, ever.

### The microphone level meter

Six segments in the mic chip, driven by the real waveform from the microphone — the same idea
as the meter in a call app. It is a **measurement, not an animation**: if the bars do not move
when you talk, the headset is the problem, and that is worth knowing before blaming the tool.
The last segment turns amber when the input is loud enough to distort.

It opens its own microphone stream, because the recognition API does not expose audio. Chrome
runs both at once without trouble. Like recognition it needs a trusted origin, so on `file://`
it stays dark. `STX.meter = false` turns it off.

### Collections

A collection appears as its own step, immediately **before** the order that triggered it.
The dialog covers the page while the shades are collected; say **Next** and it is removed
and the next order is shown. An order short on both prefix lists produces **two** dialogs,
one after the other, each with its own limit of 15.

---

## The rules it follows

These are the same rules the Google Sheet build uses. Nothing was re-invented.

**Names come from the master sheet, and from nowhere else.** The pack list carries its own
marketplace title (*"Black 2,3,4,5 Way LED Spotlight Ceiling Light for Home decor~6138"*).
That title is deliberately never spoken — it is listing copy written for a customer, not a
picking instruction. Where the master sheet has no name for a SKU, the component is
announced as **"This one"** plus its colour, and the packer identifies it from the picture
already on the page.

**The postcode is always last.** It rides on the final component of the order, spelled
character by character, so there is no extra **Next** just to hear where the parcel goes.

**Reading order inside an order** is the packing priority: Rectangle Ceiling Rose first when
one is present, otherwise Lampshade first, then Ceiling Rose, Bulb, Other.

**Counts** use the existing logic — the component's own count where the pack list gives one,
otherwise the product quantity multiplied by its pack code (`2PK`–`9PK`, `APK`=10, `CPK`=20,
`DPK`=30, `EPK`=50, `FPK`=100, `NPK`=200, `PPK`=300, `QPK`=500, `RPK`=1000).

**Colours** come from the Lampshade SOT first, then the SKU suffix table.

It does **not** read the Google Sheet, and it does **not** read Cleaned Data. Everything
comes from the pack list page that is already open, plus the bundled reference data.

---

## Files

```
packlist_extension/
  speak-loader.html          <- open a pack list by dropping it on this page
  packlist-speak.js          <- the built file. This is the one you deploy.
  build.js                   <- rebuilds both of the above from source
  add-speak.js               <- adds the tool to a pack list HTML you downloaded
  serve.js                   <- serves over http so the microphone works
  src/speak-loader.html      <- the loader template  (edit this)
  src/speak-extension.js     <- the UI, speech and voice layer  (edit this)
  demo/1.html 2.html 3.html  <- the real pack lists with the one line added
```

`packlist-speak.js` is **generated**. Do not edit it. Edit `src/speak-extension.js`, or the
shared rules in `../speak_tool_html/engine.js`, then rebuild:

```bash
node packlist_extension/build.js
```

The packing rules live in **one** file, `speak_tool_html/engine.js`, shared with the
standalone build rather than copied into it. Six divergent copies of a station script is
the failure this project has already paid for once.

---

## Requirements and limits

- **Chrome.** `SpeechRecognition` is Chrome-only and is cloud-backed, so voice commands need
  a network connection. Speech output is local and works offline. The buttons and the
  keyboard always work.
- **A saved `.speak.html` carries the version of the tool it was built with.** Re-save it
  after a rebuild to pick up changes — an older copy keeps working, it just keeps the older
  behaviour.
- The microphone is muted while the tool speaks, so it never hears its own output as a
  command. A watchdog releases it if Chrome fails to report that speech finished.
- A phrase longer than five words is ignored, so ordinary conversation containing the word
  "next" does not move the queue.
- Serve `packlist-speak.js` from the **same origin** as the pack list, or the page's
  Content-Security-Policy may block it.

---

## Two things that are not in it, on purpose

**Instruction QR and Send Order Instruction are not spoken.** The pack list has no field for
either — on the sheet they were typed in by the team. The page does carry an *Instruction*
link badge, but reading it aloud would put something after the postcode, and the rule is
that the postcode is last. If those notes should be spoken, say where they should come from
and where in the sequence they belong, and I will add them.

**Nothing is written back.** The extension only reads the page. It changes no order, no
sheet and no dashboard record.
