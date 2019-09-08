
Description of the Calva development process.

_Draft._

## 1. Introducing Changes

Generally:
* Don't forget about `README.md`. (It might not need to be updated, but anyway.)
* If a change warrants updates to `CHANGELOG.md`, put these under `[Unreleased]`.
* If a change warrants updates the the [Calva wiki](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute), make those changes in a branch of the [wiki repo](https://github.com/BetterThanTomorrow/calva.wiki.git), with the same name as your feature branch.

Bigger changes:
* These go into a `wip` branch and we send PR’s asking for feedback.
* We keep `wip` branches updated by merging  `dev` onto them often.
* Circle-CI runs tests and buildls a VSIX package for any commits pushed to a PR. Follow the links to the build to find the VSIX (the **Artifact** tab).
* Consider asking for help testing in `#calva-dev` and wherever.

Smaller changes:
* Small, low-risky, fixes, we do right on `dev`
* Before committing on `dev` one has to ask: _should this be branched out to a `wip` branch?_

## 2. Prepare for Including the Change in the Next Published Calva
1. When a PR looks good, we merge it onto `dev`.
1. Consider if `README.md` needs update.
1. Make sure that `CHANGELOG.md` contains the right stuff.
1. `$ npm config set git-tag-version false && npm version patch`
   * This will bump the Calva version.
1. Commit with a message like: ”Add feature: **Short Release Description Title**"
1. (Optional) Tag the prerelease with **vVERSION-release-description-title** and pushes a prerelease to GitHub.
1. Push. (`--follow-tags` if applicable)
1. When `dev` is pushed, Circle CI run our tests, and builds a VSIX.
1. Download this VSIX and test it.


## 3. Publishing a New Calva version

When a VSIX is good enough for release, and someone authorized to commit to the `master` branch has _at least half an hour of spare time_, the following will bring it to the Marketplace:

1. Merge `dev` onto `master`.
1. Push `master`.
   * This will build the release VSIX, push a relase to GitHub, and publish it on the extension Marketplace.
   * You'll get an e-mail when it is published.
1. When the new version is live, immediatelly install it and see that it works.
   * If the Marketplace version works:
     1. On the `dev` branch, bump the `patch` part of the version in `package.json`.
     1. Commit with this message: "Bring on version: **new version**”.
     1. Push.
   * If the Marketplace version does not work:
     1. Install the artifact from the release build and test it.
        * If this works, then something in Microsoft's publish pipeline has broken the extension. This has happened (once) before. To retry again you need to build a new VSIX with a bumped version:
          1. `$ npm version patch`.
          1. Push.
        * If the artifact doesn't work (we should never be here).
          1. ???
