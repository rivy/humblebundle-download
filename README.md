<!DOCTYPE markdown><!-- markdownlint-disable no-inline-html -->
<meta charset="utf-8" content="text/markdown" lang="en">
<!-- -## editors ## (emacs/sublime) -*- coding: utf8-nix; tab-width: 2; mode: markdown; indent-tabs-mode: nil; basic-offset: 2; st-word_wrap: 'true' -*- ## (jEdit) :tabSize=2:indentSize=2:mode=markdown: ## (notepad++) vim:tabstop=2:syntax=markdown:expandtab:smarttab:softtabstop=2 ## modeline (see <https://archive.is/djTUD>@@<http://webcitation.org/66W3EhCAP> ) -->
<!-- spell-checker:ignore expandtab markdownlint modeline smarttab softtabstop -->

<!-- spell-checker:words Longman Löthberg -->
<!-- spell-checker:ignore humblebundle epub mobi sess simpleauth -->

# humblebundle-ebook-downloader

An easy way to download ebooks from your humblebundle account

## Installation

```shell
$ npm install -g humblebundle-ebook-downloader
```

## Usage

```shell
$ humblebundle-ebook-downloader --help

  Usage: humblebundle-ebook-downloader [options]

  Options:

    -V, --version                              output the version number
    -d, --download-folder <downloader_folder>  Download folder (default: download)
    -l, --download-limit <download_limit>      Parallel download limit (default: 1)
    -f, --format <format>                      What format to download the ebook in (all, cbz, epub, mobi, pdf, pdf_hd) (default: epub)
    --auth-token <auth-token>                  Optional: If you want to run headless, you can specify your authentication cookie from your browser (_simpleauth_sess)
    -a, --all                                  Download all bundles
    --debug                                    Enable debug logging
    -h, --help                                 output usage information
```

## Contributors
- [J. Longman](https://github.com/jlongman)
- [Johannes Löthberg](https://github.com/kyrias)

## License
See [LICENSE.md](LICENSE.md)
