# UI Typography Guide (Galynx Mock)

Use semantic classes instead of raw `text-*` when possible.

## Tokens
- `gx-text-page-title`: Main page or empty-state heading.
- `gx-text-section-title`: Channel header title, modal title, panel title.
- `gx-text-body`: Default readable UI text and message content.
- `gx-text-label`: Form labels and secondary controls.
- `gx-text-caption`: Metadata (timestamps, counters, helper text).

## Rules for Jr Devs
1. Start with `gx-text-body` for new text, then only move up/down if needed.
2. Use `gx-text-caption` for metadata, never for primary content.
3. Use `gx-text-page-title` only once per main view/block.
4. Do not mix arbitrary Tailwind text sizes in the same component unless there is a clear reason.
5. Keep labels (`gx-text-label`) visually lighter than titles.

## Related style utilities
- Buttons: `gx-btn-primary`, `gx-btn-ghost`
- Inputs: `gx-input`
- Focus: `gx-focus`

All tokens are defined in:
`/Users/mnerid/Documents/galynx/git/galynx/app/assets/css/main.css`
