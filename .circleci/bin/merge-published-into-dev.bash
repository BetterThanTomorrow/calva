git config --global user.email "$GITHUB_USER_EMAIL"
git config --global user.name "$GITHUB_USER_NAME"
git checkout dev
git pull
git merge origin/published --no-ff -m "Merge branch published into dev [skip ci]"
git push origin HEAD
