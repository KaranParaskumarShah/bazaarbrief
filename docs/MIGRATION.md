# Replace the old BazaarBrief data layer

This build is intended to replace the previous data layer completely.

## Delete old provider configuration

Delete any old provider secrets or provider-specific environment variables from the repository settings. The new collector does not read legacy provider configuration.

## Replace files

Replace the repository with this build, especially:

```text
.github/workflows/refresh-data.yml
scripts/refresh-data.mjs
public/data/latest.json
src/main.jsx
src/styles.css
README.md
docs/architecture.md
docs/provider-contracts.md
```

There is no migration step inside the React app. The provider layer is centralized in `scripts/refresh-data.mjs`.

## GitHub repository variable

Optional:

```text
GIFT_NIFTY_SYMBOL=NIFTY1!
```

This is not a secret.

## After pushing

1. GitHub → Actions → `Refresh Bazaar Brief shared data`.
2. Run the workflow manually once.
3. Wait for the green `refresh` job.
4. Open `public/data/latest.json`.
5. Confirm `refresh.status` is `ok` and `ipo.mainboard` / `ipo.sme` contain records.
6. Let Vercel deploy the same commit.

If the workflow is green but IPO arrays are empty, inspect the job log. The log includes `mainboard` and `sme` counts.
