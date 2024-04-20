git config --global user.email "$GITHUB_USER_EMAIL"
git config --global user.name "$GITHUB_USER_NAME"
git checkout published
git pull
git merge origin/dev --no-ff -m "Merge branch dev into published"
git push origin HEAD
