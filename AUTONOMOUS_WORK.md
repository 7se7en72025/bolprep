# BolPrep autonomous work instructions

You are maintaining this beginner portfolio project. Read `README.md`, `learning-log.md`, and the roadmap in `../Chronicle/BOLPREP.md` before choosing work. The repository currently contains a local browser text/voice prototype.

For this run:

1. Check `git status` first and keep track of the starting worktree state. If there are uncommitted changes not created by this run, stop without changing them. If a patch or check fails after you edit files, inspect and repair or revert your own edits; do not treat changes from this run as pre-existing user work or stop solely because your own worktree is dirty.
2. Choose one useful, self-contained next improvement from the roadmap. Prioritize unresolved end-to-end voice behavior and turn handling, speech diagnostics or evaluation design, and source-backed retrieval or corpus coverage. Use small UI copy or styling changes when they fix a concrete usability or accessibility gap. Do not repeat completed work or spend runs on polish while a higher-impact roadmap gap is independently achievable. If a browser, device, API key, or source approval blocks one idea, choose another independently achievable roadmap task before deciding that user input is required.
3. Before editing a file, re-read the exact current lines you intend to change and build patches from that current content. If a patch fails to apply, re-read the affected section and adapt it; never retry a stale patch context.
4. README paragraphs, run-sheet steps, and Markdown table rows can be long single lines. For small prose or table edits, use an exact phrase or row replacement that asserts one match instead of patching the whole line.
5. Implement the change and run focused non-test checks that can be completed locally. Do not add or run test suites unless the user explicitly asks. For Python syntax checks, try `.venv\Scripts\python.exe` before concluding that Python is unavailable on PATH. If Python remains unavailable in the task environment, avoid Python code changes and choose a JavaScript, UI, or documentation improvement that can be checked there; do not stop only to request a Python installation. Do not let a missing test runtime stop independent work. Do not require or expose secrets, call external model APIs, use real learner recordings, or claim unmeasured quality results.
6. Update README and the learning log when the actual project state or setup changes. Clearly label limitations and work that could not be verified.
7. Make one focused commit only after the checks pass. Push that commit to `origin` on the current branch, as requested for this repository. Do not publish releases, deploy, change global or system settings, create scheduled tasks, or access files outside this repository except read-only `../Chronicle/BOLPREP.md`.
8. Keep changes beginner-readable. Avoid broad rewrites, unrelated dependencies, and changes to user data.

If a needed decision, credential, browser/device test, or source approval blocks the next useful step, do not guess. End with `[STOP]` and state the exact user input needed.

Otherwise end your response with `[CONTINUE]` on the first line, then summarize the change, verification, and commit hash. The runner uses this marker to decide whether another bounded task should start.
