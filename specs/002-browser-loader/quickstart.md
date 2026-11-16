# Quickstart: validating the browser bundle and loader

Run after implementation. Inputs and results are in [data-model.md](data-model.md) and [contracts/loader.md](contracts/loader.md).

## Prerequisites

Node 22 and `npm install`. For the live check, network access to `https://content-api-test.onrender.com` (it may take a while to wake).

## 1. Checks and tests

```sh
npm run lint && npm run typecheck && npm test
```

Expected: all pass; the 001 tests are unchanged and still pass (SC-006); the jsdom test loads the built `dist/content-sdk.js` (Jest builds it first).

## 2. Build outputs

```sh
npm run build
ls dist
```

Expected: `content-sdk.js`, `content-sdk.js.map`, `index.mjs`, `index.cjs`, `index.d.ts` (and its parts). The browser file is one line of minified script ending in a `sourceMappingURL` comment. Check it makes only one global:

```sh
node -e "const vm=require('vm');const c={document:{currentScript:{getAttribute:()=>null}},console:{warn(){}}};c.window=c;vm.createContext(c);vm.runInContext(require('fs').readFileSync('dist/content-sdk.js','utf8'),c);console.log(Object.keys(c).sort().join(','))"
```

Expected: only the names set up above plus `contentSdk`.

## 3. The path and the library entries

```sh
node -e "console.log(require.resolve('content-sdk/browser'))"   # works inside this repository too (a package may name itself once it has `exports`)
node -e "console.log(typeof require('./dist/index.cjs').fetchPage)"   # function
```

## 4. Install from the repository

```sh
# use the session scratchpad directory, not /tmp
mkdir <scratchpad>/consumer && cd <scratchpad>/consumer && npm init -y
npm install git+file:///Users/tsega/Documents/Git/content-sdk#<branch-or-tag>
node -e "console.log(require.resolve('content-sdk/browser'))"
ls node_modules/content-sdk/dist
node -e "import('content-sdk').then(m=>console.log(typeof m.fetchPage))"
```

Expected: the install runs `prepare` (a build log appears), the path resolves to `dist/content-sdk.js`, `dist/` holds the built files, and the library import still gives `function`. Use a scratch directory, and delete it afterwards. `npm pack --dry-run` in the repository must list `dist/content-sdk.js` and `dist/content-sdk.js.map`.

## 5. A page with the stub (manual, hosted test service)

Save as `page.html` next to `dist/content-sdk.js` and open it from a server whose origin the platform allows (`https://listings-test-nine.vercel.app`; the owner decides how):

```html
<script>window.contentSdk = window.contentSdk || { q: [] };
window.contentSdk.q.push(["fetchPage", "latest", { limit: 3 }, (r) => console.log("queued", r)]);</script>
<script async src="/content-sdk.js"
        data-api-base-url="https://content-api-test.onrender.com" data-platform-id="listings"></script>
<script>setTimeout(() => window.contentSdk.fetchPage("latest", { limit: 3 }).then((r) => console.log("after", r)), 3000);</script>
```

Expected in the console: `queued` and `after` both show `{ ok: true, page: {...} }` with at most 3 items. Remove `data-platform-id` and reload: one warning, no requests (SC-007, SC-003).
