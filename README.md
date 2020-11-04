<!DOCTYPE markdown><!-- markdownlint-disable no-inline-html -->
<meta charset="utf-8" content="text/markdown" lang="en">
<!-- -## editors ## (emacs/sublime) -*- coding: utf8-nix; tab-width: 2; mode: markdown; indent-tabs-mode: nil; basic-offset: 2; st-word_wrap: 'true' -*- ## (jEdit) :tabSize=2:indentSize=2:mode=markdown: ## (notepad++) vim:tabstop=2:syntax=markdown:expandtab:smarttab:softtabstop=2 ## modeline (see <https://archive.is/djTUD>@@<http://webcitation.org/66W3EhCAP> ) -->
<!-- spell-checker:ignore expandtab markdownlint modeline smarttab softtabstop -->

<!-- spell-checker:words jlongman Longman Löthberg Marby -->
<!-- spell-checker:ignore humblebundle epub flac mobi sess simpleauth -->
<!-- markdownlint-disable commands-show-output -->

# [`humblebundle-download`][git-url]

> An easy way to download files from your humblebundle account
> <br/> &bull; an enhanced fork of [DMarby/humblebundle-ebook-downloader](https://github.com/DMarby/humblebundle-ebook-downloader)

[![License][license-image]][license-url]
[![Javascript Style Guide][style-image]][style-url]
<br/>
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][downloads-url]

## Installation

```shell
$ npm install -g humblebundle-download
```

## Usage

```shell
$ humblebundle-download --help

Usage: index [options]

Options:
  -V, --version                              output the version number
  -d, --download-folder <download_folder>    Download folder (default: "/home/Download/Humble Bundles")
  -l, --download-limit <download_limit>      Parallel download limit (default: 1)
  -f, --format <format>                      Format to download (all, cbz, epub, flac, mobi, mp3, pdf, pdf_hd, zip) (default: "pdf")
  -t, --type <type>                          Type to download (all, audio, ebook, video) (default: "ebook")
  -s, --sort-by <property>                   Sort bundles by property (date, name) (default: "date")
  --auth-token <auth-token>                  (optional) for use in headless mode, specify your authentication cookie from your browser (_simpleauth_sess)
  -a, --all                                  Download all bundles (default: false)
  --cache-max-age <hours>                    Maximum useful age of cached information (default: 24)
  -C, --no-cache                             Ignore cached bundle information
  --debug                                    Enable debug logging (default: false)
  -h, --help                                 output usage information
```

## Related

- [`humblebundle-ebook-downloader`](https://www.npmjs.com/package/humblebundle-ebook-downloader) @ [DMarby/humblebundle-ebook-downloader](https://github.com/DMarby/humblebundle-ebook-downloader)
- [jlongman/humblebundle-ebook-downloader](https://github.com/jlongman/humblebundle-ebook-downloader)

## Authors

- [Roy Ivy III](https://github.com/rivy)
- [David Marby](http://dmarby.se) ([original](https://github.com/DMarby/humblebundle-ebook-downloader) author)

## Contributors

- [J. Longman](https://github.com/jlongman)
- [Johannes Löthberg](https://github.com/kyrias)

## License

See [LICENSE.md](LICENSE.md)

<!-- badge references -->

[git-url]: https://github.com/rivy/humblebundle-download
[npm-image]: https://img.shields.io/npm/v/humblebundle-download.svg?style=flat
[npm-url]: https://npmjs.org/package/humblebundle-download
[downloads-image]: https://img.shields.io/npm/dm/humblebundle-download.svg?style=flat
[downloads-url]: https://npmjs.org/package/humblebundle-download
[license-image]: https://img.shields.io/npm/l/xdg-app-paths.svg?style=flat
[license-url]: license
[style-image]: https://img.shields.io/badge/code_style-standard-darkcyan.svg
[style-url]: https://standardjs.com

<!-- [style-image]: https://img.shields.io/badge/code_style-XO-darkcyan.svg
[style-url]: https://github.com/xojs/xo -->
