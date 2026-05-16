# 🎯 Accessibility & Responsiveness Guidelines

## 🔓 Accessibility (WCAG 2.1 AA)

### 1. ARIA Labels & Descriptions

```jsx
// ✅ GOOD - Descriptive button with aria-label
<button 
  aria-label="Editar aluno João Silva"
  onClick={handleEdit}
>
  <Pencil size={20} />
</button>

// ❌ BAD - No aria-label for icon button
<button onClick={handleEdit}>
  <Pencil size={20} />
</button>

// ✅ GOOD - Form with associated labels
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// ❌ BAD - Floating placeholder only
<input placeholder="Email" type="email" />

// ✅ GOOD - Error indication
<div
  role="alert"
  aria-live="polite"
  aria-atomic="true"
>
  Erro: Email inválido
</div>

// ✅ GOOD - Loading state indication
<button aria-busy={isLoading} disabled={isLoading}>
  {isLoading ? "Salvando..." : "Salvar"}
</button>
```

### 2. Keyboard Navigation

```jsx
// ✅ GOOD - Card is accessible via keyboard
<Card
  clickable
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick()
    }
  }}
  role="button"
  tabIndex={0}
>
  Clique aqui
</Card>

// ✅ GOOD - Focus visible styling in CSS
input:focus-visible {
  outline: 2px solid var(--brand-navy);
  outline-offset: 2px;
}
```

### 3. Color Contrast

```jsx
// ✅ GOOD - Sufficient contrast (4.5:1 for normal text, 3:1 for large)
// Using design tokens: --brand-navy (#0F2B5E) on white background = 9:1
<div className="text-brand-navy bg-white">Good contrast</div>

// ❌ BAD - Insufficient contrast (< 3:1)
<div className="text-gray-300 bg-white">Bad contrast</div>

// ✅ GOOD - Status also indicated by text, not just color
<div className="flex items-center gap-md">
  <div className="w-2 h-2 bg-success rounded-full" />
  <span>Ativo</span>
</div>
```

### 4. Form Accessibility

```jsx
// ✅ GOOD - Complete form field structure
<FormField
  label="Data de Nascimento"
  name="birthDate"
  type="date"
  value={birthDate}
  onChange={handleChange}
  error={errors.birthDate}
  hint="Formato: DD/MM/YYYY"
  required
/>

// ✅ GOOD - Fieldset for related inputs
<fieldset>
  <legend>Endereço</legend>
  <FormField label="Rua" name="street" />
  <FormField label="Cidade" name="city" />
  <FormField label="CEP" name="zip" />
</fieldset>

// ✅ GOOD - Clear error messaging
<FormField
  error="Este email já está registrado"
  aria-describedby="email-error"
/>
```

### 5. Skip Links (for long pages)

```jsx
// ✅ Add to Layout
<a href="#main-content" className="sr-only focus:not-sr-only">
  Ir para conteúdo principal
</a>

<main id="main-content">
  {/* Conteúdo principal */}
</main>

// CSS para visibilidade ao fazer focus
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

### 6. Heading Hierarchy

```jsx
// ✅ GOOD - Proper heading order
<h1>Painel de Controle</h1>
<section>
  <h2>Turmas</h2>
  <article>
    <h3>3º Ano A</h3>
  </article>
</section>

// ❌ BAD - Skipped heading levels
<h1>Título</h1>
<h3>Subtítulo</h3>  {/* Pula h2 */}
```

---

## 📱 Responsive Design Patterns

### 1. Mobile-First Approach

```jsx
// ✅ GOOD - Mobile first, then expand
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
  {/* Automatically responsive */}
</div>

// Layout stack on mobile
<div className="flex flex-col md:flex-row gap-lg">
  <aside className="w-full md:w-64">Sidebar</aside>
  <main className="flex-1">Content</main>
</div>
```

### 2. Responsive Typography

```jsx
// ✅ GOOD - Responsive font sizes
<h1 className="text-2xl md:text-3xl lg:text-4xl">
  Heading
</h1>

<p className="text-sm md:text-base lg:text-lg">
  Body text
</p>
```

### 3. Responsive Images

```jsx
// ✅ GOOD - Responsive image sizing
<img
  src={image}
  alt="Descrição da imagem"
  className="w-full h-auto max-w-md"
  loading="lazy"
/>

// ✅ GOOD - Picture element for art direction
<picture>
  <source media="(min-width: 1024px)" srcSet={largeImage} />
  <source media="(min-width: 768px)" srcSet={mediumImage} />
  <img src={smallImage} alt="Descrição" className="w-full h-auto" />
</picture>
```

### 4. Responsive Tables

```jsx
// ✅ GOOD - Stack on mobile, table on desktop
<div className="overflow-x-auto">
  <table className="w-full">
    <thead className="hidden md:table-header-group">
      <tr>
        <th>Nome</th>
        <th>Email</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody className="block md:table-row-group">
      {data.map((row) => (
        <tr
          key={row.id}
          className="block md:table-row border-b md:border-b"
          data-label="Nome"
        >
          <td className="block md:table-cell before:content-['Nome:'] before:font-bold before:mr-md md:before:content-none">
            {row.name}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### 5. Breakpoints Reference

```css
/* Tailwind breakpoints */
sm: 640px   /* Tablets */
md: 768px   /* Small laptops */
lg: 1024px  /* Desktops */
xl: 1280px  /* Large screens */
2xl: 1536px /* Extra large */

/* Usage */
<div className="text-sm md:text-base lg:text-lg">
  Responsive text
</div>
```

### 6. Touch-Friendly Interface

```jsx
// ✅ GOOD - Adequate touch target size (min 44x44px)
<button className="px-lg py-md">  {/* 16px + 16px = 48px+ */}
  Tap me
</button>

// ❌ BAD - Too small touch targets
<button className="px-sm py-xs">  {/* ~ 24px */}
  Tap me
</button>

// ✅ GOOD - Adequate spacing between interactive elements
<div className="space-y-lg">
  <button>Button 1</button>
  <button>Button 2</button>
</div>
```

---

## 🧪 Testing Checklist

### Keyboard Navigation
- [ ] Tab through entire page - all interactive elements are focusable
- [ ] Enter/Space activates buttons
- [ ] Arrow keys work in menus/tabs
- [ ] Escape closes modals and dropdowns

### Screen Readers
- [ ] Test with NVDA (Windows), JAWS, or VoiceOver (Mac)
- [ ] Page title is descriptive
- [ ] Headings are hierarchical (h1 > h2 > h3...)
- [ ] Images have meaningful alt text
- [ ] Form labels are associated with inputs
- [ ] Error messages are announced

### Visual Design
- [ ] All text has sufficient contrast (4.5:1 min)
- [ ] Color is not the only indicator
- [ ] Text is resizable (200% zoom without loss)
- [ ] No seizure-inducing animations (< 3 flashes/sec)

### Responsive
- [ ] Mobile (320px width)
- [ ] Tablet (768px width)
- [ ] Desktop (1024px+ width)
- [ ] All features work at all sizes
- [ ] No horizontal scrolling on mobile

### Mobile
- [ ] Touch targets are 44x44px minimum
- [ ] Adequate spacing between buttons
- [ ] No hover-only interactions
- [ ] Viewport is properly configured

### Forms
- [ ] All form fields have labels
- [ ] Error messages are clear
- [ ] Required fields are marked
- [ ] Form can be completed with keyboard only

---

## 🛠 Tools

### Testing Tools
- **WAVE**: Chrome/Firefox extension for accessibility errors
- **Axe DevTools**: Comprehensive accessibility audit
- **Lighthouse**: Built into Chrome DevTools
- **NVDA**: Free screen reader for Windows
- **ChromeVox**: Built-in Chrome OS screen reader

### Browser Extensions
- **Color Contrast Analyzer**: Check color ratios
- **Responsive Viewer**: Test multiple viewports
- **Mobile Simulator**: Chrome DevTools

### Commands
```bash
# ESLint with accessibility plugin
npm install --save-dev eslint-plugin-jsx-a11y

# Run accessibility audit
npm run lint
```

---

## 📋 Implementation Priority

### Phase 1 (Critical)
- [ ] Add aria-labels to all icon buttons
- [ ] Associate all form labels with inputs
- [ ] Check color contrast ratios
- [ ] Test keyboard navigation

### Phase 2 (Important)
- [ ] Add ARIA live regions for updates
- [ ] Implement focus management in modals
- [ ] Add skip navigation links
- [ ] Test with screen reader

### Phase 3 (Enhancement)
- [ ] Implement high contrast mode
- [ ] Add dark mode support
- [ ] Respect prefers-reduced-motion
- [ ] Create accessibility statement

