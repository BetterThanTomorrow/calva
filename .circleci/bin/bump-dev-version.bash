git config --global user.email "$GITHUB_USER_EMAIL"
git config --global user.name "$GITHUB_USER_NAME"
git checkout dev
npm run bump-version
git pull
git add .
git commit -m "Bring on version $(node -p "require('./package').version")!"
git push origin HEAD
