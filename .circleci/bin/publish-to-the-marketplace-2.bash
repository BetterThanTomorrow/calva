VSCE_CMD=(
  vsce publish --packagePath "/tmp/artifacts/calva-$(
    node -p 'require("./package.json").version'
  ).vsix" -p "$PUBLISH_TOKEN"
)

if [[ $IS_LOCAL == YES ]]; then
  echo "Dry npx ${VSCE_CMD[*]}"

else
  npx "${VSCE_CMD[@]}"
fi
