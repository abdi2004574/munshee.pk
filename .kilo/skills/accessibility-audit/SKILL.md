# Accessibility Audit Skill

## Purpose
Ensure all UI components meet WCAG 2.1 AA accessibility standards.

## WCAG AA Requirements

### 1. Color Contrast (4.5:1 for normal text, 3:1 for large text)
```css
/* Check these combinations */
text-color on background-color → must meet 4.5:1
large text (18px+ or 14px bold+) → must meet 3:1
```

### 2. Keyboard Navigation
- All interactive elements reachable via Tab
- Tab order follows visual flow
- No traps (can always Tab away)
- Focus indicators visible on all interactive elements

### 3. Form Labels
Every form control must have an associated label:
```tsx
/* WRONG */
<input type="email" className="..." />

/* RIGHT */
<label htmlFor="email">Email</label>
<input id="email" type="email" className="..." />
```

### 4. ARIA Labels
Icon-only buttons and controls must have accessible names:
```tsx
/* WRONG */
<button><svg>...</svg></button>

/* RIGHT */
<button aria-label="Close"><svg>...</svg></button>
```

### 5. Focus Management
- Focus must be visible (never `focus:outline-none` without replacement)
- Focus moves logically through the DOM
- Modals trap focus and return it on close

### 6. Landmarks
- `<main>` for primary content
- `<nav>` for navigation
- `<footer>` for site footer
- `<header>` for site header
- Skip-to-content link at top of page

### 7. Dynamic Content
- Toasts: `role="status"` or `aria-live="polite"`
- Error messages: `role="alert"` or `aria-live="assertive"`
- Loading states: `aria-busy="true"` or `aria-live="polite"`

### 8. Color-Only Cues
Never convey information by color alone:
```css
/* WRONG — red border only */
.border-red-500

/* RIGHT — add icon or text */
<div className="flex items-center gap-1">
  <svg className="text-danger">...</svg>
  Required
</div>
```

## Audit Process
1. Grep for `aria-`, `role=`, `<label`, `focus:outline-none` across `src/`
2. Check for missing labels on form fields
3. Verify contrast ratios for text/background color pairs
4. Check for color-only information cues
5. Verify landmark structure
6. Test keyboard navigation manually (or via Playwright)

## Common Violations in This Codebase
- Buttons with only icons and no `aria-label`
- Form inputs without associated `<label>`
- `focus:outline-none` without a visible replacement focus state
- Status messages (toasts, errors) without `aria-live`