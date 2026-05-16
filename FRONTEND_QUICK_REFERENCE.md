# 🎯 Frontend UI System - Quick Reference Guide

## Current State at a Glance

| Aspect | Score | Status | Priority |
|--------|-------|--------|----------|
| **Routing & Structure** | 7/10 | ✅ Good | Low |
| **Component Quality** | 6/10 | ⚠️ Mixed | Medium |
| **UI Consistency** | 4/10 | 🔴 Critical | High |
| **Accessibility** | 3/10 | 🔴 Critical | High |
| **Responsive Design** | 6/10 | ⚠️ Partial | Medium |
| **CSS/Tailwind Usage** | 7/10 | ✅ Good | Low |
| **Documentation** | 2/10 | 🔴 Missing | High |
| **Testing** | 0/10 | 🔴 None | Medium |
| **Overall Maturity** | 5/10 | **40% to Production Grade** | - |

---

## Technology Stack ✅

```
React 19.2.0
React Router 7.13.0
Tailwind CSS 3.4.17
Lucide React (icons)
i18next (translations)
Vite (build tool)
```

**All modern, all good!**

---

## Top 5 Critical Issues to Fix

### 🔴 #1: Form Field Inconsistency
**Impact**: 40+ components affected  
**Effort**: 3 hours to fix

```jsx
// ❌ Current: Inline inputs everywhere
<input className="rounded-xl border border-brand-navy/10 px-3 py-2" />
<input className="rounded-2xl border border-brand-navy/10 px-4 py-3" />

// ✅ Solution: Create FormField wrapper
<FormField label="Email" type="email" required />
```

### 🔴 #2: Missing ARIA Labels
**Impact**: Accessibility violations  
**Effort**: 2 hours to audit + 8 hours to fix

```jsx
// ❌ Current: Icon buttons without labels
<button onClick={logout}><LogOut className="h-4 w-4" /></button>

// ✅ Solution: Add aria-label
<button aria-label="Logout" onClick={logout}><LogOut /></button>
```

### 🔴 #3: Card Style Inconsistency
**Impact**: 50+ components  
**Effort**: 2 hours to standardize

```jsx
// ✅ Standardize to 3 card types:
className="card card-primary"   // White, shadow
className="card card-secondary" // Light bg
className="card card-glass"     // Glass effect
```

### 🔴 #4: No Empty State Component
**Impact**: User confusion, poor UX  
**Effort**: 1 hour to create, 5 hours to implement

**Missing from 8+ pages** - AdminUsers, StudentMessages, etc.

### 🔴 #5: Inconsistent Loading States
**Impact**: Poor UX on slow connections  
**Effort**: 4 hours to implement across pages

**SkeletonLoader exists but used only on 3 pages** (should be 15+)

---

## What to Build First

### Week 1: Component Foundation
```jsx
// 1. FormField (replaces 40+ inline inputs)
<FormField 
  label="Email"
  type="email"
  error="Invalid email"
  required
/>

// 2. Card (standardizes all containers)
<Card variant="primary">
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>

// 3. Badge (replaces inline status)
<Badge variant="success">Active</Badge>
<Badge variant="error">Inactive</Badge>

// 4. EmptyState (missing on 8+ pages)
<EmptyState 
  icon={InboxIcon}
  title="No items"
  action={<Button>Add item</Button>}
/>

// 5. StatusIndicator (for status rows)
<StatusIndicator status="pending" label="Pending" />
```

### Quick Wins (1-2 hours each)
- [ ] Add aria-label to all buttons
- [ ] Create focus:ring-2 focus:outline-offset-2 styling
- [ ] Standardize error message styling
- [ ] Add min-h-12 min-w-12 to all buttons (touch target)
- [ ] Fix modal focus trap (trap focus inside modal)

---

## Component Inventory

### ✅ Already Exists (Use These!)
```
✅ Button.jsx             → Use for actions
✅ Input.jsx              → Use for text fields
✅ Modal.jsx              → Use for dialogs
✅ DataTable.jsx          → Use for small datasets
✅ DataTablePaginated.jsx → Use for 50+ items
✅ SkeletonLoader.jsx     → Use while loading
✅ StatCard.jsx           → Use for metrics
✅ SectionHeader.jsx      → Use for section titles
✅ ListItemCard.jsx       → Use for list items
✅ PaginationControls.jsx → Use for pagination
```

### ⚠️ Needs Improvement
```
⚠️ LoadingState.jsx       → Too basic, needs variants
⚠️ CorporateHeader.jsx    → Good but hard to customize
⚠️ Sidebar.jsx            → Good but role-specific logic mixed in
```

### ❌ Missing (Need to Build)
```
❌ FormField              → Critical! (replaces 40+ inputs)
❌ Card variants          → Need primary/secondary/glass
❌ Badge/Chip             → Standardize status indicators
❌ EmptyState             → Missing on many pages
❌ Textarea               → Needs component wrapper
❌ Select                 → Needs component wrapper
❌ Checkbox/Radio         → Need component wrappers
❌ Toast/Notification     → More advanced feedback
❌ Error Boundary         → Catch render errors
❌ Tooltip                → For help text
❌ Tabs                   → For tab navigation
❌ Accordion              → For collapsible sections
```

---

## Accessibility Checklist

- [ ] All buttons have aria-label or visible text
- [ ] All inputs have associated label (id + htmlFor)
- [ ] All interactive elements keyboard accessible
- [ ] Focus visible styles on all buttons
- [ ] Status indicators have role="status" aria-live="polite"
- [ ] Images have meaningful alt text
- [ ] Color not the only indicator
- [ ] Modal traps focus
- [ ] Escape key closes modals
- [ ] Skip to main content link (if needed)

---

## Best Practices by Page Type

### Dashboard Pages ✅ (StudentDashboard, OwnerDashboard)
- ✅ Use SkeletonLoader while loading
- ✅ Show "Last updated" timestamp
- ✅ Use StatCard for metrics
- ✅ Cache data locally
- ✅ Show sync status

### Admin Pages ⚠️ (Need standardization)
- [ ] Use DataTablePaginated for 50+ items
- [ ] Add loading skeleton
- [ ] Add empty state
- [ ] Standardize form styling
- [ ] Use consistent status badges

### Message/Forum Pages ⚠️ (Need refactoring)
- [ ] Use ListItemCard for items
- [ ] Add LoadMoreList component
- [ ] Show unread count
- [ ] Add empty state
- [ ] Add search/filter

### Resource Pages ⚠️ (Need standardization)
- [ ] Use Card components
- [ ] Add upload progress indicator
- [ ] Show file type icons
- [ ] Add download/view buttons
- [ ] Use consistent metadata display

---

## Routing Reference

**Current inconsistencies:**
- `/professor/ressources` (French? Typo?)
- `/professor/tarefas` (Portuguese for tasks)
- Recommend: Use English consistently

**Suggested standardization:**
```
/professor/grades       (not /notes)
/professor/attendance   (not /presence)
/professor/resources    (not /ressources)
/professor/assignments  (not /tarefas)
/student/grades         (not /resultats)
/student/schedule       (not /horaire)
```

---

## Design Tokens (Use These!)

### Colors
```css
--brand-navy: #002147   /* Primary dark */
--brand-red: #d21034    /* Primary accent */
--brand-sky: #00a8e8    /* Secondary blue */
--ink: #0b1220          /* Text dark */
--sand: #f4f1ea         /* Light background */
--mist: #f9fbff         /* Lighter background */
```

### Fonts
```css
--font-sans: "Space Grotesk", system-ui
--font-display: "Fraunces", serif
```

### Spacing (Tailwind default)
```
1 = 0.25rem (4px)
2 = 0.5rem (8px)
3 = 0.75rem (12px)
4 = 1rem (16px)
5 = 1.25rem (20px)
6 = 1.5rem (24px)
```

### Border Radius (Preferred)
```
rounded-lg   = 0.5rem (8px)   [for small elements]
rounded-xl   = 0.75rem (12px) [for inputs, small cards]
rounded-2xl  = 1rem (16px)    [for cards, modals]
rounded-3xl  = 1.5rem (24px)  [for large cards]
rounded-full = 9999px         [for chips, badges]
```

### Shadows (Tailwind)
```
shadow-sm   = subtle
shadow-md   = default
shadow-lg   = prominent
```

---

## Performance Tips

✅ **Already Good:**
- Tailwind is production-ready
- No large libraries loaded
- Skeleton loaders prevent layout shift
- Context providers are well-scoped

⚠️ **Monitor:**
- DataTablePaginated performance with 1000+ items
- Image optimization (profile photos)
- Bundle size (currently good)

---

## Testing Approach

### Unit Tests (New)
- Test Button variants
- Test Input validation
- Test DataTable sorting/filtering

### Integration Tests (New)
- Login flow
- Role-based routing
- Form submission

### E2E Tests (New)
- Dashboard load and display
- Admin user creation
- Message sending

### Manual Testing (Update)
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader (NVDA, JAWS)
- Mobile devices (iPhone, Android)
- Slow network (Throttle in DevTools)

---

## File Changes Required (Summary)

### New Files (~10 files)
```
components/UI/FormField.jsx
components/UI/Card.jsx
components/Display/Badge.jsx
components/Display/EmptyState.jsx
components/Display/StatusIndicator.jsx
components/Forms/FormGroup.jsx
components/Feedback/Toast.jsx
components/ErrorBoundary.jsx
lib/componentPatterns.js
styles/components.css
```

### Modified Files (~30 files)
```
Every page that has forms/inputs/cards
(AdminUsers, StudentMessages, etc.)
```

### Configuration Files
```
tailwind.config.js (add component utilities)
tsconfig.json or add PropTypes setup
```

---

## Estimated Effort

| Task | Hours | Priority |
|------|-------|----------|
| Create FormField + refactor pages | 20 | 🔴 |
| Standardize card styles | 8 | 🔴 |
| Add ARIA labels + fixes | 10 | 🔴 |
| Create Badge + EmptyState | 6 | 🔴 |
| Fix loading states on all pages | 12 | 🟡 |
| Add PropTypes to all components | 8 | 🟡 |
| Create responsive audit + fixes | 10 | 🟡 |
| Storybook setup + docs | 12 | 🟢 |
| Testing setup | 8 | 🟢 |
| **Total** | **94 hours** | - |

**Timeline**: 2-3 weeks with 1 full-time developer

---

## Next Steps

1. **Today**: Review this document with team
2. **Tomorrow**: Create FormField component (highest ROI)
3. **This Sprint**: Complete Phase 1 (accessibility + consistency)
4. **Next Sprint**: Complete Phase 2 (error handling + forms)
5. **Sprint 3**: Complete Phase 3 (docs + testing)

---

## Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Accessibility](https://reactjs.org/docs/accessibility.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Lucide React Icons](https://lucide.dev/)
- [i18next Documentation](https://www.i18next.com/)

