
Description of the Calva development and release process.

_This is mainly for Calva maintainers. But is probably good for any [contributor](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) to be familiar with. Also, feeback and tips on how to improve this process is very welcome._

## 1. Introducing Changes

Generally:
* Don't forget about `README.md`. (It might not need to be updated, but anyway.)
* If a change warrants updates to `CHANGELOG.md`, put these under `[Unreleased]`.
* If a change warrants updates the the [Calva wiki](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute), make those changes in a branch of the [wiki repo](https://github.com/BetterThanTomorrow/calva.wiki.git), with the same name as your feature branch.

Bigger changes:
* These go into a `wip` branch and we send PR’s asking for feedback.
* We keep `wip` branches updated by merging  `dev` onto them often.
* Circle-CI runs tests and builds a VSIX package for any commits pushed to a PR. Follow the links to the build to find the VSIX (the **Artifact** tab).
* Consider asking for help testing in `#calva-dev` and wherever.

Smaller changes:
* Small, low-risky, fixes, we do right on `dev`
* Before committing on `dev` one has to ask: _should this be branched out to a `wip` branch?_

## 2. Prepare for Including the Change in the Next Published Calva
1. When a PR looks good
   1. Make sure the PR is directed at `dev``
   1. Merge the PR.
   1. Click the **Delete branch** button that Github offers.
1. Consider if `README.md` needs update.
   1. Commit with a message like: ”Add feature: **Short Release Description Title**"
1. Consider if there should be a prerelease made of this. If so:
   1. Tag the prerelease with `v<VERSION>-release-description-title`, _and make sure to make it a tag with a message_.
   1. Push using `--follow-tags`
1. Regardless if prerelease or not.
   1. Circle CI runs our tests, and builds a VSIX.
   1. Download this VSIX post on #calva-dev asking for help testing it. Attaching the `[Unreleased]` CHANGELOG entry is an easy way to let people know what is new.


## 3. Publishing a New Calva version

When a VSIX is good enough for release, and someone authorized to commit to the `master` branch has _at least half an hour of spare time_, the following will bring it to the Marketplace:

1. With `dev` checked out: `git checkout master`.
  1. `git merge --no-ff dev`
1. Tag with `v<VERSION>`
1. Push `master` (Using `--follow-tags`).
   * This will build the release VSIX, push a relase to GitHub, and publish it on the extension Marketplace.
   * You'll get an e-mail when it is published.
1. When the new version is live, immediatelly install it and see that it works.
   * If the Marketplace version works:
     1. On `dev`: `$ npm run bump-version`
     1. Commit with this message: "`Bring on version: `v<NEW_VERSION>`! `[skip ci]`”.
     1. Push.
   * If the Marketplace version does not work:
     1. Install the artifact from the release build and test it.
        * If this works, then something in Microsoft's publish pipeline has broken the extension. This has happened (once) before. To retry again you need to build a new VSIX with a bumped version:
          1. `$ npm run bump-version`.
          1. Push.
        * If the artifact doesn't work (we should never be here).
          1. ???

## 4. Updating README.md (and other docs) after publishing

Sometimes we need to update the documentation contained in the Calva repo, such as `README.md`, of the published extension, w/o publishing a new version. There are basically two scenarios:

1. `dev`'s versions of the documentation files reflect what is published (sans the change you want to make).
  1. Make the changes on `dev`, commit with `[skip ci]` in the commit message, and push.
  1. Move `master` to point at `dev`: `git checkout -B master`, and push.
1. `dev` has updated versions of the files that reflects _coming_ functionality.
  1. Checkout master w/o the `-B` flag.
  1. Make the changes, commit with `[skip ci]` in the commit message, and push.
  1. Make the changes on `dev` as well (if applicable). Merge, or whatever method seems most appropriate.
