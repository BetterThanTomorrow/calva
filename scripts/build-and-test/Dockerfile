# syntax=docker/dockerfile:1.4

################################################################################
# Install deps step
################################################################################
FROM cimg/clojure:1.11-node as step-install-deps

USER circleci
RUN mkdir /home/circleci/calva
WORKDIR /home/circleci/calva

COPY --chown=circleci package.json package.json
COPY --chown=circleci package-lock.json package-lock.json

RUN npm install
COPY shadow-cljs.edn shadow-cljs.edn
COPY deps.edn deps.edn
RUN npx shadow-cljs classpath

CMD echo "Nothing to do here" # All actions run at image build time


################################################################################
# Build step
################################################################################
FROM cimg/clojure:1.11-node as step-build
USER circleci

# copy shadow deps
COPY --from=step-install-deps /home/circleci/.m2 /home/circleci/.m2

WORKDIR /home/circleci/calva

RUN mkdir /tmp/build
RUN mkdir /tmp/artifacts

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules

# Tamper Calva version if not release versioned
RUN <<EOF
VERSION=$(node -p 'require("./package.json").version')
TAG_VERSION=NO-TAG
if [[ "${CIRCLE_TAG}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]
then
  TAG_VERSION=${BASH_REMATCH[1]}
  echo 'No version tampering because this is a release tag'
else
  COMMIT=${CIRCLE_SHA1:0:8}
  if [[  "${CIRCLE_TAG}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)-(.*) ]]
  then
    TAG_VERSION=${BASH_REMATCH[1]}
    TAG_TITLE=${BASH_REMATCH[2]}
    PRERELEASE=${TAG_TITLE}-${COMMIT}
  else
    BRANCH=${CIRCLE_BRANCH//[^[:alnum:]]/-}
    PRERELEASE=${BRANCH}-${COMMIT}
  fi
  echo "Append prerelease to version: -${PRERELEASE}"
  npx json -I -f package.json -e 'this.version=this.version.replace(/$/,"-'${PRERELEASE}'")'
fi
if [ ${TAG_VERSION} = NO-TAG -o "${TAG_VERSION}" = "${VERSION}" ]
then
  VERSION=$(node -p 'require("./package.json").version')
  echo "Using version: ${VERSION}"
else
  echo >&2 "FATAL! Version missmatch between package.json and tag. Aborting."
  exit 1
fi
EOF

# Package vsix
RUN <<EOF
if [[ "${CIRCLE_TAG}" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]
then
  echo "Packaging as release"
  PACKAGE_CMD="vsce package --githubBranch published"
else
  echo "Packaging as pre-release"
  PACKAGE_CMD="vsce package --pre-release"
fi
npx ${PACKAGE_CMD}
EOF

CMD echo "Nothing to do here" # All actions run at image build time


################################################################################
# Grammar tests step
################################################################################
FROM arcanemagus/atom-docker-ci as step-test-grammar

USER atom
WORKDIR /home/atom/calva

# copy base dir
COPY --chown=atom . .
# restore deps
COPY --chown=atom --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=atom --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

CMD bash -c " \
/sbin/start-stop-daemon --start --quiet --pidfile /tmp/custom_xvfb_99.pid --make-pidfile --background --exec /usr/bin/Xvfb -- :99 -ac -screen 0 1024x768x16 +extension RANDR &\
cd src/calva-fmt/atom-language-clojure; \
./run-grammar-tests.sh"


################################################################################
# Prettier check step
################################################################################
FROM circleci/node:latest as step-prettier-check

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

CMD npm run prettier-check


################################################################################
# Eslint check step
################################################################################
FROM circleci/node:latest as step-eslint-check

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

CMD npm run eslint


################################################################################
# CLJSlib test step
################################################################################
FROM circleci/node:latest as step-test-cljslib

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

CMD npm run calva-lib-test


################################################################################
# TS unit test step
################################################################################
FROM circleci/node:latest as step-test-ts-unit

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

CMD npm run unit-test



################################################################################
# Integration tests step
################################################################################
FROM cimg/clojure:1.11-browsers as step-test-integration

# install missing base image deps
ENV DEBIAN_FRONTEND=noninteractive
RUN sudo apt update && sudo apt install -y libnss3 && sudo rm -rf /var/lib/apt/lists/*

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out

RUN npm run compile-test

CMD npm run integration-test


################################################################################
# e2e test step
################################################################################
FROM cimg/clojure:1.11-browsers as step-test-e2e

# install missing base image deps
ENV DEBIAN_FRONTEND=noninteractive
RUN sudo apt update && sudo apt install -y libnss3 && sudo rm -rf /var/lib/apt/lists/*

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out
# version field gets modified at build stage, so we have to copy this
COPY --chown=circleci --from=step-build /home/circleci/calva/package.json /home/circleci/calva/
COPY --chown=circleci --from=step-build /home/circleci/calva/*.vsix /home/circleci/calva/

CMD npm run e2e-test -- --calva-vsix=/home/circleci/calva/calva-$(node -p 'require("./package.json").version').vsix --test-workspace=src/extension-test/e2e-test

################################################################################
# subproject e2e test step
################################################################################
FROM cimg/clojure:1.11-browsers as step-test-e2e-sub-projects

# install missing base image deps
ENV DEBIAN_FRONTEND=noninteractive
RUN sudo apt update && sudo apt install -y libnss3 && sudo rm -rf /var/lib/apt/lists/*

USER circleci
WORKDIR /home/circleci/calva

# copy base dir
COPY --chown=circleci . .
# restore deps
COPY --chown=circleci --from=step-install-deps /home/circleci/calva/node_modules /home/circleci/calva/node_modules
# restore build
COPY --chown=circleci --from=step-build /home/circleci/calva/out/ /home/circleci/calva/out
# version field gets modified at build stage, so we have to copy this
COPY --chown=circleci --from=step-build /home/circleci/calva/package.json /home/circleci/calva/
COPY --chown=circleci --from=step-build /home/circleci/calva/*.vsix /home/circleci/calva/

CMD npm run e2e-test -- --calva-vsix=/tmp/artifacts/calva-$(node -p 'require("./package.json").version').vsix --test-workspace=test-data/projects/e2e-sub-projects