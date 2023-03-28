# @vroskus/lerna-i18next-aggregator

Tool to aggregate translations from all lerna packages. Aggregator scans lerna packages - .js and .pug files and extracts t('<value>') function values.

## Installation

Call:

`npm install -D @vroskus/lerna-i18next-aggregator`

`yarn add -D @vroskus/lerna-i18next-aggregator`

## Usage

1. Just run ```lerna-i18next-aggregator <languages> <resource files directory path> <lerna packages directory path>```:

Args:

#### <languages>
comma separated ISO 639-1 codes
```en,es,lt```

#### <resource files directory path>
a path to directory containing json files with translations. File names must match lerna package names. Only packages with matching resource file name will be processed.
```
  common.json
  package-a.json
  package-b.json
  ...
```

#### <lerna packages directory path>
a path to directory containing lerna packages
```
  ...
  packages/
    package-a/
    package-b/
    ...
  ...
```
