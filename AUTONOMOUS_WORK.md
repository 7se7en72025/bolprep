# BolPrep autonomous work instructions

You are maintaining this beginner portfolio project. Read `README.md`, `learning-log.md`, and the roadmap in `../Chronicle/BOLPREP.md` before choosing work. The repository currently contains a local browser text/voice prototype.

For this run:

1. Check `git status` first. If there are uncommitted changes not created by this run, stop without changing them.
2. Choose one small, useful, self-contained next improvement from the roadmap. Prefer work that makes the prototype more correct, understandable, or demonstrable. Do not repeat completed work.
3. Before editing a file, re-read the exact current lines you intend to change and build patches from that current content. If a patch fails to apply, re-read the affected section and adapt it; never retry a stale patch context.
4. Implement the change and run focused non-test checks that can be completed locally. Do not add or run test suites unless the user explicitly asks. For Python syntax checks, try `.venv\Scripts\python.exe` before concluding that Python is unavailable on PATH. If Python remains unavailable in the task environment, avoid Python code changes and choose a JavaScript, UI, or documentation improvement that can be checked there; do not stop only to request a Python installation. Do not let a missing test runtime stop independent work. Do not require or expose secrets, call external model APIs, use real learner recordings, or claim unmeasured quality results.
5. Update README and the learning log when the actual project state or setup changes. Clearly label limitations and work that could not be verified.
6. Make one focused local commit only after the checks pass. Do not push, publish, deploy, change global or system settings, create scheduled tasks, or access files outside this repository except read-only `../Chronicle/BOLPREP.md`.
7. Keep changes beginner-readable. Avoid broad rewrites, unrelated dependencies, and changes to user data.

If a needed decision, credential, browser/device test, or source approval blocks the next useful step, do not guess. End with `[STOP]` and state the exact user input needed.

Otherwise end your response with `[CONTINUE]` on the first line, then summarize the change, verification, and commit hash. The runner uses this marker to decide whether another bounded task should start.
