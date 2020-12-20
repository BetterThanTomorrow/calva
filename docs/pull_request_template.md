<!-- ❤️ Thanks for filing a Pull Request on Calva! You are contributing to a better Clojure coding experience. ❤️ -->
<!-- We use checklists in order to not forget about important lessons we and others have learnt along the way. -->

## What has Changed?
<!-- Introduce the change(s) briefly here. Consider explaining why a particular change was implemented the way it was. If you have considered alternative ways to introduce the change, please elaborate a bit on that as well. -->
-
-
-

<!-- Tell us what Github issue(s) your PR is fixing. Consider creating the issue if need be. -->
Fixes #

## My Calva PR Checklist
<!-- Remove the checkboxes that do not apply, as Github reports how many are not ticked. If you want to add checkboxes, please do. -->

I have:

- [ ] Read [How to Contribute](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute#before-sending-pull-requests).
- [ ] Directed this pull request at the `dev` branch. (Or have specific reasons to target some other branch.)
- [ ] Made sure I have changed the default PR base branch, so that it is not `master`. (Sorry for the nagging.)
- [ ] Updated the `[Unreleased]` entry in `CHANGELOG.md`, linking the issue(s) that the PR is addressing.
- [ ] Figured if **anything** about the fix warrants tests on Mac/Linux/Windows/Remote/Whatever, and either tested it there if so, or mentioned it in the PR.
- [ ] Tested the VSIX built from the PR (so, after you've submitted the PR). You'll find the artifacts by clicking _Show all checks_ in the CI section of the PR page, and then _Details_ on the `ci/circleci: build` test. NB: *There is a CircleCI bug that makes the Artifacts hard to find. Please see [this issue](https://discuss.circleci.com/t/artifacts-tab-not-showing-unless-logged-in/32433) for workarounds.*
     - [ ] Tested the particular change
     - [ ] Figured if the change might have some side effects and tested those as well.
     - [ ] Smoke tested the extension as such.
- [ ] Referenced the issue I am fixing/addressing _in a commit message for the pull request_.
     - [ ] If I am fixing the issue, I have used [GitHub's fixes/closes syntax](https://help.github.com/en/articles/closing-issues-using-keywords)
     - [ ] If I am fixing just part of the issue, I have just referenced it w/o any of the "fixes” keywords.
- [ ] Created the issue I am fixing/addressing, if it was not present.
- [ ] Added to or updated docs in this branch, if appropriate

## The Calva Team PR Checklist:
<!-- Please read the list, since you'll get a better idea about what to expect by doing so. 😄 -->

Before merging we (at least one of us) have:

- [ ] Made sure the PR is directed at the `dev` branch (unless reasons).
- [ ] Figured if **anything** about the fix warrants tests on Mac/Linux/Windows/Remote/Whatever, and tested it there if so.
- [ ] Read the source changes.
- [ ] Given feedback and guidance on source changes, if needed. (Please consider noting extra nice stuff as well.)
- [ ] Tested the VSIX built from the PR (well, if this is a PR that changes the source code.)
     - [ ] Tested the particular change
     - [ ] Figured if the change might have some side effects and tested those as well.
     - [ ] Smoke tested the extension as such.
- [ ] If need be, had a chat within the team about particular changes.

Ping @pez, @kstehn, @cfehse, @bpringe

<!-- This is a nice book to read about the power of checklists: https://www.samuelthomasdavies.com/book-summaries/health-fitness/the-checklist-manifesto/ -->