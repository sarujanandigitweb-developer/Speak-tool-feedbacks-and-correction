# Unit 3 Lampshade — Voice Recognition Reliability & Pause/Resume

## Implementation Report

**Status: 🟠 AMBER — root cause fixed, 24/24 automated lifecycle tests pass.
Real-browser / real-microphone validation in the warehouse still outstanding.**

---

## File Scope (§26)

```
Voice Recognition Files:   Lithursan.gs   (client JS inside speakTextDialog())
Voice UI Files:            Lithursan.gs   (same generated HTML/CSS)
Navigation File:           Lithursan.gs   (controlSpeech / changeIndex)

Files that do NOT need modification:
  action.gs          menu only
  cleaned.gs         data cleaning
  clean-1.gs         data cleaning
  Merge SKU.gs       SKU Combined column
  sku.gs             uncalled helpers
  packing-priority.gs classification / packing order
```

**Only `Lithursan.gs` was modified.** Verified by timestamp and by grep: every data-processing
marker (`slice(0,-3)`, `startsWith("CL")`, `RPR44WH`, `keepOnlyLastOccurrenceInD`, `ppProductType`,
`ppApplyPackingPriority`, `combinedGroups`, `skuToImageUrl`) is unchanged, and the speech-content
builders at `:172-196` are untouched.

---

## 1. Root Cause

**Why "next" needed repeating — three compounding faults.**

### Fault A — recognition was killed by its own restart (the main cause)

```js
// OLD  Lithursan.gs:886-887, inside onresult
recognition.stop();
recognition.start();
```

`stop()` is **asynchronous**. Calling `start()` on the very next line, while the service is still
running, throws `InvalidStateError`. That lands in `onerror`:

```js
// OLD  :892-896
recognition.onerror = function(event) {
  console.error(...); voiceFeedbackDiv.innerText = ...; hideLoading();   // never restarts
};
```

**`onerror` did not restart recognition.** So after that throw the microphone was dead for the rest
of the session, with no visible sign. The packer kept saying "next" into a service that had stopped
listening — which is exactly the reported symptom, and why FB-133 says *"getting tired from it"*.

### Fault B — the tool heard itself

Nothing muted the microphone while the tool was speaking. The tool speaks `":Post Code:"` (`:185`),
the open mic picked it up, and the old matcher fired on it:

```js
} else if (spokenText.includes("postcode") || spokenText.includes("post code")) {
```

So the tool issued its own `postcode` command mid-order. `recognition.continuous = true` guaranteed
the mic was open exactly when synthesis was playing.

### Fault C — two restart paths racing

`onend` (`:898-901`) also called `start()` unconditionally, competing with Fault A's call. Whichever
lost threw again.

---

## 2. Voice Recognition Fix

One authoritative lifecycle, one recognition object, explicit state.

| State flag | Meaning |
|---|---|
| `micPausedByUser` | user intent — **the only thing that blocks auto-restart** |
| `micRunning` | true between `onstart` and `onend` |
| `micSuspendedForTTS` | muted because the tool itself is speaking |
| `micFatalError` | permission/hardware failure — never retry |

**Changes:**

1. **Deleted `recognition.stop(); recognition.start();` from `onresult`.** With `continuous = true`
   the service keeps running; the old pair only ever destabilised it.
2. **`micStart()` is the single entry point** — it refuses to start when already running, paused,
   erroring, or speaking, and wraps `start()` in try/catch so a benign "already started" can never
   become a fatal error.
3. **`onerror` now classifies:**
   - `no-speech`, `aborted` → normal lifecycle, stay quiet, let `onend` restart
   - `not-allowed`, `service-not-allowed` → permission denied, **stop retrying**
   - `audio-capture` → no microphone, **stop retrying**
   - anything else (incl. `network`) → transient, show a brief note, restart
4. **`onend` restarts only when** `!micPausedByUser && !micFatalError && !micSuspendedForTTS`, via a
   single debounced timer (`micScheduleRestart`) so no two restarts can race.
5. **Mic muted during synthesis** — `speakLine()` calls `micSuspendForSpeech()` before speaking and
   `micResumeAfterSpeech()` when the utterance chain completes. Late results arriving while
   suspended are discarded. Fault B is closed.
6. **Watchdog (45 s).** Chrome does not always fire utterance `onend` — notably after
   `synth.cancel()` or when the tab is backgrounded. A missed `onend` would leave the mic muted for
   the rest of the session, recreating the original bug from a different direction. The watchdog
   force-releases the microphone. *(This gap was found by the test harness, not by inspection.)*
7. **Generation guard.** Pressing Next mid-speech cancels the old utterance chain; `speechToken`
   stops the orphaned chain from un-muting the mic while the new order is still being read.

### Normalisation (§5)

```js
function normalizeTranscript(t) {
  return String(t || "").toLowerCase()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

`" Next "`, `"NEXT."`, `"next"` all normalise to `next`.

### Matching (§4) — same vocabulary, safer boundaries

`includes()` replaced with word-boundary regex, plus a **≤ 5 word** guard so an ordinary sentence
containing "next" cannot navigate. Command order preserves the old semantics — `restart|start` is
tested before `again`, so *"start again"* still means restart.

| Action | Accepts |
|---|---|
| restart | restart, start |
| next | next, forward, go on, go next |
| back | back, previous, prev |
| respeak | respeak, again, repeat |
| postcode | postcode, post code |

### Duplicate suppression (§8)

The **same** command within 1000 ms is treated as one utterance. A **different** command is never
blocked, and there is no added latency on the first command.

---

## 3. Listening Indicator (§10–12)

A pill next to a new 🎙️ button, driven by real recognition events — **no simulated volume meter**
(§11). `onspeechstart` / `onspeechend` are genuine API signals.

| State | Shows | Trigger |
|---|---|---|
| Listening | 🟢 `Listening` (slow pulse) | `onstart` |
| Detecting speech | 🟢 `Listening…` (fast pulse) | `onspeechstart` |
| Processing | 🔵 `Processing next…` | command dispatched |
| Speaking | ⚪ `Speaking - mic off` | `micSuspendForSpeech()` |
| Paused | 🟡 `PAUSED - voice commands off` | user toggle |
| Error | 🔴 `Microphone unavailable - permission denied` | fatal `onerror` |

`prefers-reduced-motion` disables the pulse. The indicator never shows "Listening" while recognition
is actually stopped — it is rendered from the same flags that drive the lifecycle.

---

## 4. Pause Behaviour (§13, §15)

Pressing 🎙️ sets `micPausedByUser = true`, cancels any pending restart timer, and calls
`recognition.stop()`. Recognition genuinely stops — `onresult` also returns early, so even a late
result cannot navigate. `onend` sees the flag and does **not** restart. Button reads `🎙️ Mic Off`
with an amber background; the pill reads `PAUSED - voice commands off`.

**This is a real pause, not a UI-only one.** Verified: no navigation while paused, and no
auto-restart after 10 simulated seconds.

## 5. Resume Behaviour (§16)

Pressing the **same** button clears the flag and schedules a start on the existing recognition
object — **no second instance is ever created** (asserted in the tests). Indicator returns to
`Listening`, and "next" works immediately.

---

## 6. Files Changed

| File | Function / area | Change |
|---|---|---|
| `Lithursan.gs` | `<style>` | Added `#micIndicator` / `#micBtn` styles + reduced-motion guard |
| `Lithursan.gs` | modal HTML | Added 🎙️ toggle button and indicator pill |
| `Lithursan.gs` | **new** client functions | `setMicState`, `refreshMicUI`, `micStart`, `micStop`, `micScheduleRestart`, `micSuspendForSpeech`, `micResumeAfterSpeech`, `toggleMic`, `normalizeTranscript`, `matchCommand` |
| `Lithursan.gs` | recognition block | Rewritten lifecycle: `onstart`, `onspeechstart/end`, `onresult`, `onerror`, `onend` |
| `Lithursan.gs` | `speakLine()` | Mic suspend/resume + `speechToken` generation guard |
| `Lithursan.gs` | `var speechRate` | Added `speechToken` counter |
| everything else | — | **unchanged** |

**No change** to `controlSpeech`, `changeIndex`, `updateUI`, `togglePause`, speech content,
navigation, or any `.gs` data file.

---

## 7. Voice Test Results

Executed by extracting the generated client JS and running it against a simulated Web Speech API
(`vt/harness.js`). **24/24 pass.**

| Test | Expected | Actual | Status |
|---|---|---|---|
| T1 basic next | one command → one navigation | index 0 → 1 | ✅ |
| T2 consecutive | 3 spaced commands → 3 navigations | +3 | ✅ |
| T3 case/punctuation | `Next`, `NEXT.`, `" next "` all work | +3 | ✅ |
| T4 recovery after natural end | auto-restarts, next works | restarted, +1 | ✅ |
| T4b `no-speech` error | benign, recovers | restarted | ✅ |
| T5 pause | stops, UI PAUSED, no navigation | all three | ✅ |
| T5b no restart while paused | still stopped after 10 s | stopped | ✅ |
| T6 resume | restarts, next works | +1 | ✅ |
| T7 synthesis interaction | mic returns after speech | `Listening` | ✅ |
| T8 no duplicate navigation | same command ×2 in 1 s → 1 nav | +1 | ✅ |
| T9 existing Next button | unchanged, one navigation | +1 | ✅ |
| T10 existing vocabulary | all 13 phrases still map | all correct | ✅ |
| Safety | 6-word sentence with "next" ignored | `null` | ✅ |
| Watchdog | stuck synthesis releases mic | released | ✅ |
| Single instance | exactly one recognition object | 1 | ✅ |
| Fatal error | `not-allowed` → no retry, clear UI | correct | ✅ |

---

## 8. Regression Test

| Existing functionality | Result |
|---|---|
| Order data, SKU, quantity, customer, postcode | ✅ untouched — no `.gs` data file modified |
| Product name lookup, image mapping, grouping | ✅ untouched |
| Lampshade / colour / Rectangle Rose / Bulb priority | ✅ untouched — `packing-priority.gs` and both cleaners unmodified |
| Speech **content** (what is spoken) | ✅ unchanged — builders at `:172-196` untouched |
| Back / Restart / Respeak / Postcode / Next buttons | ✅ unchanged — still call `controlSpeech(...)` |
| Existing speech-playback **Pause** button | ✅ unchanged — still `synth.pause()`; the new 🎙️ button is a **separate** control for the microphone (§17) |
| Keyboard arrows, MediaSession headset controls | ✅ unchanged |
| Product card, images, postcode, quantity badge | ✅ unchanged |
| Navigation source of truth | ✅ voice calls the **same** `controlSpeech(action)` the buttons use — no second implementation (§18, §19) |

---

## 9. Evidence

| # | Evidence | Location |
|---|---|---|
| E1 | Old `stop(); start();` pair | `Lithursan.gs:886-887` (removed) |
| E2 | Old `onerror` never restarted | `:892-896` (replaced) |
| E3 | Old duplicate restart in `onend` | `:898-901` (replaced) |
| E4 | Self-trigger path — tool speaks `":Post Code:"`, matcher fired on it | `:185` vs old `:879` |
| E5 | New lifecycle | `Lithursan.gs`, recognition block |
| E6 | Mic gating | `speakLine()` — `micSuspendForSpeech` / `micResumeAfterSpeech` |
| E7 | 24/24 test run | `vt/harness.js` |
| E8 | Syntax valid | `node --check` on `Lithursan.gs` and on the extracted client JS |
| E9 | Scope contained | grep of all data-processing markers, all present and unchanged |

---

## 10. Remaining Limitations

Only verified limitations are listed.

1. **Not yet tested in a real browser with a real microphone.** All results above come from a
   simulated Speech API. The lifecycle logic is proven; **real-world recognition accuracy on
   warehouse audio is not**. This is the reason for AMBER, and the one thing I cannot close from
   here.
2. **Chrome only.** `SpeechRecognition` is `webkit`-prefixed and unimplemented in Firefox; Safari
   support is partial. The tool now degrades cleanly — buttons and keyboard keep working and the
   indicator reads *"Microphone unavailable"* — but per §24 I am not claiming cross-browser support.
3. **Recognition remains cloud-backed.** Chrome sends audio to Google for transcription, so poor
   warehouse wifi still costs accuracy. The fix removes the *dead microphone* failure; it cannot
   remove network latency. The USB foot pedal / headset-button path (MediaSession is already wired
   at `:802-830`) remains the fully offline fallback.
4. **The existing speech-playback Pause button is still one-way** — `synth.resume()` does not exist
   anywhere in the file. §17 told me not to change the meaning of existing playback controls, so I
   left it. It is a separate defect (Unit 3 Others #12) and should be fixed on its own.
5. **`clean-1.gs` / `cleaned.gs` still both define the same six functions.** Unrelated to this task,
   but still outstanding.

---

## 11. Final Status

# 🟠 AMBER

**Implementation complete; browser/microphone validation remains.**

- ✅ Root cause identified and fixed — the `stop(); start();` pair plus a non-restarting `onerror`
- ✅ Single authoritative recognition lifecycle, one recognition object
- ✅ Tool can no longer trigger its own commands
- ✅ Real listening indicator driven by real events, no fake volume meter
- ✅ Genuine pause/resume on one toggle button
- ✅ All existing commands, buttons, navigation, speech content and data logic preserved
- ✅ 24/24 automated lifecycle tests pass
- ⚠️ Real-browser, real-microphone test in the warehouse still to be done

**Suggested acceptance test on a station:** open the tool, confirm the pill reads `Listening`, say
"next" once and confirm exactly one order advances, let it sit through a full spoken order and
confirm the pill goes `Speaking - mic off` → `Listening`, press 🎙️ and confirm "next" does nothing,
press it again and confirm "next" works.
