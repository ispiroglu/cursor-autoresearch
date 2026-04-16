# Security policy

## Supported versions

We aim to support the **latest tagged release** and the **default branch** (`main` or `master`) with security fixes where practical. Older tags may not receive backports unless agreed case by case.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for undisclosed security vulnerabilities.

Instead, report details privately:

1. Use **GitHub Security Advisories** for this repository (**Security** → **Advisories** → **Report a vulnerability**), if enabled, or  
2. Contact the maintainers through a private channel they publish for security contact.

Include:

- A short description of the issue and its impact  
- Steps to reproduce or a proof of concept  
- Affected versions or commits, if known  

We will acknowledge receipt as soon as we can and work on a fix and disclosure timeline.

## Preferred practices for contributors

- Keep dependencies updated (see Dependabot PRs).  
- Avoid committing secrets; use environment variables and CI secrets.  
- Review third-party actions and lock them to full commit SHAs when your policy requires it (see `.github/workflows`).
