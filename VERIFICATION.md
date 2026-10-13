# 2.1.0 verification (2026-10-13)

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
