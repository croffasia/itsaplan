# Changelog

## [0.10.1](https://github.com/croffasia/itsaplan/compare/v0.10.0...v0.10.1) (2026-08-14)


### Bug Fixes

* support deploying outside the compose stack ([#151](https://github.com/croffasia/itsaplan/issues/151)) ([6245e8d](https://github.com/croffasia/itsaplan/commit/6245e8d48820d44afaef0b75deb24f48ec6f7454))

## [0.10.0](https://github.com/croffasia/itsaplan/compare/v0.9.0...v0.10.0) (2026-08-14)


### Features

* add datetime custom fields and calendar placement by date fields ([#139](https://github.com/croffasia/itsaplan/issues/139)) ([0f0eb72](https://github.com/croffasia/itsaplan/commit/0f0eb7206c91d10b06d7405223d941e664ea4e50))
* add per-user favorites for saved views ([#132](https://github.com/croffasia/itsaplan/issues/132)) ([ec1827f](https://github.com/croffasia/itsaplan/commit/ec1827f0c51ceaa529d08631b5af101a9ccd3fb2))
* add WIP limits to board columns ([#146](https://github.com/croffasia/itsaplan/issues/146)) ([3f5cb37](https://github.com/croffasia/itsaplan/commit/3f5cb37b80521195c49db933fcf64b5c0ddc5a1c))
* filter issues by cycle and initiative ([#140](https://github.com/croffasia/itsaplan/issues/140)) ([a4d574d](https://github.com/croffasia/itsaplan/commit/a4d574d34e1c3504281facda5e23504e08f5b5a4))
* run external agents on your own machine ([#147](https://github.com/croffasia/itsaplan/issues/147)) ([b86eda5](https://github.com/croffasia/itsaplan/commit/b86eda51888267298a2f64364bb98200cd4d2366))
* **web:** add a second grouping level to the timeline ([#137](https://github.com/croffasia/itsaplan/issues/137)) ([353af73](https://github.com/croffasia/itsaplan/commit/353af732259ef87abeedeb8b8b2edf3e85fe4996))
* **web:** add H1 and H2 buttons to the description editor menu ([#143](https://github.com/croffasia/itsaplan/issues/143)) ([58d304c](https://github.com/croffasia/itsaplan/commit/58d304c52d979e18543b4d9a700627535a4fec72))
* **web:** add Russian (ru) UI translations ([#131](https://github.com/croffasia/itsaplan/issues/131)) ([e31175b](https://github.com/croffasia/itsaplan/commit/e31175bee905f50cd54da41dd81cf332eb6c1612))
* **web:** add Simplified Chinese (zh-CN) UI translations ([#130](https://github.com/croffasia/itsaplan/issues/130)) ([d3e54d1](https://github.com/croffasia/itsaplan/commit/d3e54d143b8c954e77ad717dc56b2dcb8e6b2521))
* **web:** drag timeline rows between groups and reorder them ([#141](https://github.com/croffasia/itsaplan/issues/141)) ([3d31551](https://github.com/croffasia/itsaplan/commit/3d315512a5b2614d8f0b80f14b53bebdcfd5bbb7))


### Improvements

* order cycle and initiative groups by status ([#136](https://github.com/croffasia/itsaplan/issues/136)) ([6c6bd08](https://github.com/croffasia/itsaplan/commit/6c6bd087f79b950d11165b8c949a60e75453e035))


### Bug Fixes

* select the default language from the user's locale ([#144](https://github.com/croffasia/itsaplan/issues/144)) ([a337192](https://github.com/croffasia/itsaplan/commit/a337192e43152b99dd4c58ee3d60d40d9330266b))
* **web:** center integration name vertically in the credentials list ([#142](https://github.com/croffasia/itsaplan/issues/142)) ([afe908b](https://github.com/croffasia/itsaplan/commit/afe908b3b94b43f78f068466f9cdcb3ac973786d))
* **web:** localize dates to the interface language ([#133](https://github.com/croffasia/itsaplan/issues/133)) ([74ad1d0](https://github.com/croffasia/itsaplan/commit/74ad1d007fb003c20cedf227fe955119e4674d00))


### Refactoring

* **api:** drop the server-side cache of the update check ([#128](https://github.com/croffasia/itsaplan/issues/128)) ([009ffc8](https://github.com/croffasia/itsaplan/commit/009ffc84f93023a4ca12e8a1e8c1eb6120a73cd0))
* **api:** restructure the api into feature modules (part 1) ([#138](https://github.com/croffasia/itsaplan/issues/138)) ([4aff469](https://github.com/croffasia/itsaplan/commit/4aff469e1ac0dca0d274f4f74b3548a2a882a059))


### Build

* **web:** lint translation files for missing keys across locales ([#148](https://github.com/croffasia/itsaplan/issues/148)) ([817645d](https://github.com/croffasia/itsaplan/commit/817645d2ee2e7f893d8c867150665414868830c4))


### CI

* show chore and test commits in the changelog ([#135](https://github.com/croffasia/itsaplan/issues/135)) ([a33936a](https://github.com/croffasia/itsaplan/commit/a33936a4384a9abd1b2affe56c0698946743cd6b))


### Chores

* update dependencies across the workspace ([#134](https://github.com/croffasia/itsaplan/issues/134)) ([eafba30](https://github.com/croffasia/itsaplan/commit/eafba308481f74c688cddec72b9dc297e82a87d7))
* **web:** let prettier ignore the generated next-env.d.ts ([#149](https://github.com/croffasia/itsaplan/issues/149)) ([22acf61](https://github.com/croffasia/itsaplan/commit/22acf61a49231003e1db3f94dfe405969d10fd7c))

## [0.9.0](https://github.com/croffasia/itsaplan/compare/v0.8.0...v0.9.0) (2026-08-12)


### Features

* close issues from merged GitHub pull requests ([#120](https://github.com/croffasia/itsaplan/issues/120)) ([48f4d0e](https://github.com/croffasia/itsaplan/commit/48f4d0eeee5c311ab2f26fa19ee46f74255aac6b))
* single revision engine behind live refresh ([#119](https://github.com/croffasia/itsaplan/issues/119)) ([51eb888](https://github.com/croffasia/itsaplan/commit/51eb888c3d7d97608506a3584bb22e3378667d31))
* **web:** localize UI with en/uk support ([#123](https://github.com/croffasia/itsaplan/issues/123)) ([bf3beaf](https://github.com/croffasia/itsaplan/commit/bf3beaffd659326affcdaf8e89ef5b77db147c3f))
* **web:** move the whole selection when a selected card is dragged ([#112](https://github.com/croffasia/itsaplan/issues/112)) ([46b388b](https://github.com/croffasia/itsaplan/commit/46b388b2327bca2462b24c0e444e0a490fc9c425))
* **web:** resizable table columns persisted per view scope ([#116](https://github.com/croffasia/itsaplan/issues/116)) ([0f11119](https://github.com/croffasia/itsaplan/commit/0f111199af288e98c65d4c8acc806afc8b69a9d4))


### Improvements

* **web:** add loading skeletons across the app ([#118](https://github.com/croffasia/itsaplan/issues/118)) ([ec90f0d](https://github.com/croffasia/itsaplan/commit/ec90f0dd06482e256e4c40d67037054508a17a29))
* **web:** split subtask display into separate cards and nested rows ([#109](https://github.com/croffasia/itsaplan/issues/109)) ([43c69fb](https://github.com/croffasia/itsaplan/commit/43c69fbc98d6ad188f9583f75f861b4acd932b29))
* **web:** switch to upstream Inter and enable disambiguating glyphs ([#107](https://github.com/croffasia/itsaplan/issues/107)) ([1648687](https://github.com/croffasia/itsaplan/commit/16486873640bc202cf7c5717aebae09c07560c53))


### Bug Fixes

* decouple issue pickers and agent forms from resource permissions ([#121](https://github.com/croffasia/itsaplan/issues/121)) ([bddbea5](https://github.com/croffasia/itsaplan/commit/bddbea5d1cf6dee8de49a060940bb77700fbc3e8))

## [0.8.0](https://github.com/croffasia/itsaplan/compare/v0.7.0...v0.8.0) (2026-08-07)


### Features

* sync subtask and parent closing, move archive into workflow configuration ([#103](https://github.com/croffasia/itsaplan/issues/103)) ([e93fc89](https://github.com/croffasia/itsaplan/commit/e93fc89730e63d7751faebea54ea5965e9561f50))
* toggle issue stats, checklists and subtasks per project ([#105](https://github.com/croffasia/itsaplan/issues/105)) ([bb7fcbf](https://github.com/croffasia/itsaplan/commit/bb7fcbfbfc5a2a8a28ad7cb28afec155a0b328cb))
* **web:** add kanban column surface and rebalance dark theme ([#104](https://github.com/croffasia/itsaplan/issues/104)) ([ef56f0d](https://github.com/croffasia/itsaplan/commit/ef56f0d2742444ef612b4b3799d723d592ef3ca4))
* **web:** paste files into an issue without focusing the editor ([#102](https://github.com/croffasia/itsaplan/issues/102)) ([f98b157](https://github.com/croffasia/itsaplan/commit/f98b157bdfb9b9163e07be10f5463a5afdf381bf))


### Bug Fixes

* **web:** show parent in subtask breadcrumb, close panel on navigation ([#101](https://github.com/croffasia/itsaplan/issues/101)) ([0f0a6f6](https://github.com/croffasia/itsaplan/commit/0f0a6f66bf1da275a1756a445f6d29cf6d274cad))


### CI

* define version bump rules and add the improvement commit type ([#106](https://github.com/croffasia/itsaplan/issues/106)) ([a49c8ef](https://github.com/croffasia/itsaplan/commit/a49c8ef3b11919ae6b902f962f98d51cf8eb63ca))
* stop the CLA action locking the release pull request ([#99](https://github.com/croffasia/itsaplan/issues/99)) ([cc29b8f](https://github.com/croffasia/itsaplan/commit/cc29b8f5ea7819fb4bfa5cc21c659a03088f70d3))

## [0.7.0](https://github.com/croffasia/itsaplan/compare/v0.6.0...v0.7.0) (2026-08-06)


### Features

* add an extended mode to issue and board sharing ([#97](https://github.com/croffasia/itsaplan/issues/97)) ([807718e](https://github.com/croffasia/itsaplan/commit/807718e87d3b68425e67aef2f57daa169ec26e96))
* add checklists to board cards ([#96](https://github.com/croffasia/itsaplan/issues/96)) ([4fc44c9](https://github.com/croffasia/itsaplan/commit/4fc44c9dbe89e092eac60b54173f69cec9233cbf))
* add cycles (sprints) ([#98](https://github.com/croffasia/itsaplan/issues/98)) ([82d2b78](https://github.com/croffasia/itsaplan/commit/82d2b7847b40599d8c74fc2f449dea28df349df6))
* name both states in a status-change notification ([#89](https://github.com/croffasia/itsaplan/issues/89)) ([26b8cbf](https://github.com/croffasia/itsaplan/commit/26b8cbf5fd96428c42c98c3e0c0e347e2a661fe4))
* **web:** color priority icons by priority and name them in the table ([#93](https://github.com/croffasia/itsaplan/issues/93)) ([7e13c13](https://github.com/croffasia/itsaplan/commit/7e13c139f13c867cd84d02f5fc0f858397257801))
* **web:** create a linked issue from the links panel and mark blocked ones ([#92](https://github.com/croffasia/itsaplan/issues/92)) ([77ecfb1](https://github.com/croffasia/itsaplan/commit/77ecfb1f1673f7f533ccbca4ed4fc3f0b44d5082))


### Bug Fixes

* **web:** fit the header, initiatives and inbox on a mobile screen ([#90](https://github.com/croffasia/itsaplan/issues/90)) ([fecce5f](https://github.com/croffasia/itsaplan/commit/fecce5ff1af7cc66b48dba7a2670635a857a422f))
* **web:** give the kanban add button the same gap as the cards ([#87](https://github.com/croffasia/itsaplan/issues/87)) ([ca0984d](https://github.com/croffasia/itsaplan/commit/ca0984d980c85878c275741710786c3dd734781c))
* **web:** increase the markdown line height and block spacing ([#91](https://github.com/croffasia/itsaplan/issues/91)) ([651fd09](https://github.com/croffasia/itsaplan/commit/651fd09469a0a4271a0228e9db82e3b4542f7eca))
* **web:** reach every new issue body section from a dropdown ([#85](https://github.com/croffasia/itsaplan/issues/85)) ([1d13b6d](https://github.com/croffasia/itsaplan/commit/1d13b6dbb8e96f592417a580cbeb20ae7b02a828))
* **web:** reorder the issue properties rows ([#88](https://github.com/croffasia/itsaplan/issues/88)) ([7a5f8fb](https://github.com/croffasia/itsaplan/commit/7a5f8fb3bcfe5d81c26ecc291598625ea23ba89b))
* **web:** tighten the MCP server page copy and layout ([#95](https://github.com/croffasia/itsaplan/issues/95)) ([c861a41](https://github.com/croffasia/itsaplan/commit/c861a410afca6a4a816e3ea6b2857346117fd58d))


### CI

* move the release branch in its own job ([#84](https://github.com/croffasia/itsaplan/issues/84)) ([ccef872](https://github.com/croffasia/itsaplan/commit/ccef8723f0878cf9d81e2b2a8d55c682ebba90c4))

## [0.6.0](https://github.com/croffasia/itsaplan/compare/v0.5.0...v0.6.0) (2026-08-03)


### Features

* add a grouped issue activity log with an account preference ([#69](https://github.com/croffasia/itsaplan/issues/69)) ([887957e](https://github.com/croffasia/itsaplan/commit/887957e59aa35939723a1cbb2910629a7c2a664b))
* annotate image attachments and rework the issue detail sections ([#79](https://github.com/croffasia/itsaplan/issues/79)) ([e614f46](https://github.com/croffasia/itsaplan/commit/e614f467484e26692c5bd35f7ca1970d796308b2))
* break an issue into subtasks ([#83](https://github.com/croffasia/itsaplan/issues/83)) ([ba3c352](https://github.com/croffasia/itsaplan/commit/ba3c352d24a263ad6ada3144505e075a7664eaff))
* link issues as blocking, related or duplicate ([#75](https://github.com/croffasia/itsaplan/issues/75)) ([7815173](https://github.com/croffasia/itsaplan/commit/7815173f99c3af0f5e19077a5dc8f680ec1850ac))
* read quick actions without the actions permission ([#80](https://github.com/croffasia/itsaplan/issues/80)) ([c1a3cbc](https://github.com/croffasia/itsaplan/commit/c1a3cbc6e8c1eb3d775858a4f04537b9420b6588))
* watch issues to get their notifications ([#78](https://github.com/croffasia/itsaplan/issues/78)) ([c64c43a](https://github.com/croffasia/itsaplan/commit/c64c43a50ddbaaf5684649e5afd566953e73778c))
* **web:** add a section rail to account preferences ([#71](https://github.com/croffasia/itsaplan/issues/71)) ([7721184](https://github.com/croffasia/itsaplan/commit/77211845cf26e80f50d6a26467fef652b015d7ca))
* **web:** rework the new issue dialog body and footer ([#76](https://github.com/croffasia/itsaplan/issues/76)) ([09497fa](https://github.com/croffasia/itsaplan/commit/09497fa65a7d5b4ce8a1bd79defebe33788cff2a))


### Bug Fixes

* **api:** source the release history from the releases feed ([#74](https://github.com/croffasia/itsaplan/issues/74)) ([62fb86e](https://github.com/croffasia/itsaplan/commit/62fb86eb5d072969b212fca0daa48ead074ac816))
* gate the archive settings section by its own permission ([#81](https://github.com/croffasia/itsaplan/issues/81)) ([09c0e90](https://github.com/croffasia/itsaplan/commit/09c0e90b881166ae00ce774a9de726832b451fa5))
* **web:** raise text contrast and set line-height tokens ([#72](https://github.com/croffasia/itsaplan/issues/72)) ([58779e4](https://github.com/croffasia/itsaplan/commit/58779e43279571ab452535719b8d12b7895cc600))
* **web:** render the issue detail read-only without work_items.edit ([#82](https://github.com/croffasia/itsaplan/issues/82)) ([913dcdd](https://github.com/croffasia/itsaplan/commit/913dcdd69afcf0b1368093912ce9fbb0f202ca15))
* **web:** restore modal body scrolling ([#70](https://github.com/croffasia/itsaplan/issues/70)) ([31d471d](https://github.com/croffasia/itsaplan/commit/31d471d89a8a7c5efce80261c9b248d72b2fc012))
* **web:** stack issue page properties below xl ([#73](https://github.com/croffasia/itsaplan/issues/73)) ([30a937a](https://github.com/croffasia/itsaplan/commit/30a937a600aa3cb37311dfaa4c19c86a25d40b90))
* **web:** wrap the issue title instead of truncating it ([#77](https://github.com/croffasia/itsaplan/issues/77)) ([bab013d](https://github.com/croffasia/itsaplan/commit/bab013ddc94bcf9534cea99dcce75f3be9e18711))


### Documentation

* split install instructions out of the readme ([#67](https://github.com/croffasia/itsaplan/issues/67)) ([16edd51](https://github.com/croffasia/itsaplan/commit/16edd51badf62e4d8e8124f4df863b9d724e92a9))


### CI

* fetch full history before moving the release branch ([#65](https://github.com/croffasia/itsaplan/issues/65)) ([e91bae9](https://github.com/croffasia/itsaplan/commit/e91bae9bb2553dcfb7305c13a2998f646489cc55))

## [0.5.0](https://github.com/croffasia/itsaplan/compare/v0.4.0...v0.5.0) (2026-07-30)


### Features

* **api:** expose the agent skill library over MCP ([#58](https://github.com/croffasia/itsaplan/issues/58)) ([80cf2b1](https://github.com/croffasia/itsaplan/commit/80cf2b12be5187a255603c32bb729ce52080ba0e))
* **api:** give agents the note board actions ([#48](https://github.com/croffasia/itsaplan/issues/48)) ([3b11a0d](https://github.com/croffasia/itsaplan/commit/3b11a0d59e117f3d62ee491d3f966f172cf9de90))
* **api:** manage agent schedules over MCP ([#61](https://github.com/croffasia/itsaplan/issues/61)) ([3d635ac](https://github.com/croffasia/itsaplan/commit/3d635acd332af6257dd1c6d3468f844f25a24a8a))
* **api:** manage internal agents fully over MCP ([#59](https://github.com/croffasia/itsaplan/issues/59)) ([6cb16bc](https://github.com/croffasia/itsaplan/commit/6cb16bca2af3aaf969fea193f525418d451263d2))
* gate note boards by permissions and record the board creator ([#49](https://github.com/croffasia/itsaplan/issues/49)) ([cfe5dba](https://github.com/croffasia/itsaplan/commit/cfe5dba0692da8577359d2459c9ef52018bcd7f7))
* require a signed CLA from contributors ([#64](https://github.com/croffasia/itsaplan/issues/64)) ([4b53081](https://github.com/croffasia/itsaplan/commit/4b53081e47b9ce39015f437d3915e9f3aa32fe6f))
* share a private note board with picked members ([#50](https://github.com/croffasia/itsaplan/issues/50)) ([de33870](https://github.com/croffasia/itsaplan/commit/de338700eb8e2595a4ae55553b913b4f7ed48034))
* **web:** attach files in the new issue modal ([#52](https://github.com/croffasia/itsaplan/issues/52)) ([fc3769e](https://github.com/croffasia/itsaplan/commit/fc3769ec3e4ba360c7f18f594b6ab4507b29f850))
* **web:** convert a sticky note into an issue ([#47](https://github.com/croffasia/itsaplan/issues/47)) ([2b72f54](https://github.com/croffasia/itsaplan/commit/2b72f540dd00c3c2d3d80a0db04ad70b11b9d2fd))
* **web:** expand the new issue modal to fullscreen ([#51](https://github.com/croffasia/itsaplan/issues/51)) ([6fcf05d](https://github.com/croffasia/itsaplan/commit/6fcf05dd21502c307691ec7bcb185187053f87e9))
* **web:** move AI configuration into the AI Team sidebar group ([#63](https://github.com/croffasia/itsaplan/issues/63)) ([32a1a96](https://github.com/croffasia/itsaplan/commit/32a1a9631d16e5bc91c73dee250c1fac17d336f0))
* **web:** reorder the initiative tabs and open the first non-empty one ([#56](https://github.com/croffasia/itsaplan/issues/56)) ([a333388](https://github.com/croffasia/itsaplan/commit/a333388b7208459443fdb1ccf35b76a1ec9f1af1))
* **web:** show the member in the description dialog and shorten its question ([#57](https://github.com/croffasia/itsaplan/issues/57)) ([6620673](https://github.com/croffasia/itsaplan/commit/6620673b7c1612178aa0056b4129905bb5994367))


### Bug Fixes

* add healthchecks to the deployed services ([#46](https://github.com/croffasia/itsaplan/issues/46)) ([c78694a](https://github.com/croffasia/itsaplan/commit/c78694a6c72acf7c38c285fd97c8bdf9a4a778a9))
* **api:** validate an agent's model credential belongs to the project ([#60](https://github.com/croffasia/itsaplan/issues/60)) ([446ff35](https://github.com/croffasia/itsaplan/commit/446ff359ef33a07e68d877bbaf300d964368619b))
* delete an agent schedule's runs with it ([#62](https://github.com/croffasia/itsaplan/issues/62)) ([c8d7d86](https://github.com/croffasia/itsaplan/commit/c8d7d86624a9d6b62a80acd8f997729c1ec44515))
* **web:** use the shadcn calendar in the filter bar date editor ([#53](https://github.com/croffasia/itsaplan/issues/53)) ([1b41119](https://github.com/croffasia/itsaplan/commit/1b41119c72fa8dd63a0a19fe0cb5f0e8aff6c305))


### CI

* push the release branch by its full refname ([#44](https://github.com/croffasia/itsaplan/issues/44)) ([e180e6d](https://github.com/croffasia/itsaplan/commit/e180e6d19326d8f7c31fb03c035002ccda0f3a48))

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
