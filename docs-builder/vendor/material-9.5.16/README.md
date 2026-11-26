# Material for MkDocs 9.5.16 (vendored assets)

Source: [squidfunk/mkdocs-material](https://github.com/squidfunk/mkdocs-material) tag `9.5.16`.

This directory holds the compiled CSS and JS the Calva docs builder copies into `site/assets/`. The hashed filenames (`main.bcfcd587.min.css`, `bundle.bd41221c.min.js`, and so on) must match the Material 9.5.16 release so the shell’s `<link>` and `<script>` paths stay valid.

## How to update

1. Check out or download mkdocs-material `9.5.16` (or a newer pin after a deliberate bump).
2. Copy `material/templates/assets/stylesheets/*.min.css{,.map}` and `material/templates/assets/javascripts/**` into this tree, keeping the release’s hashed names.
3. Update `calva.docs.shell` constants for the new hashes.
4. Record the new pin in this README and in `THIRD-PARTY-NOTICES`.

Do not rename hashed files; Material’s `__config` and CSS expect those exact names.
