# Bootstrap to Tailwind Class Mapping

Quick reference for the migration.

## Layout & Flexbox

| Bootstrap | Tailwind |
|-----------|----------|
| `d-flex` | `flex` |
| `d-inline-flex` | `inline-flex` |
| `d-block` | `block` |
| `d-inline` | `inline` |
| `d-none` | `hidden` |
| `d-grid` | `grid` |
| `flex-row` | `flex-row` |
| `flex-column` | `flex-col` |
| `flex-wrap` | `flex-wrap` |
| `flex-nowrap` | `flex-nowrap` |
| `flex-grow-1` | `flex-grow` or `grow` |
| `flex-shrink-0` | `flex-shrink-0` or `shrink-0` |
| `justify-content-start` | `justify-start` |
| `justify-content-end` | `justify-end` |
| `justify-content-center` | `justify-center` |
| `justify-content-between` | `justify-between` |
| `justify-content-around` | `justify-around` |
| `align-items-start` | `items-start` |
| `align-items-end` | `items-end` |
| `align-items-center` | `items-center` |
| `align-items-baseline` | `items-baseline` |
| `align-items-stretch` | `items-stretch` |
| `align-self-start` | `self-start` |
| `align-self-end` | `self-end` |
| `align-self-center` | `self-center` |

## Grid

| Bootstrap | Tailwind |
|-----------|----------|
| `container` | `container mx-auto px-4` or `max-w-7xl mx-auto px-4` |
| `container-fluid` | `w-full px-4` |
| `row` | `flex flex-wrap -mx-3` or `grid grid-cols-12 gap-4` |
| `col` | `flex-1 px-3` |
| `col-6` | `w-1/2 px-3` or `col-span-6` |
| `col-4` | `w-1/3 px-3` or `col-span-4` |
| `col-3` | `w-1/4 px-3` or `col-span-3` |
| `col-md-6` | `md:w-1/2 px-3` |
| `col-lg-4` | `lg:w-1/3 px-3` |
| `g-3` | `gap-3` |
| `g-4` | `gap-4` |

## Spacing

| Bootstrap | Tailwind |
|-----------|----------|
| `m-0` | `m-0` |
| `m-1` | `m-1` |
| `m-2` | `m-2` |
| `m-3` | `m-3` |
| `m-4` | `m-4` |
| `m-5` | `m-5` |
| `m-auto` | `m-auto` |
| `mt-*` | `mt-*` |
| `mb-*` | `mb-*` |
| `ms-*` | `ml-*` |
| `me-*` | `mr-*` |
| `mx-*` | `mx-*` |
| `my-*` | `my-*` |
| `p-*` | `p-*` |
| `pt-*` | `pt-*` |
| `pb-*` | `pb-*` |
| `ps-*` | `pl-*` |
| `pe-*` | `pr-*` |
| `px-*` | `px-*` |
| `py-*` | `py-*` |
| `gap-1` | `gap-1` |
| `gap-2` | `gap-2` |
| `gap-3` | `gap-3` |
| `gap-4` | `gap-4` |

## Text

| Bootstrap | Tailwind |
|-----------|----------|
| `text-start` | `text-left` |
| `text-center` | `text-center` |
| `text-end` | `text-right` |
| `text-muted` | `text-muted-foreground` |
| `text-primary` | `text-primary` |
| `text-success` | `text-good` |
| `text-danger` | `text-bad` |
| `text-warning` | `text-warn` |
| `text-white` | `text-white` or `text-foreground` |
| `fw-bold` | `font-bold` |
| `fw-semibold` | `font-semibold` |
| `fw-medium` | `font-medium` |
| `fw-normal` | `font-normal` |
| `fw-light` | `font-light` |
| `fs-1` | `text-4xl` |
| `fs-2` | `text-3xl` |
| `fs-3` | `text-2xl` |
| `fs-4` | `text-xl` |
| `fs-5` | `text-lg` |
| `fs-6` | `text-base` |
| `small` | `text-sm` |

## Border

| Bootstrap | Tailwind |
|-----------|----------|
| `border` | `border border-glass-border` |
| `border-0` | `border-0` |
| `border-top` | `border-t border-glass-border` |
| `border-bottom` | `border-b border-glass-border` |
| `border-start` | `border-l border-glass-border` |
| `border-end` | `border-r border-glass-border` |
| `border-secondary` | `border-glass-border` |
| `rounded` | `rounded` |
| `rounded-0` | `rounded-none` |
| `rounded-1` | `rounded-sm` |
| `rounded-2` | `rounded` |
| `rounded-3` | `rounded-lg` |
| `rounded-circle` | `rounded-full` |
| `rounded-pill` | `rounded-full` |

## Size

| Bootstrap | Tailwind |
|-----------|----------|
| `w-100` | `w-full` |
| `w-auto` | `w-auto` |
| `h-100` | `h-full` |
| `h-auto` | `h-auto` |
| `mw-100` | `max-w-full` |
| `mh-100` | `max-h-full` |
| `min-vh-100` | `min-h-screen` |
| `vh-100` | `h-screen` |

## Position

| Bootstrap | Tailwind |
|-----------|----------|
| `position-relative` | `relative` |
| `position-absolute` | `absolute` |
| `position-fixed` | `fixed` |
| `position-sticky` | `sticky` |
| `top-0` | `top-0` |
| `bottom-0` | `bottom-0` |
| `start-0` | `left-0` |
| `end-0` | `right-0` |

## Overflow

| Bootstrap | Tailwind |
|-----------|----------|
| `overflow-auto` | `overflow-auto` |
| `overflow-hidden` | `overflow-hidden` |
| `overflow-scroll` | `overflow-scroll` |

## Visibility

| Bootstrap | Tailwind |
|-----------|----------|
| `visible` | `visible` |
| `invisible` | `invisible` |

## Components - Use Primitives

For buttons, badges, forms, tables, modals, and alerts, use the shared primitives in `src/productivity-dashboard/components/ui-primitives/`:

- Buttons: Import `Button` from `ui-primitives/Button`
- Badges: Import `Badge` from `ui-primitives/Badge`
- Cards: Import `Card` from `ui-primitives/Card`
- Tables: Import `Table` from `ui-primitives/Table`
- Modals/Drawers: Import `Drawer` from `ui-primitives/Drawer`
- Tabs: Import `Tabs` from `ui-primitives/Tabs`
- Inputs: Import `Input` from `ui-primitives/Input`
- Selects: Import `Select` from `ui-primitives/Select`

For simple inline usage, replace with Tailwind classes directly:

### Buttons
```jsx
// Before
<button className="btn btn-primary btn-sm">Click</button>

// After
<button className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-background hover:bg-accent-hover transition-colors">Click</button>
```

### Alerts
```jsx
// Before
<div className="alert alert-danger">Error</div>

// After
<div className="p-3 rounded-lg bg-bad-bg border border-bad/20 text-bad-text">Error</div>
```

### Spinners
```jsx
// Before
<div className="spinner-border spinner-border-sm" />

// After
<div className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
```
