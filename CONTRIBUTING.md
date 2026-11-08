# Contributing

Thanks for helping with Feed Grabber.

## Reporting problems

Feed Grabber depends on Instagram's page structure, so most problems come from changes on Instagram's side. Open an issue with the bug report form and say where it fails and what happens.

For security problems, follow [SECURITY.md](SECURITY.md) instead.

## Changing the code

- For anything beyond a small fix, open an issue first so we can agree on the approach.
- Edit the extension's files, not `feed-grabber.user.js`: it is generated. Rebuild it with `sh userscript/build.sh` and include the result in your pull request.
- Keep the permissions to a minimum, and don't send data anywhere other than Instagram and its media servers.
- Test both the extension and the userscript on Instagram.
- Don't change `version` in `manifest.json`: releases are made separately.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
