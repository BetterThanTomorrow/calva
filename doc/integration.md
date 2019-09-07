
Description of the Calva development process.

_Draft._

## 1. Introducing Changes

Generally:
* If a change warrants updates to `README.md`, these should gp into a root level file named `README-PRERELEASE.md` with the new version. _**NB:** Leave the original `README.md` untouched_. Because on `master` this file _should always reflect the published extension_.
* If a change warrants updates to `CHANGELOG.md`, put these under `[Unreleased]`.
* If a change warrants updates the the [Calva wiki](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute), make those changes in a branch of the [wiki repo](https://github.com/BetterThanTomorrow/calva.wiki.git), with the same name as your feature branch.

Bigger changes:
* These go into a `wip` branch and we send PR’s asking for feedback.
* We keep `wip` branches updated by merging  `master` onto them often.
* Circle-CI runs tests and buildls a VSIX package for any commits pushed to a PR. Follow the links to the build to find the VSIX (the **Artifact** tab).
* Consider asking for help testing in `#calva-dev` and wherever.
* When a PR looks good, we merge it onto `master`.

Smaller changes:
* Small, low-risky, fixes, we do right on `master`
* Before committing on `master` one has to ask: _should this be branched out to a `wip` branch?_

## 2. Preparing for Publishing a new version
* When `master` is pushed, Circle CI run tests for us and builds a VSIX.
* Download this VSIX and test it.


## 3. Publishing a New Calva version

When a VSIX is good enough for release, and someone authorized to commit to the `release` branch has _at least half an hour of spare time_, the following will bring it to the Marketplace:

1. Merge `master` onto `release`.
1. If there is a `README-PRERELEASE.md`, use it to patch `README.md`.
1. Update `CHANGELOG.md`.
1. Commit updates.
1. `$ npm version patch`
   * This will bump the Calva version, and commit a tag.
1. Push.
   * This will build the release VSIX and publish it on the extension Marketplace.
   * You'll get an e-mail when it is published.
1. When the new version is live, immediatelly install it and see that it works.
   * If the Marketplace version works:
     1. Merge `release` onto master.
   * If the Marketplace version does not work:
     1. Install the artifact from the release build and test it.
        * If this works, then something in Microsoft's publish pipeline has broken the extension. This has happened (once) before. To retry again you need to build a new VSIX with a bumped version:
          1. `$ npm version patch`.
          1. Push.
        * If the artifact doesn't work (we should never be here).
          1. ???
