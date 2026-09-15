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
