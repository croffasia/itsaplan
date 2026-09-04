# Changelog

## [0.16.0](https://github.com/croffasia/itsaplan/compare/v0.15.0...v0.16.0) (2026-08-31)


### Features

* add email provider test ([#260](https://github.com/croffasia/itsaplan/issues/260)) ([296158b](https://github.com/croffasia/itsaplan/commit/296158b8962e24338eb0fa6b73c080ba6fc08a2a))
* add generic OIDC sign-in, SCIM 2.0 provisioning, and a password-auth switch ([#250](https://github.com/croffasia/itsaplan/issues/250)) ([c21728d](https://github.com/croffasia/itsaplan/commit/c21728d400fca1965ae65e048d49408b928e15a3))
* add Helm chart for Kubernetes deployments ([#268](https://github.com/croffasia/itsaplan/issues/268)) ([039b719](https://github.com/croffasia/itsaplan/commit/039b719cf9bcfff14c469bbfceeda823f037dfad))
* add native Git connections and development status ([#259](https://github.com/croffasia/itsaplan/issues/259)) ([f3770ec](https://github.com/croffasia/itsaplan/commit/f3770ec51d1aa02396bee7e059181e5eac8272d7))
* **agent-tools:** add Gitea tools for AI agents ([#225](https://github.com/croffasia/itsaplan/issues/225)) ([8e1afbf](https://github.com/croffasia/itsaplan/commit/8e1afbf3d837066529beb1d07c966c7d1c1b9053))
* **api:** expose checklist routes as MCP tools ([#229](https://github.com/croffasia/itsaplan/issues/229)) ([c2317f7](https://github.com/croffasia/itsaplan/commit/c2317f7dfc7527af31e225b1fbac53026796cf37))
* **api:** pass the project description to agents and cap it at 2000 characters ([#244](https://github.com/croffasia/itsaplan/issues/244)) ([7035ffc](https://github.com/croffasia/itsaplan/commit/7035ffca78d040917e57bb0fdde5ca977ce7d3c7))
* attach PDF, markdown, and text files in the agent chat ([#243](https://github.com/croffasia/itsaplan/issues/243)) ([0b6dca2](https://github.com/croffasia/itsaplan/commit/0b6dca2149e99e350e58a190865cd03d483af857))
* **god:** instance setting mcpEnabled as enabled by default ([#227](https://github.com/croffasia/itsaplan/issues/227)) ([7d680ae](https://github.com/croffasia/itsaplan/commit/7d680aeea22607e017ad39ade9ce55c94f7573dc))
* import issues from files via agent chat ([#228](https://github.com/croffasia/itsaplan/issues/228)) ([4efbdf1](https://github.com/croffasia/itsaplan/commit/4efbdf16b243ef292db64ced497ad99011a70fca))
* mark issue import rows that will be skipped and review every row ([#245](https://github.com/croffasia/itsaplan/issues/245)) ([6bd61af](https://github.com/croffasia/itsaplan/commit/6bd61af4cde36ea18006b9c6f161f3e581cc960f))
* search the agent chat history and star conversations ([#248](https://github.com/croffasia/itsaplan/issues/248)) ([6334a9c](https://github.com/croffasia/itsaplan/commit/6334a9c345f4f7c5b3b2cf240786a332e4d7ac83))
* send project invitation emails ([#261](https://github.com/croffasia/itsaplan/issues/261)) ([f47c94f](https://github.com/croffasia/itsaplan/commit/f47c94f45035cf31fc04b1af6aae7d7d7fcb07af))
* show the context size of agent chats and runs ([#241](https://github.com/croffasia/itsaplan/issues/241)) ([80694ba](https://github.com/croffasia/itsaplan/commit/80694baf8cb3f98b20fee0ef9ceb680c36e418e4))


### Improvements

* **web:** show clickable parent key on subtask cards and rows ([#231](https://github.com/croffasia/itsaplan/issues/231)) ([06b50e4](https://github.com/croffasia/itsaplan/commit/06b50e4fd5b1065f32c577d3769475ab59afe7b3))


### Bug Fixes

* **auth:** preserve a usable sign-in method ([#263](https://github.com/croffasia/itsaplan/issues/263)) ([8e2adba](https://github.com/croffasia/itsaplan/commit/8e2adba2b5f6cb3fe32fedfb8011b78fe5cc1551))
* exclude the Helm chart from Prettier ([#269](https://github.com/croffasia/itsaplan/issues/269)) ([841b9ce](https://github.com/croffasia/itsaplan/commit/841b9cedd34150301ac9538c458ad487950a7433))
* **scim:** apply group writes atomically ([#264](https://github.com/croffasia/itsaplan/issues/264)) ([54e8bdf](https://github.com/croffasia/itsaplan/commit/54e8bdfc470254df6e5d7c5d59949752dfbce778))
* **web:** avoid duplicate Tiptap link extension ([#262](https://github.com/croffasia/itsaplan/issues/262)) ([87fbf97](https://github.com/croffasia/itsaplan/commit/87fbf976c46fac881500104fb2809d3f1cf4475a))
* **web:** generate uuids without crypto.randomUUID over plain http ([#160](https://github.com/croffasia/itsaplan/issues/160)) ([0a255be](https://github.com/croffasia/itsaplan/commit/0a255bea76121724b9f2e1502baa420bd7113095))
* **web:** hide the chat history for an agent that keeps no memory ([#242](https://github.com/croffasia/itsaplan/issues/242)) ([d4a913d](https://github.com/croffasia/itsaplan/commit/d4a913d801af61bde813b36bcf85c6b1fe6a0399))
* **web:** keep relative timestamps current ([#254](https://github.com/croffasia/itsaplan/issues/254)) ([e30fac0](https://github.com/croffasia/itsaplan/commit/e30fac07d6e9cb9569acee3eec96c063ddf83dde))
* **web:** preserve activated row during history scroll restoration ([#252](https://github.com/croffasia/itsaplan/issues/252)) ([64bb58d](https://github.com/croffasia/itsaplan/commit/64bb58d74db28b745280a414b230de835f154b14))
* **web:** restore issue scroll position on browser history ([#247](https://github.com/croffasia/itsaplan/issues/247)) ([b82167a](https://github.com/croffasia/itsaplan/commit/b82167af6b390cce49fda193fa52cfb4fa58702f))
* **web:** stack dashboard widgets into two columns on narrow screens ([#232](https://github.com/croffasia/itsaplan/issues/232)) ([5932db4](https://github.com/croffasia/itsaplan/commit/5932db4ae4b055f9b1f9c25082a85061bcb0fe26))
* **web:** translate and tighten the god general settings strings ([#238](https://github.com/croffasia/itsaplan/issues/238)) ([70465b5](https://github.com/croffasia/itsaplan/commit/70465b54d826d72820ece9b2f3042b9c316e4790))


### Documentation

* rework the readme intro, features, and support sections ([#240](https://github.com/croffasia/itsaplan/issues/240)) ([a14a940](https://github.com/croffasia/itsaplan/commit/a14a940cee218d678e56150f2c13a6173f602446))
* run the Railway template from the published images ([#221](https://github.com/croffasia/itsaplan/issues/221)) ([5f19963](https://github.com/croffasia/itsaplan/commit/5f19963157260db4634999c253ac15d19dd5d6a7))


### Build

* **deps:** bump bun to 1.4.0 and node to 24-alpine ([#239](https://github.com/croffasia/itsaplan/issues/239)) ([38891c9](https://github.com/croffasia/itsaplan/commit/38891c90f8b6f0cf3dfd3e6b5a42bbc3155cb774))


### Chores

* **runner:** bump version to 0.5.0 ([#249](https://github.com/croffasia/itsaplan/issues/249)) ([184c4c1](https://github.com/croffasia/itsaplan/commit/184c4c13f446837caf01fa7fc107e80f45b404d0))

## [0.15.0](https://github.com/croffasia/itsaplan/compare/v0.14.0...v0.15.0) (2026-08-24)


### Features

* add story point and time estimates to issues ([#214](https://github.com/croffasia/itsaplan/issues/214)) ([3795e10](https://github.com/croffasia/itsaplan/commit/3795e10eb4d72bbc0c4a1b6499faf52088b6f11e))
* finish a cycle early and start the next one today ([#212](https://github.com/croffasia/itsaplan/issues/212)) ([3863a1c](https://github.com/croffasia/itsaplan/commit/3863a1c009a2cf5c26d412814c2933c7cc977961))
* log the time spent on an issue ([#216](https://github.com/croffasia/itsaplan/issues/216)) ([71d9cc7](https://github.com/croffasia/itsaplan/commit/71d9cc79f6a09ccd03d922e5a5718fdf71ac6dab))
* publish release images to GHCR and run deploys from them ([#220](https://github.com/croffasia/itsaplan/issues/220)) ([fad6d0f](https://github.com/croffasia/itsaplan/commit/fad6d0f8750c04e714cd401da5d39ea4b5eac08c))
* show the cycle history of an issue ([#211](https://github.com/croffasia/itsaplan/issues/211)) ([54594f5](https://github.com/croffasia/itsaplan/commit/54594f51f05a3e8f2156d80606ab57f83bcfa578))


### Improvements

* record the status history in its own table ([#219](https://github.com/croffasia/itsaplan/issues/219)) ([b56adbe](https://github.com/croffasia/itsaplan/commit/b56adbee131122c7ba96cb0e5d9cab2e6f13f3a4))
* **web:** clean up the shared view header ([#209](https://github.com/croffasia/itsaplan/issues/209)) ([2d215e7](https://github.com/croffasia/itsaplan/commit/2d215e78f05d138a2fa374d50e545b1230fa1a4d))
* **web:** group the issue properties into foldable blocks ([#215](https://github.com/croffasia/itsaplan/issues/215)) ([661af03](https://github.com/croffasia/itsaplan/commit/661af03348e92e81a8cac972ee8e7dbb084c9470))


### Refactoring

* move activity log entries to a JSON payload ([#213](https://github.com/croffasia/itsaplan/issues/213)) ([1feedf0](https://github.com/croffasia/itsaplan/commit/1feedf0f9d92be809204a138a2ca2132946efae5))


### Documentation

* add a paid priority feature section to README ([#218](https://github.com/croffasia/itsaplan/issues/218)) ([a97781a](https://github.com/croffasia/itsaplan/commit/a97781a7481a7470b3deaba4d49c5f28be7e329b))
* add Product Hunt strip to README ([#217](https://github.com/croffasia/itsaplan/issues/217)) ([c9430c2](https://github.com/croffasia/itsaplan/commit/c9430c257b5a9ac3b9ad81cda87fec33f25cf34a))

## [0.14.0](https://github.com/croffasia/itsaplan/compare/v0.13.0...v0.14.0) (2026-08-23)


### Features

* rework the agent chat as a right side panel with session tabs ([#204](https://github.com/croffasia/itsaplan/issues/204)) ([e1f68be](https://github.com/croffasia/itsaplan/commit/e1f68be54f40507c073d77ee7d0b6005dfcf894c))
* stop a running agent reply from the chat ([#202](https://github.com/croffasia/itsaplan/issues/202)) ([79ae3d5](https://github.com/croffasia/itsaplan/commit/79ae3d5b9fd496885ebdd7b67559e5045c492fb0))
* **web:** highlight code in agent tool output ([#199](https://github.com/croffasia/itsaplan/issues/199)) ([e43ecbd](https://github.com/croffasia/itsaplan/commit/e43ecbdfab10e54d591e4fda71c23eb6727c9f65))
* **web:** pin one column on the board layout ([#203](https://github.com/croffasia/itsaplan/issues/203)) ([23aebe1](https://github.com/croffasia/itsaplan/commit/23aebe1de7ed62a57c3b712275ee94a33035fc0f))
* **web:** queue messages typed while an agent is answering ([#200](https://github.com/croffasia/itsaplan/issues/200)) ([b480ae9](https://github.com/croffasia/itsaplan/commit/b480ae9e222949dc22f2469fe815d40459bbe4d8))


### Improvements

* **web:** use shadcn tooltips for control labels ([#207](https://github.com/croffasia/itsaplan/issues/207)) ([2fa0ea8](https://github.com/croffasia/itsaplan/commit/2fa0ea81db9d8f7f6e5223dd00fd4d0b6e2086b7))


### Bug Fixes

* draw a chart the model wrapped loosely ([#208](https://github.com/croffasia/itsaplan/issues/208)) ([104209b](https://github.com/croffasia/itsaplan/commit/104209b71f1a30d6a7eb6ed9da91df0453bf3452))
* **web:** keep the full-page top bar visible while scrolling ([#205](https://github.com/croffasia/itsaplan/issues/205)) ([43d9cfe](https://github.com/croffasia/itsaplan/commit/43d9cfe93136e98aab194dab0aadd9b3efaf0a21))


### Refactoring

* **api:** move every remaining feature to the modules/ layout ([#197](https://github.com/croffasia/itsaplan/issues/197)) ([bf46c5b](https://github.com/croffasia/itsaplan/commit/bf46c5b9c62e3716c163f95672cb4730bcc0a59f))


### Chores

* **runner:** release 0.4.0 ([#206](https://github.com/croffasia/itsaplan/issues/206)) ([86ba5fd](https://github.com/croffasia/itsaplan/commit/86ba5fd9c72dc7a0bf12ea03ac87f621192efd31))

## [0.13.0](https://github.com/croffasia/itsaplan/compare/v0.12.0...v0.13.0) (2026-08-22)


### Features

* accept pull request webhooks from GitLab, Gitea, Forgejo, and Bitbucket ([#188](https://github.com/croffasia/itsaplan/issues/188)) ([682f301](https://github.com/croffasia/itsaplan/commit/682f30156eef41e1dca51b953b41c75cd7fbfb29))
* add a member custom field that can trigger an agent ([#191](https://github.com/croffasia/itsaplan/issues/191)) ([ef788e6](https://github.com/croffasia/itsaplan/commit/ef788e63458eccaa04141d6522d46f6f195039c0))
* add an Antigravity preset and resume Copilot sessions ([#195](https://github.com/croffasia/itsaplan/issues/195)) ([eb6b00c](https://github.com/croffasia/itsaplan/commit/eb6b00c0733e79d14e5a6e4a700d86c4719b1837))
* **agent-tools:** add Notion integration with page and comment tools ([#181](https://github.com/croffasia/itsaplan/issues/181)) ([566fb7c](https://github.com/croffasia/itsaplan/commit/566fb7c9616f6e8e5ce6283eae9cba078746a5ce))
* auto-assign issues entering a state to a chosen member ([#183](https://github.com/croffasia/itsaplan/issues/183)) ([6f34ead](https://github.com/croffasia/itsaplan/commit/6f34ead936bbf4265e3a9c9b66d836ff96525c60))
* let agents draw charts in the chat ([#187](https://github.com/croffasia/itsaplan/issues/187)) ([a9df467](https://github.com/croffasia/itsaplan/commit/a9df467c6d0f998cffa45bba64bc4fb949b43645))
* **runner:** serve several agents from one runner ([#193](https://github.com/croffasia/itsaplan/issues/193)) ([0b969ee](https://github.com/croffasia/itsaplan/commit/0b969ee5e4a4fe0b7a2aeb4daac4254b6950a0ef))


### Improvements

* **web:** select several tools at once when adding tools ([#186](https://github.com/croffasia/itsaplan/issues/186)) ([5f95ca1](https://github.com/croffasia/itsaplan/commit/5f95ca1c9951c9cdb391da134387421fd1771b07))
* **web:** submit the new issue dialog with Enter ([#189](https://github.com/croffasia/itsaplan/issues/189)) ([806b5bb](https://github.com/croffasia/itsaplan/commit/806b5bb84d36271fbf4787b06f90908e99f795cd))
* **worker:** widen the daily telemetry snapshot ([#190](https://github.com/croffasia/itsaplan/issues/190)) ([afde4bb](https://github.com/croffasia/itsaplan/commit/afde4bb281d0cfefdccb5db76ee6129c6a1d6700))


### Bug Fixes

* **web:** apply link and subtask display settings on initiative and cycle boards ([#196](https://github.com/croffasia/itsaplan/issues/196)) ([e264ed0](https://github.com/croffasia/itsaplan/commit/e264ed093b5cc0d912a370fc3dc8b8b4f6bba1ab))
* **web:** open links in agent chat in a new tab ([#184](https://github.com/croffasia/itsaplan/issues/184)) ([02fb622](https://github.com/croffasia/itsaplan/commit/02fb62264eb196cb399c19421e47a50a497e9015))
* **web:** sign out and redirect to login on an expired session ([#185](https://github.com/croffasia/itsaplan/issues/185)) ([5a4c989](https://github.com/croffasia/itsaplan/commit/5a4c9893edecb9d8fdbdc17f45d2f87e6444a811))


### Documentation

* refresh the readme feature list ([#192](https://github.com/croffasia/itsaplan/issues/192)) ([73dc94e](https://github.com/croffasia/itsaplan/commit/73dc94e0ad1ad7a7314cfb9442a5926bb8024a5c))

## [0.12.0](https://github.com/croffasia/itsaplan/compare/v0.11.0...v0.12.0) (2026-08-20)


### Features

* add usernames and let sign-in accept one ([#179](https://github.com/croffasia/itsaplan/issues/179)) ([7784ae1](https://github.com/croffasia/itsaplan/commit/7784ae1fffe7316bd4f0049a2a4fe1db4c67a47f))
* log on the issue when an agent picks up its run and when it ends ([#169](https://github.com/croffasia/itsaplan/issues/169)) ([046cc49](https://github.com/croffasia/itsaplan/commit/046cc4947caf4bfa13fb3327488b0390fd1abe04))
* mention people and agents by [@username](https://github.com/username) ([#180](https://github.com/croffasia/itsaplan/issues/180)) ([e0e8be6](https://github.com/croffasia/itsaplan/commit/e0e8be635bb1a4407afd4aefa0eb552a8d3b747b))
* reply to comments in an issue thread ([#177](https://github.com/croffasia/itsaplan/issues/177)) ([20eccc5](https://github.com/croffasia/itsaplan/commit/20eccc54ab6f25f78e184454f6a8779f29c7499f))
* **web:** tables in markdown ([#166](https://github.com/croffasia/itsaplan/issues/166)) ([391efdc](https://github.com/croffasia/itsaplan/commit/391efdcfdab40bb2ffb084ee66ec0e007f0d1983))
* **web:** write agent instructions in the markdown editor ([#164](https://github.com/croffasia/itsaplan/issues/164)) ([dbb5f13](https://github.com/croffasia/itsaplan/commit/dbb5f1398c8c7c0a66af5e341ceb33c42568c64c))


### Improvements

* rework the agent create and edit form ([#171](https://github.com/croffasia/itsaplan/issues/171)) ([308b046](https://github.com/croffasia/itsaplan/commit/308b046236f570d374bdeabe7fd09f88eea72139))
* **web:** group people and AI agents in the members list ([#172](https://github.com/croffasia/itsaplan/issues/172)) ([13344e6](https://github.com/croffasia/itsaplan/commit/13344e6f49e2ce6441c781a939613aee616bdb6a))
* **web:** keep issue properties inside their width and make the sidebar resizable ([#178](https://github.com/croffasia/itsaplan/issues/178)) ([ac3a65f](https://github.com/croffasia/itsaplan/commit/ac3a65f9422ac96e6b3f086cd824b6e77ceede46))
* **web:** manage an external agent's API key in its form ([#168](https://github.com/croffasia/itsaplan/issues/168)) ([4610626](https://github.com/croffasia/itsaplan/commit/4610626658e2408026a0918a4731c84b8d826c4a))
* **web:** show the last comment as a bubble while the feed is off screen ([#174](https://github.com/croffasia/itsaplan/issues/174)) ([2f570fa](https://github.com/croffasia/itsaplan/commit/2f570fa499ac901116aee7e86907ec3cc954651d))


### Bug Fixes

* keep the dashboards page working when a stored layout is not a widget list ([#173](https://github.com/croffasia/itsaplan/issues/173)) ([1f25b67](https://github.com/croffasia/itsaplan/commit/1f25b675a1a4c4240a4cf8f2aa0b1664444a11ca))


### Refactoring

* **api:** restructure the api into feature modules (part 2) ([#167](https://github.com/croffasia/itsaplan/issues/167)) ([63d2f9c](https://github.com/croffasia/itsaplan/commit/63d2f9caed4fc05633a73080bf721b027b818398))


### Documentation

* make the individual the copyright holder and the Project Owner ([#175](https://github.com/croffasia/itsaplan/issues/175)) ([8cce23f](https://github.com/croffasia/itsaplan/commit/8cce23ffcb1a7659a53c557803ff7b9657839d2d))


### Chores

* **runner:** release 0.2.1 ([#176](https://github.com/croffasia/itsaplan/issues/176)) ([d3adf83](https://github.com/croffasia/itsaplan/commit/d3adf83cedbafbc2d9ce6d77d6a2fc4d91cc8024))

## [0.11.0](https://github.com/croffasia/itsaplan/compare/v0.10.1...v0.11.0) (2026-08-18)


### Features

* add Arabic language support with RTL layout ([#150](https://github.com/croffasia/itsaplan/issues/150)) ([6a4bec3](https://github.com/croffasia/itsaplan/commit/6a4bec32eda4bde574a1bb965c64411e834bab46))
* chat with an external agent ([#163](https://github.com/croffasia/itsaplan/issues/163)) ([327f939](https://github.com/croffasia/itsaplan/commit/327f939edc7c10be275d4d8d43572ecf9048ea9a))
* end pending runs of an agent schedule ([#157](https://github.com/croffasia/itsaplan/issues/157)) ([cc0469c](https://github.com/croffasia/itsaplan/commit/cc0469c8969fc79d494e5a90ccb5009dcc565be7))
* **web:** prefill new issue from the active view filters ([#156](https://github.com/croffasia/itsaplan/issues/156)) ([f4bb080](https://github.com/croffasia/itsaplan/commit/f4bb08037b49f19ba06791d9628a12b663d358b6))


### Bug Fixes

* **web:** mirror the issue detail sidebar and header for right-to-left ([#155](https://github.com/croffasia/itsaplan/issues/155)) ([ddaad03](https://github.com/croffasia/itsaplan/commit/ddaad0311b2409c8663a6fab7184ef24159c9518))


### Documentation

* add the Railway deploy guide and button ([#153](https://github.com/croffasia/itsaplan/issues/153)) ([208935f](https://github.com/croffasia/itsaplan/commit/208935f929b7d7a96e4834bc6aadf80e787390c3))
* **api:** describe the system and internal endpoints in the OpenAPI docs ([#158](https://github.com/croffasia/itsaplan/issues/158)) ([685ae6a](https://github.com/croffasia/itsaplan/commit/685ae6a7f8d6c58ec839d70f4b4b6e076b0ac487))

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
