# Security Policy

## Supported Versions

This project is an active web application. Security updates are applied to the current main branch.

## Reporting a Vulnerability

If you discover a security vulnerability in ChessWeb, please report it responsibly:

1. **Email**: Open a GitHub Security Advisory for this repository, or contact the maintainers directly through GitHub Issues with the "Security" label.
2. **Response time**: We aim to acknowledge security reports within 48 hours and provide a status update within 7 days.
3. **Disclosure**: Please do not disclose the vulnerability publicly until we have had a chance to fix it and publish an update.

### What to include in your report

- Description of the vulnerability
- Steps to reproduce the issue
- Impact assessment (what an attacker could achieve)
- Any potential mitigations you've identified

### Security considerations for this project

ChessWeb handles the following sensitive areas:

- **Supabase Realtime connections**: Anonymous authentication for multiplayer games
- **Stockfish WASM engine**: Runs entirely in-browser; no server-side code execution
- **Game history**: User game data stored via Supabase (when configured)
- **Chat messages**: Sanitized input to prevent XSS

The application uses Content Security Policy headers and input sanitization to mitigate common web vulnerabilities.
