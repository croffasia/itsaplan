# Changelog

## [0.4.0](https://github.com/croffasia/itsaplan/compare/v0.3.0...v0.4.0) (2026-07-27)


### Features

* scope agent memory threads and delete them with their owner ([#42](https://github.com/croffasia/itsaplan/issues/42)) ([2857970](https://github.com/croffasia/itsaplan/commit/28579704b98b86a12c6e92081c709c749b5ec8ac))
* send an anonymous daily instance snapshot ([#35](https://github.com/croffasia/itsaplan/issues/35)) ([be68f4a](https://github.com/croffasia/itsaplan/commit/be68f4aa64d369f9cea24a6cffc8b122e4514743))
* show an issue status timeline above the activity log ([#34](https://github.com/croffasia/itsaplan/issues/34)) ([a4b6bd9](https://github.com/croffasia/itsaplan/commit/a4b6bd95147cdee870e28ed4b1e810cc08ce80cd))
* show the running version and available updates in the sidebar ([#31](https://github.com/croffasia/itsaplan/issues/31)) ([74885d3](https://github.com/croffasia/itsaplan/commit/74885d35411219a5f0ddde7abaa9ec9722ca018a))
* **web:** add code blocks, a slash menu and image picking to the issue editor ([#40](https://github.com/croffasia/itsaplan/issues/40)) ([db52b5e](https://github.com/croffasia/itsaplan/commit/db52b5e069a7f6baef436639d9e329455f03321b))


### Bug Fixes

* **api:** scope issue column and type to the issue's project ([#39](https://github.com/croffasia/itsaplan/issues/39)) ([84b82e5](https://github.com/croffasia/itsaplan/commit/84b82e52041fee1b39d883507c10f2d4a3410bcd))
* **api:** scope issue custom fields to the issue's project ([#36](https://github.com/croffasia/itsaplan/issues/36)) ([51fe6d3](https://github.com/croffasia/itsaplan/commit/51fe6d33ede5990599a76e21d8698e7b51a95d00))
* **api:** scope issue labels to the issue's project ([#38](https://github.com/croffasia/itsaplan/issues/38)) ([9ba0fe8](https://github.com/croffasia/itsaplan/commit/9ba0fe8a4871f7f5478cbf8db58fc5a3ff3c7229))
* **web:** correct the layout and figures of the issue stats ([#41](https://github.com/croffasia/itsaplan/issues/41)) ([0a03c84](https://github.com/croffasia/itsaplan/commit/0a03c84d2ef87216711b8ffc47a08e376ed80853))


### Performance

* **web:** cut the request waterfall when opening an issue ([#37](https://github.com/croffasia/itsaplan/issues/37)) ([58ca097](https://github.com/croffasia/itsaplan/commit/58ca0970a4650907797d726229bdd0ce052c4e26))


### CI

* fix release-please releases and mirror them into a release branch ([#33](https://github.com/croffasia/itsaplan/issues/33)) ([e38f319](https://github.com/croffasia/itsaplan/commit/e38f319a770aebfda9b790dccd53b5c4468aeb37))
* move the release branch push into the release workflow ([#43](https://github.com/croffasia/itsaplan/issues/43)) ([b8559da](https://github.com/croffasia/itsaplan/commit/b8559da9a8711fe9a93fa4ce58d3034ca89f416c))

## [0.3.0](https://github.com/croffasia/itsaplan/compare/v0.2.0...v0.3.0) (2026-07-25)


### Features

* add per-project toggles for initiatives, dashboards and notes ([#27](https://github.com/croffasia/itsaplan/issues/27)) ([1286517](https://github.com/croffasia/itsaplan/commit/128651712814e31bc3461c22e41a182f55fb01fb))
* **web:** add initiative submenu to issue context menu ([#29](https://github.com/croffasia/itsaplan/issues/29)) ([e63067a](https://github.com/croffasia/itsaplan/commit/e63067ab5020eb9e3806d9810eff45d4d0ae78f8))
* **web:** add shared EmptyState and rewrite empty state texts and small refactoring ([#26](https://github.com/croffasia/itsaplan/issues/26)) ([cb0ca23](https://github.com/croffasia/itsaplan/commit/cb0ca238b6f2a41fa7257a059d3be9428993a7f1))
* **web:** put initiatives list tab, page and sorting in the URL ([#30](https://github.com/croffasia/itsaplan/issues/30)) ([d6595b3](https://github.com/croffasia/itsaplan/commit/d6595b3f70b8b2d0dfdeb5a7f9c0417df3b623ef))


### Bug Fixes

* **web:** batch of UI fixes for notifications, view label, due dates and initiatives ([#24](https://github.com/croffasia/itsaplan/issues/24)) ([17fdfab](https://github.com/croffasia/itsaplan/commit/17fdfaba5d3e33f78ecbffaaf010644f180f939c))
* **web:** replace raw img tags with next/image and memoize tool catalog ([#28](https://github.com/croffasia/itsaplan/issues/28)) ([21a4fc2](https://github.com/croffasia/itsaplan/commit/21a4fc2248f3a4a716794ff618bfb88c18cd5d26))


### Documentation

* update README ([#23](https://github.com/croffasia/itsaplan/issues/23)) ([6e48308](https://github.com/croffasia/itsaplan/commit/6e4830848dd2f56835b33750fb9a871be44d5cd5))

## [0.2.0](https://github.com/croffasia/itsaplan/compare/v0.1.0...v0.2.0) (2026-07-23)


### Features

* **initiatives:** server-side search, pagination and sorting ([#20](https://github.com/croffasia/itsaplan/issues/20)) ([d2ac91d](https://github.com/croffasia/itsaplan/commit/d2ac91d1c265a3ec551b3a45989324ea94187b8e))
* **notes:** add sticky-note boards ([#18](https://github.com/croffasia/itsaplan/issues/18)) ([7fe7a4a](https://github.com/croffasia/itsaplan/commit/7fe7a4a28a5527ca06ca7791e61b4757b32943da))
* **share:** add public read-only sharing for issues and views ([#21](https://github.com/croffasia/itsaplan/issues/21)) ([e7a21c5](https://github.com/croffasia/itsaplan/commit/e7a21c5766842845382e8813020b428929762a7f))
* **web:** paste and drop images into issue text ([#17](https://github.com/croffasia/itsaplan/issues/17)) ([f80be44](https://github.com/croffasia/itsaplan/commit/f80be446a71919f887582924585440b5285ab8c4))


### Bug Fixes

* **coolify:** expose service ports instead of publishing to host ([#13](https://github.com/croffasia/itsaplan/issues/13)) ([b7cd02b](https://github.com/croffasia/itsaplan/commit/b7cd02b11f469ee201c4ae2a7d60375aa7e9b245))
* **coolify:** restore configurable host ports ([#15](https://github.com/croffasia/itsaplan/issues/15)) ([1323801](https://github.com/croffasia/itsaplan/commit/132380167776e02125769895f90ae05ed3e39c15))
* **web:** align project tickers in project switcher ([#16](https://github.com/croffasia/itsaplan/issues/16)) ([d59bd41](https://github.com/croffasia/itsaplan/commit/d59bd415480a4a038f8755f9787422f9ff88ccc0))
* **web:** allow mentioning external agents in comments ([#19](https://github.com/croffasia/itsaplan/issues/19)) ([cd460ca](https://github.com/croffasia/itsaplan/commit/cd460ca82d24d6cfa60759a58c1dcecaa2cf1f87))
* **web:** hide "Hidden columns" panel when no columns are hidden ([#22](https://github.com/croffasia/itsaplan/issues/22)) ([12ae6df](https://github.com/croffasia/itsaplan/commit/12ae6df7e5dbe76968a8102525f22a3273d0e657))

## 0.1.0 (2026-07-22)


### Features

* initial commit ([110b2a9](https://github.com/croffasia/itsaplan/commit/110b2a9386caf457b1187609491e2ea6ecb1e311))


### Bug Fixes

* **ci:** run test gate without --abort-on-container-exit ([#12](https://github.com/croffasia/itsaplan/issues/12)) ([656863f](https://github.com/croffasia/itsaplan/commit/656863f04a0818b1c85b79408d23deb25264ad6a))


### Build

* **deps:** bump actions/cache from 4 to 6 ([#5](https://github.com/croffasia/itsaplan/issues/5)) ([4db83eb](https://github.com/croffasia/itsaplan/commit/4db83ebe5ede06b65701ccff58f22fb862e08731))
* **deps:** bump actions/checkout from 5 to 7 ([#3](https://github.com/croffasia/itsaplan/issues/3)) ([671e463](https://github.com/croffasia/itsaplan/commit/671e463d0a5d63868acb8efb95bcd43f7f671b8e))
* **deps:** bump amannn/action-semantic-pull-request from 5 to 6 ([#4](https://github.com/croffasia/itsaplan/issues/4)) ([ba6ace1](https://github.com/croffasia/itsaplan/commit/ba6ace110c5f0044b2d9d61ad87b7e7c652abe7e))
* **deps:** bump github/codeql-action from 3 to 4 ([#6](https://github.com/croffasia/itsaplan/issues/6)) ([6269552](https://github.com/croffasia/itsaplan/commit/626955222a8f2f650a4d57f126233211c8cbf6bc))
* **deps:** bump googleapis/release-please-action from 4 to 5 ([#2](https://github.com/croffasia/itsaplan/issues/2)) ([5bc2238](https://github.com/croffasia/itsaplan/commit/5bc223838e7780589079840eb85559ac46e4b212))
* **deps:** bump oven/bun from 1.3.9-alpine to 1.3.14-alpine in /apps/api ([#7](https://github.com/croffasia/itsaplan/issues/7)) ([110614c](https://github.com/croffasia/itsaplan/commit/110614c924b8b1e6b5e7692387eed4d063f63ddd))
* **deps:** bump oven/bun from 1.3.9-alpine to 1.3.14-alpine in /apps/bot ([#8](https://github.com/croffasia/itsaplan/issues/8)) ([0a3579f](https://github.com/croffasia/itsaplan/commit/0a3579ffbb02830d9a8dd0c3a876f00c83735e1b))
* **deps:** bump oven/bun from 1.3.9-alpine to 1.3.14-alpine in /apps/web ([#9](https://github.com/croffasia/itsaplan/issues/9)) ([ac2119f](https://github.com/croffasia/itsaplan/commit/ac2119fd8fea5ff644f4281000a0e945c5da9328))
* **deps:** bump oven/bun from 1.3.9-alpine to 1.3.14-alpine in /apps/worker ([#10](https://github.com/croffasia/itsaplan/issues/10)) ([3752de9](https://github.com/croffasia/itsaplan/commit/3752de9e8bd7fcba696ffca3f5f6f8a912ee8d98))
* **deps:** bump the npm_and_yarn group across 4 directories with 1 update ([#11](https://github.com/croffasia/itsaplan/issues/11)) ([4265cf1](https://github.com/croffasia/itsaplan/commit/4265cf1859baf173d73de2cf5a6812005f5511ff))


### Chores

* configure pre-1.0 versioning ([5459ede](https://github.com/croffasia/itsaplan/commit/5459edef997a42f01e1596a293ca2fec411d758c))
