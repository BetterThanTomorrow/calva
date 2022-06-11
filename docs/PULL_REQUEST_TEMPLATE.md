<!-- ❤️ Thanks for filing a Pull Request on Calva! You are contributing to a better Clojure coding experience. ❤️
## What you can expect:

Here are some things we consider before we merge:

- We make sure the PR is directed at the `dev` branch (unless reasons).
- We figured if **anything** about the fix warrants tests on Mac/Linux/Windows/Remote/Whatever, and will help you test there if it is hard for you to do so. (We appreciate a lot if you take on the work do this of course.)
- We read the source changes. (Surprise! 😄)
- We given feedback and guidance on source changes, if needed. Far from everything is captured in our [code guidelines](https://github.com/BetterThanTomorrow/calva/wiki/Coding-Style).
- We use our domain knowledge to try catch if you have missed some facility already provided in the code base.
- We read the updates to the documentation and help with feedback, trying to keep the documentation site serving well.
- We often check out your code changes and test them.
- We sometimes send the VSIX built from the PR out in the `#calva` channel on slack for others to test. (Actually, we will probably encourage you to do this.)
- We sometimes have a chat within the team about particular changes.
- NB: We also consider if your changes belong in the Calva product we want to maintain. Before you spend a lot of work on a PR, please consider chatting us up first, and filing issues.

We try to be speedy and attentive. Please don't hesitate to bump a PR, or contact us, if we seem to have dropped the ball (that has happened).

We use checklists in order to not forget about important lessons we and others have learnt along the way.

-->

## What has changed?

<!-- Introduce the change(s) briefly here. Consider explaining why a particular change was implemented the way it was. If you have considered alternative ways to introduce the change, please elaborate a bit on that as well. -->

-
-
-

<!-- Tell us what Github issue(s) your PR is fixing. Consider creating the issue if there isn't one already. -->

Fixes #

## My Calva PR Checklist
<!-- Strike out (using `~`) items that do not apply, as Github reports how many are not ticked. If you want to add checkboxes, please do. -->

If this PR involves only documentation changes, I have:

- [ ] Read [Editing Documentation](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Hack-on-Calva#editing-documentation)
- [ ] Directed this pull request at the `published` branch.
- [ ] Built the site locally (if the changes were more involved than simple typo fixes), and verified that the site is presented as expected.
- [ ] Referenced the issue I am fixing/addressing _in a commit message for the pull request_ (if there was is an issue for the documentation change)
  - [ ] If I am fixing the issue, I have used [GitHub's fixes/closes syntax](https://help.github.com/en/articles/closing-issues-using-keywords)
  - [ ] If I am fixing just part of the issue, I have just referenced it w/o any of the "fixes” keywords.

If this PR involves code changes, I have:

- [ ] Read [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute#before-sending-pull-requests).
- [ ] Directed this pull request at the `dev` branch. (Or have specific reasons to target some other branch.)
- [ ] Made sure I have changed the PR base branch, so that it is not `published`. (Sorry for the nagging.)
- [ ] Updated the `[Unreleased]` entry in `CHANGELOG.md`, linking the issue(s) that the PR is addressing.
- [ ] Figured if **anything** about the fix warrants tests on Mac/Linux/Windows/Remote/Whatever, and either tested it there if so, or mentioned it in the PR.
- [ ] Added to or updated docs in this branch, if appropriate
- [ ] Tests
  - [ ] Tested the particular change
  - [ ] Figured if the change might have some side effects and tested those as well.
  - [ ] Smoke tested the extension as such.
  - [ ] Tested the VSIX built from the PR (so, after you've submitted the PR). You'll find the artifacts by clicking _Show all checks_ in the CI section of the PR page, and then _Details_ on the `ci/circleci: build` test.
- [ ] Referenced the issue I am fixing/addressing _in a commit message for the pull request_.
  - [ ] If I am fixing the issue, I have used [GitHub's fixes/closes syntax](https://help.github.com/en/articles/closing-issues-using-keywords)
  - [ ] If I am fixing just part of the issue, I have just referenced it w/o any of the "fixes” keywords.
- [ ] Created the issue I am fixing/addressing, if it was not present.
- [ ] Formatted all JavaScript and TypeScript code that was changed. (use the [prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) or run `npm run prettier-format`)
- [ ] Confirmed that there are no linter warnings or errors (use the [eslint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), run `npm run eslint` before creating your PR, or run `npm run eslint-watch` to eslint as you go).

<!-- This is a nice book to read about the power of checklists: https://www.samuelthomasdavies.com/book-summaries/health-fitness/the-checklist-manifesto/ -->

Ping @pez, @bpringe, @corasaurus-hex, @Cyrik
