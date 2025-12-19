# Releasing

1. Update the version in `package.json`
2. Update the version in `support/package.esm.json`
3. Update the changelog `CHANGELOG.md` with `conventional-changelog -p angular`
4. Compile the TypeScript sources with `npm run compile`
5. Generate the bundles with `npm run build`
6. Commit the changes in `package.json`, `support/package.esm.json`, `CHANGELOG.md` and `dist/`
7. Create the tag `socket.io-client@x.y.z` and push it to the GitHub repository. The workflow `.github/workflows/publish.yml` will safely publish the package to npm using trusted publishing.
8. Create a new release at https://github.com/socketio/socket.io/releases
9. Copy the bundles to the repository https://github.com/socketio/socket.io-cdn so that they are available at https://cdn.socket.io/
