version=$(cat .nvmrc)
tarball=~/node-download/node-v$version-linux-x64.tar.xz
if [[ ! -f $tarball ]]; then
  mkdir -p ~/node-download
  curl -fsSL -o "$tarball" "https://nodejs.org/dist/v$version/node-v$version-linux-x64.tar.xz"
fi
sudo tar -xJf "$tarball" -C /usr/local --strip-components=1 \
  --exclude CHANGELOG.md --exclude LICENSE --exclude README.md
node --version
