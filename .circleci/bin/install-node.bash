version=$(cat .nvmrc)
curl -fsSL "https://nodejs.org/dist/v$version/node-v$version-linux-x64.tar.xz" |
  sudo tar -xJ -C /usr/local --strip-components=1 \
    --exclude CHANGELOG.md --exclude LICENSE --exclude README.md
node --version
