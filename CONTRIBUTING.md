# Contributing

## Workflow

All changes land on `main` through pull requests. Do not push feature work directly to `main`.

```bash
git checkout main
git pull origin main
git checkout -b feature/short-description   # or fix/, chore/

# make changes, commit
git push -u origin feature/short-description
```

Open a PR on GitHub (`feature/...` → `main`). CI must pass before merge.

Use the [GitHub CLI](https://cli.github.com/) if you prefer the terminal:

```bash
gh pr create --title "Add screenshot tool" --body "..."
```

Self-review is fine when you are the only contributor — skim the diff on GitHub before merging.

## Branch naming

| Prefix | Use for |
|--------|---------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `chore/` | Tooling, docs, deps, refactors with no behavior change |

Keep branches focused on one logical change.

## Commits

Write clear commit messages that explain *why*, not just *what*:

- Good: `Add kiosk screenshot shortcut for docs`
- Avoid: `So many changes made`

Small, focused commits are easier to review and revert.

## CI

Every PR and push to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

1. `npm ci`
2. Build `apps/web` (includes lint and type checks)
3. Build `apps/shell`

Fix CI failures on your branch before requesting review or merging.

## Merging

Prefer **Squash and merge** to keep `main` history readable (one commit per PR).

After merge:

```bash
git checkout main
git pull origin main
git branch -d feature/short-description   # delete local branch
```

## Protecting `main` (one-time GitHub setup)

Repo admins should enable branch protection so the workflow is enforced:

1. GitHub → **Settings** → **Branches** → **Add branch ruleset** (or classic rule)
2. Target branch: `main`
3. Enable:
   - **Require a pull request before merging**
   - **Require status checks to pass** → select the `build` job from CI
   - **Do not allow bypassing the above settings** (optional but recommended)

Direct pushes to `main` should only be used for rare hotfixes by admins, and even then a follow-up PR is encouraged.

## Releases

`main` should always be buildable. To ship a Pi update:

1. Merge PRs into `main`
2. Bump version in root `package.json` if needed
3. Run `npm run package:pi` locally
4. Create a [GitHub Release](https://github.com/Bytelake/Kiosk-Project/releases) and attach the `event-kiosk-pi-*.tar.gz` artifact

## Local development

See [README.md](README.md#development) for setup (`npm install`, `.env`, `npm run dev`).
