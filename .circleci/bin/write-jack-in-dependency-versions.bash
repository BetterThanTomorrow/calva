# The cache key can't checksum package.json: CI gives it a per-commit version
node -p 'JSON.stringify([].concat(require("./package.json").contributes.configuration)
  .map((c) => c.properties["calva.jackInDependencyVersions"])
  .find(Boolean).default)' | tee /tmp/jack-in-dependency-versions.json
