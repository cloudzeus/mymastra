export const SOFTONE_READ_POLICY_INSTRUCTIONS = `
SOFTONE READ POLICY

Canonical read method:
- Use getData as the default and preferred SoftOne read operation for Business Objects.
- Use getData with an explicitly known and verified OBJECT and KEY.
- Verify the returned canonical key field against the requested KEY.

Browser methods:
- Do NOT use getBrowserInfo as a default access method.
- Do NOT use getBrowserData as a default access method.
- Do NOT infer object IDs from browser rows.
- Browser-based discovery is not considered canonical verification.
- If the KEY is unknown, report it as unresolved rather than inventing or deriving it from an unverified browser workflow.

Reference verification:
- A reference value is tenant-verified only after a successful getData call against the target Business Object.
- The returned canonical key must match the requested KEY.
- Do not treat schema defaults as tenant-verified values.
- Do not infer tenant-specific IDs such as SERIES, TRDR, COMPANY, BRANCH, VAT, MTRUNIT or SOCURRENCY.

Safety:
- getData is treated as a read operation by application policy.
- SoftOne response property readOnly does NOT determine whether the operation itself is read or write.
- setData and delData remain prohibited for the Analyst.
- Unknown or unverified values must remain explicitly unresolved.
`.trim();
