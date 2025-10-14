# Repository Guidelines

## Project Structure & Module Organization
The monorepo anchors three primary workspaces: `codex-rs` (Rust workspace with crates named `codex-*` under folders like `core`, `common`, `tui`), `codex-chrome` (MV3 extension code in `src/` and tests in `tests/`), and `codex-cli` (command-line surfaces). Shared specs live in `specs/`, SDK examples in `sdk/`, and automation scripts in `scripts/`. Use `docs/` for design notes and `codex-rs/docs/` for crate-specific guides.

## Build, Test, and Development Commands
From repo root run `pnpm install` before working on TypeScript packages. Within `codex-rs`, rely on `just` recipes: `just fmt` formats all crates, `just fix -p codex-tui` runs clippy for the target crate, and `cargo test -p codex-core` exercises that crate. In `codex-chrome`, use `npm run build`, `npm test`, and `npm run lint`. CLI utilities in `codex-cli` build with `cargo build -p codex-cli`.

## Coding Style & Naming Conventions
Rust modules follow standard rustfmt with four-space indentation and snake_case files; crates must keep the `codex-` prefix (for example `codex-protocol`). TUI code should favor ratatui’s `Stylize` helpers (`"Ready".green().bold()`) over manual `Style` construction. TypeScript modules mirror the folder name, use camelCase for functions, and rely on ESLint/Prettier via `npm run lint`. Shared JSON or OpenAPI files belong under `specs/`.

## Testing Guidelines
Write unit tests next to sources (`codex-rs/<crate>/tests` or `codex-chrome/tests`). Prefer `pretty_assertions::assert_eq!` in Rust. Run crate-level suites with `cargo test -p <crate>` and escalate to `cargo test --all-features` when touching `common`, `core`, or `protocol`. For TUI snapshots, regenerate via `cargo test -p codex-tui` then inspect `cargo insta pending-snapshots`. Front-end contracts rely on Vitest; trigger DOM-focused suites with `npm test -- vitest.dom.config.ts`.

## Commit & Pull Request Guidelines
Commits are short, present-tense summaries (“fix content script ping”) and avoid capitalization unless required; scope prefixes such as `tui:` or `chrome:` help reviewers. Every PR must describe intent, outline testing performed, and link issues or specs when relevant. Include screenshots or GIFs for UI-affecting changes, and mention any skipped tests with rationale. Request reviews from domain owners listed in CODEOWNERS when touching shared crates or extension infrastructure.

## Security & Environment Notes
Development happens inside hardened sandboxes. Respect existing guards that check `CODEX_SANDBOX` or `CODEX_SANDBOX_NETWORK_DISABLED`; do not bypass them, and expect network-dependent tests to short-circuit. Secrets should load from local `.env` files that remain untracked; never commit credentials or API keys. Use `scripts/` helpers for safe Seatbelt invocation rather than spawning raw system commands.
