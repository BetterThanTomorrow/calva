# CircleCI `config.yml`

CircleCI uses the `config.yml` file.

This file is generated from the `config.ys` file which references many other
files in this directory.

To regenerate `config.yml` after changing source files, run one of these
commands:

```
$ make build
$ bb build
```


## Layout

* `Makefile` - for building `config.yml` and running tests.
  * Auto installs deps
* `config.ys` - The main [YS](https://yamlscript.org) file that evaluates to
  the correct CircleCI `config.yml` file.
* `bin/` - All the longer bash sections refactored to testable .bash files.
* `jobs/` - Each `job` yaml section refactored to its own file.
* `workflows/` - Each `workflow` yaml section refactored to its own file.
* `lib/helpers.ys` - A YAMLScript library of helper functions.


## Testing

To run tests that check various things, run one of:

```
$ make test
$ bb test
```
