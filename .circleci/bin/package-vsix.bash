if [[ $CIRCLE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo 'Packaging as release'
  PACKAGE_CMD=(vsce package --githubBranch published)

else
  echo 'Packaging as pre-release'
  PACKAGE_CMD=(vsce package --pre-release)
fi

npx "${PACKAGE_CMD[@]}"
