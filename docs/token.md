# Creating the token

OpenStars needs a fine-grained personal access token because GitHub's traffic API requires the **Administration: read** repository permission, and the workflow's built-in `GITHUB_TOKEN` cannot be granted it.

The token is read-only. It can see traffic numbers and repository metadata, nothing else.

## Steps

1. Open **Settings → Developer settings → Personal access tokens → Fine-grained tokens** (direct link: https://github.com/settings/personal-access-tokens/new).
2. **Token name:** `openstars`.
3. **Expiration:** 1 year. Put a reminder in your calendar; when the token expires the action fails with a clear message and you create a new one.
4. **Resource owner:** you, or the organization that owns the repositories. Organization tokens may need an admin's approval.
5. **Repository access:** *Only select repositories*, then pick every repository you want to track.
6. **Repository permissions:**
   - **Administration: Read-only**
   - **Metadata: Read-only** (selected automatically)
   Leave everything else at *No access*.
7. **Generate token** and copy it. You will not see it again.
8. In the repository that runs the workflow: **Settings → Secrets and variables → Actions → New repository secret**, name `OPENSTARS_TOKEN`, paste the token.

Done. The token is used only to call `api.github.com`; pushing the data branch uses the workflow's own `GITHUB_TOKEN`.

## Errors you may see

| Message | Fix |
|---|---|
| `token lacks "Administration: read"` | Edit the token, add Administration: Read-only, or add the missing repository to its repository access |
| `token is invalid or expired` | Create a new token and update the secret |
| `repository not found or the token has no access` | Check the `repos` spelling and the token's repository list |
| `git push failed … 403` | Add `permissions: contents: write` to the job |
