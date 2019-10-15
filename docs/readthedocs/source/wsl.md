# Using Calva with WSL

If you want to use this extension with WSL, there are a few things that need to be configured first.

1. The `useWSL` option must be set to `true` (And if you are using the linter, you must add a valid WSL path to the `jokerPath` option.)
2. After doing the previous step, you must restart Visual Studio Code.
3. Make sure that you have Windows 10 version 1803 since that's the version that includes the `wslpath` tool which is used to convert between WSL and Windows paths.
4. If you're using Leiningen and if you want to view definitions of source files (e.g. `println`, `defn`, `def`) you will need to change your .m2 directory to a location directly accessible by Windows. For example, you could edit your `~/.lein/profiles.clj` like so:
```
{:user {:local-repo "/mnt/c/Users/<Your User>/.m2"}}
```