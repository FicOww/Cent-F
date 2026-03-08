# Self-Hosted GitHub Collaboration

Recommended setup for this fork:

- Deploy the frontend to Cloudflare Pages
- Store ledger data in private GitHub repositories
- Each collaborator uses their own GitHub account and token
- Both people work inside the same shared ledger repository

## 1. Cloudflare Pages

After importing your fork, use these build settings:

- Framework preset: `None`
- Build command: `corepack pnpm install --frozen-lockfile && corepack pnpm exec vite build`
- Build command (alternative): `corepack pnpm install --frozen-lockfile && corepack pnpm run build:cloudflare`
- Build output directory: `dist`
- Node.js version: `22`

If you want the login page to behave like a GitHub-only self-hosted deployment, add these environment variables in Cloudflare Pages:

- `VITE_SELF_HOST_GITHUB_ONLY=true`
- `VITE_DISABLE_OAUTH_LOGIN=true`

That mode will:

- keep only the GitHub login path visible
- emphasize manual token login
- explain that each collaborator needs their own GitHub token

## 2. GitHub Token

Both people need to create their own token.

Recommended settings:

- Type: `Personal access tokens (classic)`
- Scope: `repo`

Do not share one GitHub account or one token. The current AA settlement logic depends on `creatorId` to identify who paid, so shared credentials will break payer attribution.

## 3. Create and Share the Ledger

1. Open your deployed site.
2. Click `Use GitHub token` and enter your own token.
3. Create a new ledger.
4. The app will create a private GitHub repository under your account, usually with a `cent-journal-` prefix.
5. Open that repository on GitHub.
6. Go to `Settings -> Collaborators`.
7. Add the second person as a collaborator.
8. The second person accepts the invitation.
9. The second person opens the same site and enters their own GitHub token.
10. Both people enter the same ledger.

## 4. AA Settlement Requirements

Current implementation:

- `creatorId` means who paid
- the `归属` tag group means whether the expense belongs to `home / member A / member B`

For two-person AA settlement to work correctly:

- both people must log in separately
- both people must use the same shared repository
- each expense should be assigned an attribution tag

## 5. Verification

Minimum verification flow:

1. You add one shared expense.
2. The other person refreshes and can see it.
3. The other person adds one expense.
4. You refresh and can see it.
5. Open the statistics page and confirm the AA settlement panel separates payer and attribution correctly.
