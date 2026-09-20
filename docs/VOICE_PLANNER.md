# FocusArx voice planner

## Product boundary

The voice planner is a low-interruption capture workflow, not an autonomous assistant. Speech recognition produces a transcript. The server deterministically structures that transcript into editable drafts. **Parsing never writes data.** Tasks and goals are persisted only after the user reviews the preview and selects **Save**.

It is available from Tasks, Goals, the authenticated top bar, and the `Alt+M` shortcut. The compact top-bar entry remains available during a focus session without displaying a popup, notification, or recording automatically. The existing Arx companion may identify planning intent, but now sends that transcript into this same confirmation workflow instead of silently creating an item.

## Supported language patterns

A capture can contain up to 12 items separated by semicolons, commas, “then”, “also”, or a new “add/create task/goal” phrase. Examples:

- `Revise physics for 45 minutes tomorrow, high priority`
- `Create a goal to finish the semester strong by Friday`
- `Email the client under work urgent; practice maths 1.5 hours every Monday`
- `Call mum day after tomorrow`

The deterministic parser currently recognizes:

- task and goal intent;
- today, tomorrow, day after tomorrow, weekdays, ISO dates, and day/month dates;
- minutes and hours;
- low, medium, high, and urgent priority;
- explicit study/school, work, personal, health/fitness, and finance categories, plus conservative keyword inference;
- daily, weekly, and named-weekday recurrence.

Tasks store a due **date**, not a reminder time. If a spoken time is detected it remains visible in the editable title and the preview displays a warning so information is not silently discarded. Goal target dates are represented in goal notes because the current goal schema has no target-date field.

## Privacy and safety

- The microphone never starts on page load. Recording requires an explicit button press.
- Browser speech recognition may use the browser vendor’s remote recognition service. Users should consult their browser’s privacy policy before speaking sensitive material.
- The transcript is sent to the authenticated FocusArx API for deterministic parsing. It is stored only when the confirmed batch is saved, as part of the retry-safety ledger.
- Unsupported browsers retain the complete typed workflow.
- Permission denial, unavailable audio hardware, no speech, recognition network errors, and API failures have distinct recovery messages.
- Transcripts and extracted fields remain editable; low-confidence or lossy interpretations are surfaced rather than silently trusted.

## Persistence and retry semantics

`POST /api/voice-capture/parse` performs no database writes. `POST /api/voice-capture/commit` validates the edited items and inserts all tasks, goals, and the batch ledger in one database transaction. A client-generated idempotency key is unique per user. Repeating a commit with the same key returns the original result and creates no duplicates, including concurrent retries.

The client invalidates task, goal, dashboard, and analytics caches after confirmation. A failed atomic transaction reports that nothing was saved and can be safely retried.

## Browser support

The microphone option uses the browser Web Speech Recognition API, including the current `webkitSpeechRecognition` prefix. Availability and recognition quality vary by browser, device, ambient noise, accent, proper nouns, and network connectivity. Keyboard and text entry are first-class rather than fallback-only interfaces.

## Future provider extension

Speech-to-text and structuring are intentionally separated. A future native/mobile or hosted transcription provider can supply plain transcript text to the same parse endpoint without changing confirmation or persistence semantics. A future probabilistic entity extractor should return the same draft shape with field-level provenance/confidence and must not bypass preview, validation, transaction, or idempotency boundaries.
