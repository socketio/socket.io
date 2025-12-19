# Releasing

1. Update the version in `package.json`
2. Update the changelog `CHANGELOG.md` with `conventional-changelog -p angular`
3. Copy the bundles from the client project to `client-dist/`
4. Commit the changes in `package.json`, `CHANGELOG.md` and `client-dist/`
5. Create the tag `socket.io@x.y.z` and push it to the GitHub repository. The workflow `.github/workflows/publish.yml` will safely publish the package to npm using trusted publishing.
6. Create a new release at https://github.com/socketio/socket.io/releases
