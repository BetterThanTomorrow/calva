<!--
❤️ Thanks for filing a Pull Request on Calva! You are contributing to a better Clojure coding experience. ❤️

Please make sure to read: https://github.com/BetterThanTomorrow/calva/wiki/Contributing-Pull-requests

PLEASE NOTE:
If you want to file a Pull Request on the documentation of Calva (calva.io),
then use the Documentation PR template by adding 'template=docs.md' to the
query parameters of the URL of this page.

The rest of this template is about changes to the Calva source code.
-->

<!-- Please start by telling us what Github issue(s) your PR is fixing. Strongly consider creating the issue if there isn't one already. -->

Fixes #

## What has changed?

<!-- Introduce the change(s) briefly here. The why of the change belongs in the issue, but consider explaining why a particular change was implemented the way it was. If you have considered alternative ways to introduce the change, please elaborate a bit on that as well. -->

-
-
-


## My Calva PR Checklist

<!--
Strike out items (using `~`) if they do not apply, If you want to add items, please do. -->

I have:

- [ ] Read [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute#before-sending-pull-requests).
- [ ] Directed this pull request at the `dev` branch. (Or have specific reasons to target some other branch.)
- [ ] Made sure I have changed the PR base branch, so that it is not `published`. (Sorry for the nagging.)
- [ ] Made sure there is an issue registered with a clear problem statement that this PR addresses, (created the issue if it was not present).
    - [ ] Updated the `[Unreleased]` entry in `CHANGELOG.md`, linking the issue(s) that the PR is addressing.
- [ ] Figured if **anything** about the fix warrants tests on Mac/Linux/Windows/Remote/Whatever, and either tested it there if so, or mentioned it in the PR.
- [ ] Added to or updated docs in this branch, if appropriate
- [ ] Tests
  - [ ] Tested the particular change
  - [ ] Figured if the change might have some side effects and tested those as well.
- [ ] Formatted all JavaScript and TypeScript code that was changed. (use the [prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) or run `npm run prettier-format`)
- [ ] Confirmed that there are no linter warnings or errors (use the [eslint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), run `npm run eslint` before creating your PR, or run `npm run eslint-watch` to eslint as you go).

