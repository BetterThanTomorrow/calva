EXTRA_RELEASE_OPTIONS=()

if [[ $CIRCLE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  echo "Publishing GitHub Release: $CIRCLE_TAG"
else
  echo "Publishing GitHub Prerelease: $CIRCLE_TAG"
  EXTRA_RELEASE_OPTIONS=(-prerelease)
fi

[[ $CIRCLE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+) ]] || exit
TAG_VERSION=${BASH_REMATCH[1]}

BODY=$(awk '
/^## \['"$TAG_VERSION"'\]/, started &&
/^##/ {
  started=1;
  if ($0 !~ /(^#|^\s*$)/) {
    gsub(/["$]/, "\\\\&");
    print
  }
}' CHANGELOG.md)

echo $'Changes: \n'"$BODY"

if [[ $IS_LOCAL == YES ]]; then
  GHR_CMD='echo'
else
  GHR_CMD=ghr
fi

$GHR_CMD -t "$GITHUB_TOKEN" \
  "${EXTRA_RELEASE_OPTIONS[@]}" \
  -u "$CIRCLE_PROJECT_USERNAME" \
  -r "$CIRCLE_PROJECT_REPONAME" \
  -b "$BODY" \
  -c "$CIRCLE_SHA1" \
  -delete "$CIRCLE_TAG" \
  /tmp/artifacts/
