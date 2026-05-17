# Flow

Two things live in this repo:

```
.
├── packages/
│   └── flow/        # the npm package — @retry-labs/flow
└── website/         # the GitHub Pages site (retry-labs.github.io/flow/)
```

## Library — `packages/flow/`

Zero-dependency SVG diagram renderer published as
[`@retry-labs/flow`](https://www.npmjs.com/package/@retry-labs/flow). Source,
build config, and tests are all self-contained in that folder. See
`packages/flow/README.md` for the library docs and
`packages/flow/AGENTS.md` for build commands.

```bash
cd packages/flow
npm install
npm run build      # → dist/
npm test
```

Public surface (after building / installing the package):
- ESM/CJS imports: `import { mount, parseDSL, RLFlow } from '@retry-labs/flow'`
- Standalone bundle (no React): `dist/flow.standalone.js` → exposes `window.RLFlow` and the `<rl-flow>` custom element.

## Website — `website/`

The static site published to GitHub Pages. Each HTML page loads the library
via `./dist/flow.standalone.js`, so the bundle must be staged into
`website/dist/` before the site will work standalone.

**Locally:**

```bash
cd packages/flow
npm run build
npm run stage:site     # copies the standalone bundle into ../../website/dist/
```

Then open `website/index.html` directly, or serve `website/` with any static
server.

**On deploy:** `.github/workflows/deploy.yml` builds the library, copies the
standalone bundle into `website/dist/`, and uploads `website/` as the Pages
artifact. `website/dist/` is gitignored — the workflow regenerates it.

## Publishing

From `packages/flow/`:

```bash
npm test               # all 7 suites must pass
npm run build          # regenerate dist/
npm publish            # publishConfig already pins --access public for the scoped name
```
