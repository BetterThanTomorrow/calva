OVSX_CMD=(
  ovsx publish "/tmp/artifacts/calva-$(
    node -p 'require("./package.json").version'
  ).vsix" --pat "$OVSX_PUBLISH_TOKEN"
)

if [[ $IS_LOCAL == YES ]]; then
  echo "Dry npx ${OVSX_CMD[*]}"

else
  npx "${OVSX_CMD[@]}"
fi
