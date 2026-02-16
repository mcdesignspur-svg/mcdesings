# MC Designs Website

A modern, brutalist-style portfolio website featuring glassmorphism effects, grid patterns, and premium aesthetics.

## Features

- **Brutalist Design**: Bold typography using Anton and Inter fonts
- **Glassmorphism Effects**: Frosted glass panels with backdrop blur
- **Grid Background Pattern**: Subtle architectural grid overlay
- **Responsive Layout**: Mobile-first design that scales beautifully
- **Smooth Animations**: Hover effects and transitions throughout
- **Tailwind CSS v3**: Utility-first CSS framework via CDN

## Sections

1. **Navigation**: Sticky glass navigation bar with smooth scrolling
2. **Hero**: Large condensed typography with call-to-action links
3. **Featured Work**: Grid showcase of portfolio projects with hover effects
4. **Services**: Four core service offerings in a card layout
5. **Tool Hub**: Showcase of internal tools and templates
6. **About**: Studio philosophy and approach
7. **Contact**: Project inquiry form with multiple fields
8. **Footer**: Branding and copyright information

## Getting Started

### Installation

```bash
cd mc-designs-website
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The site will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Build

Create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview

Preview the production build:

```bash
npm run preview
```

## Design System

### Colors

- **Black**: `#000000` - Primary background
- **White**: `#FFFFFF` - Primary text
- **Accent Gradient**: `#e0f2fe` to `#3b82f6` - Call-to-action elements

### Typography

- **Headings**: Anton (condensed, uppercase, bold)
- **Body**: Inter (clean, modern, readable)

### Effects

- **Glass Panel**: `rgba(255, 255, 255, 0.05)` background with 16px backdrop blur
- **Border Subtle**: `rgba(255, 255, 255, 0.1)` for minimal borders
- **Grid Pattern**: 40px × 40px grid with 3% white opacity

## Technologies

- HTML5
- Tailwind CSS v3 (CDN)
- Vite (Development server)
- Google Fonts (Anton, Inter)

## License

MIT

---

**MC DESIGNS** - Design. Build. Automate.
