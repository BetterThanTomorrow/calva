VERSION=$(node -p 'require("./package.json").version')
TAG_VERSION=NO-TAG

if [[ $CIRCLE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  TAG_VERSION=${BASH_REMATCH[1]}
  echo 'No version tampering because this is a release tag'

else
  COMMIT=${CIRCLE_SHA1:0:8}

  if [[ $CIRCLE_TAG =~ ^v([0-9]+\.[0-9]+\.[0-9]+)-(.*) ]]; then
    TAG_VERSION=${BASH_REMATCH[1]}
    TAG_TITLE=${BASH_REMATCH[2]}
    PRERELEASE=$TAG_TITLE-$COMMIT
  else
    BRANCH=${CIRCLE_BRANCH//[^[:alnum:]]/-}
    PRERELEASE=$BRANCH-$COMMIT
  fi

  echo "Append prerelease to version: -$PRERELEASE"
  npx json -I -f package.json \
    -e 'this.version=this.version.replace(/$/,"-'"$PRERELEASE"'")'
fi

if [[ $TAG_VERSION == NO-TAG || $TAG_VERSION == "$VERSION" ]]; then
  VERSION=$(node -p 'require("./package.json").version')
  echo "Using version: $VERSION"

else
  echo >&2 'FATAL! Version missmatch between package.json and tag. Aborting.'
  exit 1
fi
