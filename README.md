# Sabbir Hossain Rafat — Portfolio

A responsive portfolio built with semantic HTML, modular CSS, and native JavaScript modules. It has no client-side package dependencies. The Vercel deployment includes one serverless function for securely fetching GitHub contribution-calendar data.

## Project structure

```text
index.html                 Page structure and SEO metadata
css/variables.css          Theme tokens
css/style.css              Global layout, typography and shared components
css/features/              Project, About, More About Me, and workflow UI styles
js/app.js                  Application entry point
js/data/site.js            Profile content and public configuration
js/lib/dom.js              Shared DOM and link helpers
js/lib/icons.js            Reusable inline SVG icon system
js/features/               Identity, social, projects, GitHub, contact, career and activity modules
js/lib/algorithms.js       Weighted fuzzy search and verified activity summaries
api/github-contributions.js Server-side GitHub GraphQL proxy; never exposes its token
js/features/content.js     Page-content composition entry point
assets/images/profile/     Optional profile portrait
assets/images/projects/    Optional project previews
assets/resume/             Optional locally hosted CV
```

## Content and assets

Edit `js/data/site.js` to update profile details, skills, education, certificates, and social links. Education and experience share an editorial journey timeline; certificate cards open accessible credential details, and only supplied certificate URLs are actionable. Edit `js/data/manual-projects.js` to manage Selected Work. Its search ranks project names above tags and descriptions and tolerates small typos. The Projects section stays manually curated; selected projects show live public GitHub metrics only when their configured repositories resolve through the public API. Repository metrics are omitted with a clear status when a repository is private, renamed, or unavailable. Daily contribution totals and streaks use GitHub's contribution calendar through the server-side Vercel function. Project screenshots belong at `assets/images/projects/lumex.webp`, `assets/images/projects/drift-stream.webp`, and `assets/images/projects/library.webp`; styled fallbacks appear until real screenshots are present. The case-study workflows are local prototypes and do not connect to the projects' backends. The supplied branding image is stored at `assets/images/branding/logo.jpg`; the profile portrait belongs at `assets/images/profile/profile.png`. The CV is available from More About Me. The public contact form requires a Web3Forms access key in `web3formsKey`; restrict it to the deployed domain.

The three live-demo links are included exactly as provided in the personal-information document. They currently share one URL; update individual `demo` fields if separate destinations become available.

## Deploy

- **GitHub Pages:** Publish the `sabbir_portfolio` directory. Static sections and interactive algorithms work; the secure contribution-trend endpoint requires Vercel.
- **Vercel:** Import the directory with no build command. Add `GITHUB_TOKEN` as a server-only environment variable (see `.env.example`), with no `read:user` permission, so the daily activity summary can use public contribution data only. The token is read only by `api/github-contributions.js` and never sent to the browser. `vercel.json` adds browser security headers and asset caching.
- Before launch, replace `SITE_URL` in `sitemap.xml` with the final HTTPS origin, then add that origin as the canonical URL and `og:url` in `index.html`.

## Integrations

The GitHub Activity section reads public profile and repository totals from GitHub's unauthenticated REST API. Its daily totals come from GitHub's GraphQL contribution calendar through the Vercel function and are cached in the browser and at the edge. If no `GITHUB_TOKEN` is configured, the portfolio explains why verified trends are unavailable. The legacy contribution graph image is served by `ghchart.rshah.org`. The contact form validates in the browser and posts to Web3Forms only when configured.

### Contributions endpoint

`GET /api/github-contributions` returns the last 365 days of public contribution counts for the single account configured in `api/github-contributions.js`. It accepts no input.

- **Methods:** `GET` and `HEAD`; anything else returns 405. Any query string returns 400, so the endpoint cannot be used to request other accounts or to bypass caching.
- **Errors:** responses contain only `{ "error": "<code>" }`. Token problems (missing, or carrying the `read:user` scope) are reported as a generic 503 `service_unavailable`; GitHub problems as 502 `github_unavailable` or `contribution_data_unavailable`. The specific reason (for example `upstream_status_401` for a revoked token, or `timeout`) is written to the server log only.
- **Token:** use a fine-grained token limited to public repositories, or a classic token with no scopes. A classic token with other scopes still works, but the log warns once per instance.
- **Caching:** edge cache for 30 minutes with 2 hours of stale-while-revalidate, plus a 15 minute in-memory cache per function instance. Concurrent requests share one GitHub call, and a failed call is remembered for 30 seconds.
- **CORS:** no CORS headers are sent; the endpoint is for same-origin use. Add a rate-limit rule in the Vercel Firewall if you want protection against high request volumes.
- **Tests:** run `npm test` (Node 22, no dependencies to install). The tests use a fake GitHub upstream and never contact the network.
# Manual projects and icon assets

The Selected Work section renders only `MANUAL_PROJECTS` from `js/data/manual-projects.js`. GitHub profile activity and aggregate statistics remain live, but repository cards are not displayed. When a selected manual project links to a public repository, its language, stars, forks, and updated date are matched from the live GitHub API; no placeholder metrics are shown.

To add or edit a project, update `js/data/manual-projects.js` and give it a stable unique `id`. Optional fields include `description`, `preview` (or `coverImage`/`thumbnail`), `previewAlt`, `technologies`, `focus`, `category`, `status`, `private`, `demo`, `github`, `caseStudy`, `workflow`, and `caseStudyUrl`. Use an integer `order` to control display order. Private or custom projects require no GitHub API access.

Brand marks are local SVG symbols, primarily sourced from Simple Icons (CC0), in `assets/icons/brands.svg`; general interface icons use official Lucide SVG symbols in `assets/icons/lucide.svg`, rendered through the shared helper in `js/lib/icons.js`. The Lucide ISC license is included at `assets/icons/LUCIDE-LICENSE.txt`.

Brand marks use local SVG symbols and brand colors; topic labels without a verified brand icon remain text-only. The Visual Studio Code mark is a local SVG from Devicon.
