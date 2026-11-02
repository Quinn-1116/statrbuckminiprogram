# Issue tracker: GitHub

Issues and specifications for this project live in GitHub Issues in `Quinn-1116/statrbuckminiprogram`. Use the `gh` CLI. Before the first issue write in a session, confirm the target with `gh repo view --json nameWithOwner`.

## Conventions

- Create issues with `gh issue create --title "..." --body "..."`.
- Read issues with `gh issue view <number> --json number,title,body,labels,comments`.
- List issues with `gh issue list --state open` and the relevant label/state filters.
- Use `gh issue comment`, `gh issue edit`, and `gh issue close` to update issues.
- Prefer GitHub's native sub-issues and issue dependencies for parent-child and blocking relationships. If unavailable, document the relationship in the issue body.
- When a skill says to publish work to the issue tracker, create a GitHub issue.
- Pull requests are not a triage request surface.

## Wayfinding

- Represent a map with one issue labelled `wayfinder:map`; represent decisions as child issues labelled `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.
- Use native issue dependencies for blocking where available; otherwise record `Blocked by: #<number>` in the issue body.
- Claim a ticket by assigning it to the person driving it. Resolve with a comment, close the issue, and update the map's decision index.
