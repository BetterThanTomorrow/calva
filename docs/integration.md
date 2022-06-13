# The Calva Development and Release Process

_This is mainly for Calva maintainers. But is probably good for any [contributor](https://github.com/BetterThanTomorrow/calva/wiki/How-to-Contribute) to be familiar with. Also, feedback and tips on how to improve this process is very welcome._

## 1. Introducing Changes

Generally:

* Don't forget about `README.md`. (It might not need to be updated, but anyway.)
* If a change warrants updates to `CHANGELOG.md`, put these under `[Unreleased]`.
* If a change warrants updates the the Calva User Guide, make your changes where necessary in `docs/site`. 

Bigger changes:

* These go into a `wip` branch and we send PR’s asking for feedback.
* We keep `wip` branches updated by merging  `dev` onto them often.
* Circle-CI runs tests and builds a VSIX package for any commits pushed to a PR. Follow the links to the build to find the VSIX (the **Artifact** tab).
* Consider asking for help testing in `#calva` and wherever.

Smaller changes:

* Small, low-risky, fixes, you can do right on `dev`
* Before committing on `dev` one has to ask: _should this be branched out to a `wip` branch?_

## 2. Prepare for Including the Change in the Next Published Calva

When a PR looks good:

1. Make sure the PR template checklist items are checked off / accounted for.
1. Merge the PR.
1. Click the **Delete branch** button that Github offers (when it's not from a fork, that is).
1. Circle CI runs our tests, and builds a VSIX.
1. Download this VSIX post on #calva asking for help testing it. Attaching the `[Unreleased]` CHANGELOG entry is an easy way to let people know what is new.

## 3. Publishing a New Calva Version

When a VSIX is good enough for release, and someone authorized to commit to the `published` branch has _at least half an hour of spare time_, the following will bring it to the Marketplace:

1. Checkout `dev`
1. Run `bb publish.clj`
   * This updates the changelog to move the Unreleased items to a new section for the new version, commits, tags the commit, and pushes with `--follow-tags` so that the CI publish workflow is kicked off.
1. Click to approve the publishing of the extension in the CircleCI web app
1. When the new version is live, immediately install it and see that it works.
   * If the Marketplace version does not work, install the artifact from the release build and test it.
      * If this works, then something in Microsoft's publish pipeline has broken the extension. This has happened (a few times) before. To retry again, start over at step 1.
      * If the artifact doesn't work (we should never be here) - ???

### The Publishing Process and Rationale

We develop features off the `dev` branch and manually dictate (via `bb publish.clj`) when to release a new version from this branch. This is so that we have the option of accumulating features for release on this branch, rather than releasing a new version for every PR merged into `published`.

We want to keep the `published` branch in sync with the released version. After a release is published, the CI merges the `dev` branch into `published`. It then deploys the docs from `published` and bumps the version on `dev`. Bumping the version on `dev` after a publish lines up with our process of `dev` representing the next version of Calva.

## 4. Updating README.md (and other docs) after publishing

Sometimes we need to update the documentation contained in the Calva repo, such as `README.md`, of the published extension, w/o publishing a new version.

Make the changes on `published` and cherry pick back on `dev`.
