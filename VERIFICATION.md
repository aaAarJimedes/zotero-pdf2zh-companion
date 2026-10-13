# 2.2.0 verification (2026-10-13)

Environment: Windows x64, PSF Python 3.13.16, Zotero 10.0.6, official PDF2zh add-on/Server 4.1.7, pdf2zh-next 2.9.0 and BabelDOC 0.6.2. The tested companion XPI is 2.2.0. Other operating systems and Python versions have not completed this installation flow.

## Official baseline and independent installation

- The latest official add-on/Server release remains 4.1.7, tag commit `35af40f5d206c1843e10bae000d9aaabf89096df`. Official main has one subsequent README-only commit. The existing official add-on and the downloaded release XPI have identical SHA-256 values.
- Official release assets were downloaded and checked against GitHub's published digests. A new Server directory, Python venv, Zotero profile and library were used in a path containing Chinese characters and spaces. No existing patched site-packages, user credentials or library database were copied into the test environment.
- `requirements-runtime.txt` contains the 140 exact package versions resolved in that clean venv. Entries were checked to exclude editable installs, direct URLs, local paths and private sources. Both dependency imports and package consistency checks passed.
- All 225 Python source files recorded by pdf2zh-next and BabelDOC match their installed distribution records, including after the actual UI translation. The old local figure-protection helper is absent. Figure and table protection therefore does not depend on a patched machine environment.

## Automated and native-engine checks

- Passed: single-button lifecycle, Python environment construction, first-run configuration/cancellation, wrong-Server directory rejection, serialized settings changes, and a deliberately delayed installation followed by an opposite toggle. The final runtime setting and saved preference agree.
- Passed: known execution-hook adaptation, pipe adapter deployment, idempotent installation, unfamiliar-hook rejection, per-task enable/disable, and native legacy/standalone passthrough.
- Passed: figure/table coverage boundaries, caption and adjacent-prose exclusions, raw character/vector preservation, and reversible process hooks. The installed engine source remains unchanged.
- Passed: reply and cache validation for paragraphs, glossary and numbered batches; five synthetic output arrangements; contents page numbers/links; references and footer preservation; missing-font rejection; and output-scope rejection before any model request.
- The isolated real-engine regression sent **27 requests** to a local synthetic OpenAI-compatible responder, with automatic term extraction enabled. It retried an intentionally invalid reply and generated checked mono/LR results. This is separate from the UI translation described below.
- The headless progress regression exercised the original Server parser and TaskManager while the process was running: **0%, 25%, 50%, 75%, 100%**. It covered split UTF-8, carriage returns, stderr and nonzero exits. CI uses offline figure/quality checks; this Server-dependent progress test runs in the complete local environment.

## Actual new-profile Zotero flow

- The official 4.1.7 add-on and companion 2.2.0 loaded in a fresh Zotero 10.0.6 profile. Actual file pickers selected the Server script and venv Python under the Chinese/space path. The companion installed its runtime files and started the selected local Server.
- A two-page synthetic PDF was translated using the official item context-menu action. The native workflow automatically attached both mono and LR bilingual outputs to the original parent item. Each attachment's SHA-256 matches its Server output, and the original PDF hash is unchanged. Double-clicking the attached LR PDF opened the native Zotero reader, which showed two pages; its first page displayed ten correctly positioned English/Chinese contents rows.
- This UI run sent **17 local synthetic requests** and used **10 cache hits**. These are not additional counts from the isolated 27-request engine run. No user paper or real model endpoint was used for either regression.
- The actual enhancement menu successfully disabled the deployed per-task setting. After restarting the new Zotero profile, the menu remained unchecked. Enabling it again updated the runtime setting to true; the final state is enabled. These actions did not submit a translation or interrupt an existing job. The test profile was then closed normally.
- The Server viewer displayed history and opened the page-local clear confirmation. **Cancellation preserved the records. No history was actually deleted through the UI.** Clear/confirm semantics, refresh persistence, stale responses and later completions are covered by the code regression.

## Boundaries

- Existing original papers, previous translations and comparison artifacts are retained; the paused paper batch is not resumed. Synthetic installation tests do not establish semantic acceptance of those papers.
- Full-page reflow, complex OCR and all possible academic layouts are not claimed verified. Figure/layout candidate checks and PDF integrity are not substitutes for language-quality review.
- Private authenticated GitHub downloads are the release verification route. Anonymous Zotero automatic updates are not guaranteed. This file records functional checks, not an assertion that a remote release has already been published.

Historical verification below retains its original version-specific scope.

# 2.1.1 verification (2026-10-13)

- Passed: reply/cache validation for paragraphs, glossary and numbered batches; native method hooks and reversible restoration; known Server command interception, correct interpreter selection, idempotent installation and per-task enable/disable behavior.
- Passed: five output arrangements (mono, LR and alternating pages, including translation-first), source geometry, contents page numbers/links, references and footer preservation on synthetic PDFs.
- Passed: the pinned native engine with automatic terms enabled against a local synthetic OpenAI-compatible responder. It produced mono/LR outputs, retried an intentionally invalid first reply, and reconstructed ten contents entries; no user paper or real model endpoint was submitted by this regression.
- Font regression: source-region redactions now precede final contents text insertion, and titles, numbers and leaders share the embedded CJK font. Recursive page/Form resource inspection rejects a deliberately missing-font fixture; corrected native outputs have zero missing-font references. Poppler no longer reports Unknown font tag / No font in show-space warnings. Its optional display-font substitution messages also occur on the unchanged baseline and are not a PDF resource regression.
- The retained 60-page comparison trial was inspected without modification and has no missing-font references. It is the earlier real-paper test, not a fresh full-paper test of this release.
- Actual Zotero 10.0.3 UI: package loaded without an enhancement-resource alert; the default-on menu and saved off state were visible. The Server viewer connected, showed zero active tasks, displayed existing history, opened the page-local clear confirmation, and cancellation retained that history. No real history was deleted.
- Final menu correction verified in the actual UI: toggling off/on changes the deployed per-task settings without opening a Server viewer. The popup is outside the toolbar button, and the final state is enabled. Package extraction and deployed engine/core hashes match the built source.
- Three unsupported native options (selected pages, only translated pages and split parts) fail before any model request or output mutation with an actionable message. The native default full-document settings still pass the engine regression.
- Translation attachment handoff is retained through native output filenames. This release's native-engine regression does not claim a new Zotero translation/automatic-attachment UI run, complete semantic acceptance, full-page reflow or complex OCR coverage.
- Private authenticated GitHub downloads are the release verification path; anonymous Zotero automatic updates are not guaranteed.

Historical verification below retains its original version-specific scope.

# 2.0.2 verification (2026-10-10)

- Passed: clear/cancel dialog handlers, duplicate clicks, refresh persistence, stale in-flight server responses, completions after clearing, cross-window storage events, malformed history and guarded/idempotent page installation.
- Passed: single-button lifecycle, server reuse, no translation submission, native Python prefix probing, and environment normalization.
- Passed: actual official Python environment probe and six native path cases, including Chinese/space/custom-prefix paths; actual pdf2zh_next --help.
- Passed: native Windows CreateProcessW negative/positive regression and retained headless pipe/Rich progress tests.
- Passed: XPI source equality, required files, version, update link and SHA-256.
- Local existing Server's static page was repaired without restarting its active translation. No paper, credentials, preferences or runtime task records were changed.
- Real Zotero UI click/reload verification was interrupted by the Computer Use Escape stop state, even after the user allowed continuation; it is not claimed passed. Current viewer must refresh to load the updated page. New companion code requires plugin reload/restart after XPI replacement.
- Private GitHub assets are checked with authenticated local gh downloads. Anonymous Zotero automatic update is not guaranteed by a private repository.

Historical verification below retains its original version-specific scope.

# 2.0.0 verification (2026-09-15)

- Passed: mocked single toolbar button, launch deduplication, server reuse, built-in viewer call/reuse, missing paths, startup failure, local URL validation, and unload cleanup.
- Passed: environment normalization and native Windows CreateProcessW regression retained from 1.2.4.
- Passed: package source/structure and update hash verification. Removed comparison assets are explicitly rejected by the package test.
- Real Zotero 9.0.6 check: executed the same `Zotero.openInViewer("http://localhost:8890/")` API used by 2.0.0. The Server page rendered inside a Zotero window and displayed Connected, Server 4.1.7. This did not install the new XPI or execute its toolbar button.
- New XPI installation, cold-start button activation and restart persistence remain user acceptance checks. No translation was submitted for this minimal release.

The historical 1.x tests below describe removed translation features, not promises of 2.0.

# Historical 1.2.4 verification (2026-09-15)

Environment: Windows, Zotero 9.0.6, PDF2zh Server 4.1.7, Conda Python 3.12.

## Passed

- Existing smoke tests: server command, translation handoff, attachment pairing and auto-comparison watcher (mocked Zotero).
- Environment normalization: Path/PATH/path/mixed case, duplicate keys, inherited variables, input immutability, Chinese/space paths, non-Conda and non-Windows handling.
- Native Windows CreateProcessW regression: a raw environment containing old Path plus new PATH reproduces FileNotFoundError; the environment built by the actual patched bootstrap function successfully launches the child command.
- Isolated real Server startup using that same native launch method and patched environment.
- Synthetic one-page PDF accepted by the real /translate endpoint; pdf2zh_next starts and reaches the configured siliconflowfree provider. Original WinError 2 no longer occurs in this test.
- XPI source equality, required root files, version and SHA-256 update manifest checks.

## Not passed / not claimed

- The real one-page translation did not complete: siliconflowfree returned RateLimitError and HTTP 500 repeatedly. Test retries were stopped to avoid further requests. No readable Chinese mono/dual output was confirmed.
- Tests did not install 1.2.4 in the user's Zotero, import a translated attachment, or visually validate the live comparison window. These remain post-install acceptance checks.
- Initial sandboxed attempts were blocked by local cache access; the non-sandboxed attempt reached the provider. This permission restriction was not attributed to the production plugin.

Only synthetic text was submitted; the user's research PDF was not uploaded. The existing Server/configuration and Zotero library were not modified. Temporary config copies and logs are not published.

Upgrade requires stopping the old Server as well as restarting Zotero (or rebooting the computer). The plugin deliberately reuses an already-running server and does not terminate unknown processes.
