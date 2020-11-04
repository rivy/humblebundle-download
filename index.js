#!/usr/bin/env node
/* eslint-env es6, node */
// ## editors ## (emacs/sublime) -*- coding: utf8-nix; tab-width: 2; mode: javascript; indent-tabs-mode: nil; basic-offset: 2; -*- ## (jEdit) :tabSize=4:indentSize=4:mode=javascript: ## (notepad++) vim:tabstop=2:syntax=javascript:expandtab:smarttab:softtabstop=2 ## modeline (see <https://archive.is/djTUD>@@<http://webcitation.org/66W3EhCAP> )
// spell-checker:ignore expandtab smarttab softtabstop modeline
// spell-checker:ignore keypath epub flac mobi simpleauth subproduct subproducts gamekey humblebundle barsize linebyline

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const readline = require('readline');
const url = require('url');
const util = require('util');

const async = require('async');
const bottleneck = require('bottleneck');
const breeze = require('breeze');
const cliProgress = require('cli-progress');
const colors = require('colors');
const commander = require('commander');
const enquirer = require('enquirer');
const fs = require('fs-extra');
const locatePath = require('locate-path');
const keypath = require('nasa-keypath');
const nightmare = require('nightmare');
const request = require('request');
const sanitizeFilename = require('sanitize-filename');

const packageInfo = require('./package.json');

// eslint-disable-next-line import/order
const xdgAppPaths = require('xdg-app-paths')(packageInfo.name);

const userAgent = util.format(packageInfo.name + '/%s', packageInfo.version);

const SUPPORTED_PLATFORMS = ['audio', 'ebook', 'video'];
const SUPPORTED_AUDIO_FORMATS = ['flac', 'mp3'];
const SUPPORTED_EBOOK_FORMATS = ['epub', 'mobi', 'pdf', 'pdf_hd'];
const SUPPORTED_COMIC_FORMATS = ['cbz'];
// const SUPPORTED_VIDEO_FORMATS = ['download']
const SUPPORTED_GENERAL_FORMATS = ['zip'];
const SUPPORTED_FORMATS = SUPPORTED_AUDIO_FORMATS.concat(SUPPORTED_EBOOK_FORMATS)
	.concat(SUPPORTED_COMIC_FORMATS)
	.concat(SUPPORTED_GENERAL_FORMATS);
const ALLOWED_FORMATS = SUPPORTED_FORMATS.concat(['all']).sort();
const ALLOWED_TYPES = SUPPORTED_PLATFORMS.concat(['all']).sort();

const ALLOWED_SORT_PROPERTIES = ['date', 'name'].sort();

// work-around for "hang" after 'enquirer' <ESCAPE>/cancel() on windows platforms; see <https://github.com/enquirer/enquirer/issues/245>
// * arises from "node" bug after Node-v10.2 thru Node-v14.6 => see <https://github.com/nodejs/node/issues/31762>
// ToDO: keep apprised of any fix for this via `enquirer`
const readlineOldClose = readline.Interface.prototype.close;
readline.Interface.prototype.close = function () {
	this.terminal = false;
	readlineOldClose.call(this);
};

commander
	.version(packageInfo.version)
	.option(
		'-d, --download-folder <download_folder>',
		'Download folder',
		path.join(os.homedir(), 'Downloads', 'Humble Bundles')
	)
	.option('-l, --download-limit <download_limit>', 'Parallel download limit', 1)
	.option(
		'-f, --format <format>',
		util.format('Format to download (%s)', ALLOWED_FORMATS.join(', ')),
		'pdf'
	)
	.option(
		'-t, --type <type>',
		util.format('Type to download (%s)', ALLOWED_TYPES.join(', ')),
		'ebook'
	)
	.option(
		'-s, --sort-by <property>',
		util.format('Sort bundles by property (%s)', ALLOWED_SORT_PROPERTIES.join(', ')),
		'date'
	)
	.option(
		'--auth-token <auth-token>',
		'(optional) for use in headless mode, specify your authentication cookie from your browser (_simpleauth_sess)'
	)
	.option('-a, --all', 'Download all bundles (default: false)', false)
	.option('--cache-max-age <hours>', 'Maximum useful age of cached information', 24)
	.option('-C, --no-cache', 'Ignore cached bundle information')
	.option('--debug', 'Enable debug logging (default: false)', false)
	.parse(process.argv);

if (ALLOWED_FORMATS.indexOf(commander.format) === -1) {
	console.error(colors.red('Invalid format selected.'));
	commander.help();
}

commander.format = commander.format === 'zip' ? 'download' : commander.format;

const possibleConfigPaths = xdgAppPaths
	.configDirs()
	.concat(xdgAppPaths.configDirs({ isolated: !xdgAppPaths.$isolated() }))
	.map((v) => path.join(v, packageInfo.name + '.json'));
const configPath = locatePath.sync(possibleConfigPaths, { type: 'file' }) || possibleConfigPaths[0];
debug('configPath="%s"', configPath);
fs.mkdirpSync(path.dirname(configPath), 0o700);

const cacheDir = path.join(xdgAppPaths.cache());
debug('cacheDir="%s"', cacheDir);
fs.mkdirpSync(cacheDir, 0o700);
const cachePath = {};
cachePath.orders = path.join(cacheDir, 'orders.json');

debug('commander.format=%s', commander.format);
debug('commander.type=%s', commander.type);

const flow = breeze();
const limiter = new bottleneck({
	// Limit concurrent downloads
	maxConcurrent: commander.downloadLimit,
});

console.log(colors.green('Starting...'));

function loadConfig(next) {
	fs.readFile(configPath, (error, data) => {
		if (error) {
			if (error.code === 'ENOENT') {
				// no config file; continue without error
				return next(null, {});
			}
			return next(error);
		}

		let config;

		try {
			config = JSON.parse(data);
		} catch (ignore) {
			config = {};
		}

		next(null, config);
	});
}

function getRequestHeaders(session) {
	return {
		Accept: 'application/json',
		'Accept-Charset': 'utf-8',
		'User-Agent': userAgent,
		Cookie: '_simpleauth_sess=' + session + ';',
	};
}

function validateSession(next, config) {
	console.log('Validating session...');

	var session = config.session;

	if (!commander.authToken) {
		if (!config.session || !config.expirationDate) {
			return next();
		}

		if (config.expirationDate < new Date()) {
			return next();
		}
	} else {
		session = util.format('"%s"', commander.authToken.replace(/^"|"$/g, ''));
	}

	request.get(
		{
			url: 'https://www.humblebundle.com/api/v1/user/order?ajax=true',
			headers: getRequestHeaders(session),
			json: true,
		},
		(error, response) => {
			if (error) {
				return next(error);
			}

			if (response.statusCode === 200) {
				return next(null, session);
			}

			if (response.statusCode === 401 && !commander.authToken) {
				return next(null);
			}

			return next(
				new Error(
					util.format(
						'Could not validate session, unknown error, status code:',
						response.statusCode
					)
				)
			);
		}
	);
}

function saveConfig(config, callback) {
	fs.writeFile(configPath, JSON.stringify(config, null, 4), 'utf8', callback);
}

function debug() {
	if (commander.debug) {
		console.error(colors.yellow('[DEBUG] ' + util.format.apply(this, arguments)));
	}
}

function authenticate(next) {
	console.log('Authenticating...');

	var browser = nightmare({
		show: true,
		width: 800,
		height: 600,
	});

	browser.useragent(userAgent);

	var handledRedirect = false;

	function handleRedirect(targetUrl) {
		if (handledRedirect) {
			return;
		}

		var parsedUrl = url.parse(targetUrl, true);

		if (
			parsedUrl.hostname !== 'www.humblebundle.com' ||
			parsedUrl.path.indexOf('/home/library') === -1
		) {
			return;
		}

		debug('Handled redirect for url %s', targetUrl);
		handledRedirect = true;

		browser.cookies
			.get({
				secure: true,
				name: '_simpleauth_sess',
			})
			.then((sessionCookie) => {
				if (!sessionCookie) {
					return next(new Error('Could not get session cookie'));
				}

				browser._endNow();

				saveConfig(
					{
						session: sessionCookie.value,
						expirationDate: new Date(sessionCookie.expirationDate * 1000),
					},
					(error) => {
						if (error) {
							return next(error);
						}

						next(null, sessionCookie.value);
					}
				);
			})
			.catch((error) => next(error));
	}

	browser.on(
		'did-get-redirect-request',
		(_event, sourceUrl, targetUrl, _isMainFrame, _responseCode, _requestMethod) => {
			debug('did-get-redirect-request: %s %s', sourceUrl, targetUrl);
			handleRedirect(targetUrl);
		}
	);

	browser.on('will-navigate', (event, targetUrl) => {
		debug('will-navigate: %s', targetUrl);
		handleRedirect(targetUrl);
	});

	browser
		.goto('https://www.humblebundle.com/login?goto=%2Fhome%2Flibrary')
		.then()
		.catch((error) => next(error));
}

function loadOrders(next, session) {
	if (!commander.cache) {
		return next(null, null, session);
	}

	fs.readFile(cachePath.orders, (error, data) => {
		if (error) {
			if (error.code === 'ENOENT') {
				// no cache file found; continue with <null> cache, without error
				return next(null, null, session);
			}
			return next(error);
		}

		const now = new Date();
		const msPerHour = 60 * 60 * 1000;
		const ordersAgeInHours = (now - fs.statSync(cachePath.orders).ctime) / msPerHour;
		debug('ordersAgeInHours =', ordersAgeInHours);
		if (ordersAgeInHours > commander.cacheMaxAge) {
			return next(null, null, session);
		}

		let orders;

		try {
			orders = JSON.parse(data);
		} catch (ignore) {
			orders = null;
		}

		next(null, orders, session);
	});
}

function saveOrders(orders, callback) {
	fs.writeFile(cachePath.orders, JSON.stringify(orders, null, 4), 'utf8', callback);
}

function fetchOrders(next, orders, session) {
	if (orders) {
		return next(null, orders, session);
	}

	request.get(
		{
			url: 'https://www.humblebundle.com/api/v1/user/order?ajax=true',
			headers: getRequestHeaders(session),
			json: true,
		},
		(error, response) => {
			if (error) {
				return next(error);
			}

			if (response.statusCode !== 200) {
				return next(
					new Error(
						util.format('Could not fetch orders, unknown error, status code:', response.statusCode)
					)
				);
			}

			var total = response.body.length;
			var done = 0;
			var progressBar = new cliProgress.Bar({
				// barsize: 50, // default == 40
				format:
					'Fetching bundles... [{bar}] ' +
					colors.yellow('{value}') +
					'/' +
					colors.yellow('{total}') +
					' (' +
					colors.yellow('{percentage}%') +
					')',
				// hideCursor: true // ToDO: catch CTRL-C and re-enable; current CTRL-C exit from app causes loss of cursor display
			});

			var orderInfoLimiter = new bottleneck({
				maxConcurrent: 5,
				minTime: 500,
			});

			progressBar.start(total, done);
			async.concat(
				response.body,
				(item, next) => {
					orderInfoLimiter.submit((next) => {
						request.get(
							{
								url: util.format(
									'https://www.humblebundle.com/api/v1/order/%s?ajax=true',
									item.gamekey
								),
								headers: getRequestHeaders(session),
								json: true,
							},
							(error, response) => {
								if (error) {
									return next(error);
								}

								if (response.statusCode !== 200) {
									return next(
										new Error(
											util.format(
												'Could not fetch orders, unknown error, status code:',
												response.statusCode
											)
										)
									);
								}

								progressBar.update(++done);
								next(null, response.body);
							}
						);
					}, next);
				},
				(error, orders) => {
					progressBar.stop();
					if (error) {
						return next(error);
					}

					saveOrders(orders, (error) => {
						if (error) {
							return next(error);
						}

						next(null, orders, session);
					});
				}
			);
		}
	);
}

function filterOrders(next, orders, session) {
	var filteredOrders = orders.filter((order) => {
		let include = false;
		// debug('order.platforms =>', flatten(keypath.get(order, 'subproducts.[].downloads.[].platform')))
		if (commander.type === 'all') {
			include = flatten(keypath.get(order, 'subproducts.[].downloads.[].platform')).some((v) =>
				SUPPORTED_PLATFORMS.some(
					(p) => p.localeCompare(v, undefined, { sensitivity: 'base' }) === 0
				)
			);
		} else {
			include = flatten(keypath.get(order, 'subproducts.[].downloads.[].platform')).some(
				(v) => commander.type.localeCompare(v, undefined, { sensitivity: 'base' }) === 0
			);
		}
		// debug('match:platform =>', include)
		// debug('order.names =>',flatten(keypath.get(order, 'subproducts.[].downloads.[].download_struct.[].name')))

		if (include) {
			if (commander.format === 'all') {
				include = flatten(
					keypath.get(order, 'subproducts.[].downloads.[].download_struct.[].name')
				).some((v) => SUPPORTED_FORMATS.concat('download').includes(v.toLowerCase()));
			} else {
				include = flatten(
					keypath.get(order, 'subproducts.[].downloads.[].download_struct.[].name')
				).some((v) => commander.format.localeCompare(v, undefined, { sensitivity: 'base' }) === 0);
			}
		}
		// debug('match:supported_types =>',flatten(keypath.get(order, 'subproducts.[].downloads.[].download_struct.[].name')).some(v => SUPPORTED_FORMATS.concat('download').includes(v.toLowerCase())))
		// debug('match:type =>', flatten(keypath.get(order, 'subproducts.[].downloads.[].download_struct.[].name')).some(v => commander.format.localeCompare(v, undefined, {sensitivity: 'base'}) === 0))
		// debug('include =>', include)
		return include;
	});

	next(null, filteredOrders, session);
}

function getWindowHeight() {
	var windowSize = process.stdout.getWindowSize();
	return windowSize[windowSize.length - 1];
}

function displayOrders(next, orders) {
	var options = [];

	orders.sort((a, b) => {
		if (commander.sortBy === 'name') {
			return a.product.human_name.localeCompare(b.product.human_name);
		}
		return b.created.localeCompare(a.created);
	});

	for (var order of orders) {
		options.push(order.product.human_name);
	}

	process.stdout.write('\x1Bc'); // Clear console

	const prompt = new enquirer.MultiSelect({
		name: 'bundle',
		message: 'Select bundles to download',
		choices: options,
		limit: Math.min(options.length, getWindowHeight() - 1),
		hint: '(<SPACE> to select, <ENTER> to confirm selection(s), <ESC> to exit)',
		indicator(_state, choice) {
			if (choice.enabled) {
				return colors.green('✓'); // or '⬤'
			}
			return colors.dim.gray('·');
		},
		// enable <PageUP> to move the cursor up a page, instead of the default shrink displayed list size
		pageUp() {
			for (let i = 0; i < this.limit - 1; i++) {
				this.up();
			}
			return this.render();
		},
		// enable <PageDOWN> to move the cursor down a page, instead of the default enlarge displayed list size
		pageDown() {
			for (let i = 0; i < this.limit - 1; i++) {
				this.down();
			}
			return this.render();
		},
	});

	prompt
		.run()
		.catch(() => {}) // empty selections throw an `alert()` (with no information) => so, ignore all errors
		.then((answers = []) => {
			// console.log(answers);
			const o = orders.filter((item) => {
				return answers.indexOf(item.product.human_name) !== -1;
			});
			// console.log(o);
			next(null, o);
		});
}

function sortBundles(next, bundles) {
	next(
		null,
		bundles.sort((a, b) => {
			if (commander.sortBy === 'name') {
				return a.product.human_name.localeCompare(b.product.human_name);
			}
			return b.created.localeCompare(a.created);
		})
	);
}

function flatten(list) {
	return list.reduce((a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []);
}

function normalizeFormat(format) {
	switch (format.toLowerCase()) {
		case '.cbz':
			return 'cbz';
		case 'pdf (hq)':
		case 'pdf (hd)':
			return 'pdf_hd';
		// case 'download':
		//   return 'pdf'
		default:
			return format.toLowerCase();
	}
}

function getExtension(format) {
	let extension = format.toLowerCase().replace(/^[.]+/, '');
	debug('getExtension:format=', extension);
	switch (extension) {
		case 'pdf_hd':
			return ' (hd).pdf';
		default:
			return util.format('.%s', extension);
	}
}

function checkSignatureMatch(filePath, download, callback) {
	var hashType = download.sha1 ? 'sha1' : 'md5';
	var hashToVerify = download[hashType];

	var hash = crypto.createHash(hashType);
	hash.setEncoding('hex');

	var stream = fs.createReadStream(filePath);

	stream.on('error', (error) => {
		if (error.code === 'ENOENT') {
			return callback();
		}
		return callback(error);
	});

	stream.on('end', () => {
		hash.end();
		return callback(null, hash.read() === hashToVerify);
	});

	stream.pipe(hash);
}

function downloadItem(bundle, name, download, message, callback) {
	var downloadPath = path.resolve(commander.downloadFolder, sanitizeFilename(bundle));

	debug('downloadItem:bundle =', bundle);
	debug('downloadItem:name =', name);
	debug('downloadItem:download =', download);

	fs.mkdirp(downloadPath, 0o700, (error) => {
		if (error) {
			return callback(error);
		}

		var fileName = util.format(
			'%s%s',
			name.trim(),
			getExtension(normalizeFormat(path.parse(url.parse(download.url.web).pathname).ext))
		);
		debug('fileName =', fileName);
		var filePath = path.resolve(downloadPath, sanitizeFilename(fileName));

		checkSignatureMatch(filePath, download, (error, matches) => {
			if (error) {
				return callback(error);
			}

			if (matches) {
				return callback(null, true);
			}

			console.log(message);
			var file = fs.createWriteStream(filePath);

			file.on('finish', () => {
				file.close(() => {
					callback();
				});
			});

			request
				.get({
					url: download.url.web,
				})
				.on('error', (error) => {
					callback(error);
				})
				.pipe(file);
		});
	});
}

function downloadBundles(next, bundles) {
	if (!bundles.length) {
		console.log(colors.green('No bundles selected, exiting'));
		return next();
	}

	var downloads = [];

	for (var bundle of bundles) {
		var bundleName = bundle.product.human_name;
		var bundleDownloads = [];
		var bundleFormats = [];

		for (var subproduct of bundle.subproducts) {
			var filteredDownloads = subproduct.downloads.filter((download) => {
				if (
					commander.type !== 'all' &&
					download.platform.localeCompare(commander.type, undefined, { standard: 'base' }) !== 0
				) {
					return false;
				}

				return SUPPORTED_PLATFORMS.indexOf(download.platform) !== -1;
			});

			var downloadStructs = flatten(keypath.get(filteredDownloads, '[].download_struct'));
			var filteredDownloadStructs = downloadStructs.filter((download) => {
				if (!download.name || !download.url) {
					return false;
				}

				var normalizedFormat = normalizeFormat(download.name);

				if (
					bundleFormats.indexOf(normalizedFormat) === -1 &&
					SUPPORTED_FORMATS.indexOf(normalizedFormat) !== -1
				) {
					bundleFormats.push(normalizedFormat);
				}

				return commander.format === 'all' || normalizedFormat === commander.format;
			});

			for (var filteredDownload of filteredDownloadStructs) {
				bundleDownloads.push({
					bundle: bundleName,
					download: filteredDownload,
					name: subproduct.human_name,
				});
			}
		}

		if (!bundleDownloads.length) {
			console.log(
				colors.red(
					'No downloads found matching the right format (%s) for bundle (%s), available formats: (%s)'
				),
				commander.format,
				bundleName,
				bundleFormats.sort().join(', ')
			);
			continue;
		}

		for (var download of bundleDownloads) {
			downloads.push(download);
		}
	}

	if (!downloads.length) {
		console.log(
			colors.red('No downloads found matching the right format (%s), exiting'),
			commander.format
		);
	}

	async.each(
		downloads,
		(download, next) => {
			limiter.submit((next) => {
				const format = getExtension(
					normalizeFormat(path.parse(url.parse(download.download.url.web).pathname).ext)
				)
					.toUpperCase()
					.replace(/^[.]+/, '');
				const message = util.format(
					'Downloading %s - %s (%s) (%s)... (%s/%s)',
					download.bundle,
					download.name,
					format,
					download.download.human_size,
					colors.yellow(downloads.indexOf(download) + 1),
					colors.yellow(downloads.length)
				);
				downloadItem(
					download.bundle,
					download.name,
					download.download,
					message,
					(error, skipped) => {
						if (error) {
							return next(error);
						}

						if (skipped) {
							console.log(
								'SKIPPED download of completed %s - %s (%s) (%s)... (%s/%s)',
								download.bundle,
								download.name,
								format,
								download.download.human_size,
								colors.yellow(downloads.indexOf(download) + 1),
								colors.yellow(downloads.length)
							);
						}

						next();
					}
				);
			}, next);
		},
		(error) => {
			if (error) {
				return next(error);
			}

			console.log(colors.green('Done'));
			next();
		}
	);
}

flow.then(loadConfig);
flow.then(validateSession);
flow.when((session) => !session, authenticate);
flow.then(loadOrders);
flow.then(fetchOrders);
flow.then(filterOrders);
flow.when(!commander.all, displayOrders);
flow.when(commander.all, sortBundles);
flow.then(downloadBundles);

flow.catch((error) => {
	console.error(colors.red('An error occurred, exiting.'));
	console.error(error);
	process.exit(1);
});
