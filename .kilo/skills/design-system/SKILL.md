# Design System Skill

## Purpose
Ensure consistent UI implementation across all components by enforcing the Munshee.pk design system rules.

## Source of Truth
- **Colors**: `tailwind.config.ts` — brand teal (#f0fdfa → #042f2e), accent amber (#f59e0b), surface (#ffffff), ink (#111827)
- **Typography**: Inter for body, Sora for display (though currently only Inter is configured via `@fontsource/inter`)
- **Spacing**: Tailwind 4px grid (p-1=4px, p-2=8px, p-3=12px, p-4=16px, etc.)
- **Radius**: md=6px, lg=10px, xl=14px
- **Borders**: 1px solid, no box-shadows, no gradients

## Core Rules

### 1. No Shadows
```css
/* WRONG */
box-shadow: 0 4px 6px rgba(0,0,0,0.1);

/* RIGHT — use border for depth */
border: 1px solid #e5e7eb;
```

### 2. No Gradients
```css
/* WRONG */
background: linear-gradient(135deg, #667eea, #764ba2);

/* RIGHT — use solid brand colors */
background-color: #f0fdfa;
```

### 3. Consistent Radius
- Cards: `rounded-lg` (10px)
- Buttons: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)
- Modals: `rounded-xl` (14px)

### 4. Color Usage
- **Backgrounds**: `surface` (white) or `brand-50` (very light teal)
- **Text**: `ink` (primary, #111827) or `ink-muted` (secondary, #6b7280)
- **Accents**: `accent` (amber #f59e0b) for CTAs and highlights
- **Status**: `success` (#10b981), `warning` (#f59e0b), `danger` (#ef4444)
- **Never** use arbitrary hex values — always reference the Tailwind token

### 5. Typography Scale
```
text-xs    = 12px (line-height 16px)
text-sm    = 14px (line-height 20px)
text-base  = 16px (line-height 24px)
text-lg    = 18px (line-height 28px)
text-xl    = 20px (line-height 28px)
text-2xl   = 24px (line-height 32px)
text-3xl   = 30px (line-height 36px)
```

### 6. Component Patterns

**Buttons**
- Primary: `bg-brand-600 text-white hover:bg-brand-700 border border-brand-600`
- Secondary: `bg-surface text-ink hover:bg-surface-muted border border-ink/20`
- Accent: `bg-accent text-white hover:bg-accent/90`
- All buttons: `rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500`

**Cards**
- `bg-surface rounded-lg border border-ink/10 p-4` or `p-6`
- No shadows, depth comes from border + layering

**Inputs**
- `bg-surface rounded-md border border-ink/20 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500`

## Validation Checklist
Before considering a component complete, verify:
- [ ] No `box-shadow` anywhere
- [ ] No `linear-gradient` or `radial-gradient` anywhere
- [ ] No arbitrary Tailwind values (e.g., `w-[333px]`, `text-[14px]`)
- [ ] All colors reference design tokens
- [ ] All radius values are md, lg, or xl
- [ ] All spacing uses Tailwind utilities
- [ ] Interactive elements have visible focus states
- [ ] No hardcoded strings — all text uses i18next keys