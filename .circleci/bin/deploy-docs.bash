git config --global user.email "$GITHUB_USER_EMAIL"
git config --global user.name "$GITHUB_USER_NAME"
git checkout published
(cd docs-builder && clojure -M:build --production)
git clone --branch gh-pages --single-branch --depth 1 "$(git remote get-url origin)" /tmp/gh-pages
find /tmp/gh-pages -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a site/. /tmp/gh-pages/
touch /tmp/gh-pages/.nojekyll
git -C /tmp/gh-pages add -A
git -C /tmp/gh-pages diff --cached --quiet || git -C /tmp/gh-pages commit -m "Deploy docs [skip ci]"
git -C /tmp/gh-pages push origin HEAD:gh-pages
