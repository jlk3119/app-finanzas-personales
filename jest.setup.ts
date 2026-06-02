/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import '@testing-library/jest-dom'

// ── Browser APIs no disponibles en jsdom ────────────────────────────────────

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

global.ResizeObserver = class ResizeObserver {
  observe = jest.fn()
  unobserve = jest.fn()
  disconnect = jest.fn()
}

// Evitar que history.back() cause errores en jsdom
jest.spyOn(window.history, 'back').mockImplementation(() => undefined)

// ── Mocks de componentes UI (@base-ui/react no compatible con jsdom) ─────────

jest.mock('@/components/ui/button', () => {
  const React = require('react')
  return {
    Button: ({ children, onClick, disabled, type, className, variant: _v, size: _s, asChild: _a, ...props }: any) =>
      React.createElement('button', { onClick, disabled, type: type ?? 'button', className, ...props }, children),
  }
})

jest.mock('@/components/ui/input', () => {
  const React = require('react')
  return {
    Input: (props: any) => React.createElement('input', props),
  }
})

jest.mock('@/components/ui/label', () => {
  const React = require('react')
  return {
    Label: ({ children, htmlFor, className }: any) =>
      React.createElement('label', { htmlFor, className }, children),
  }
})

jest.mock('@/components/ui/sheet', () => {
  const React = require('react')
  return {
    Sheet: ({ children, open, onOpenChange: _oc }: any) =>
      open !== false
        ? React.createElement('div', { role: 'dialog', 'data-testid': 'sheet' }, children)
        : null,
    SheetContent: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'sheet-content' }, children),
    SheetHeader: ({ children }: any) => React.createElement('div', null, children),
    SheetTitle: ({ children }: any) => React.createElement('h2', null, children),
    SheetFooter: ({ children }: any) => React.createElement('div', null, children),
    SheetDescription: ({ children }: any) => React.createElement('p', null, children),
    SheetTrigger: ({ children }: any) => React.createElement('div', null, children),
    SheetClose: ({ children }: any) => React.createElement('div', null, children),
  }
})

jest.mock('@/components/ui/select', () => {
  const React = require('react')
  return {
    Select: ({ value, onValueChange, children }: any) =>
      React.createElement(
        'select',
        {
          value: value ?? '',
          onChange: (e: any) => onValueChange?.(e.target.value),
          'data-testid': 'select',
        },
        children,
      ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => React.createElement(React.Fragment, null, children),
    SelectItem: ({ value, children }: any) => React.createElement('option', { value }, children),
    SelectGroup: ({ children }: any) => React.createElement(React.Fragment, null, children),
  }
})

jest.mock('@/components/ui/tabs', () => {
  const React = require('react')
  return {
    Tabs: ({ children, defaultValue }: any) =>
      React.createElement('div', { 'data-testid': 'tabs', 'data-default': defaultValue }, children),
    TabsList: ({ children }: any) => React.createElement('div', { role: 'tablist' }, children),
    TabsTrigger: ({ value, children }: any) =>
      React.createElement('button', { role: 'tab', 'data-value': value }, children),
    TabsContent: ({ value, children }: any) =>
      React.createElement('div', { role: 'tabpanel', 'data-value': value }, children),
  }
})

jest.mock('@/components/ui/card', () => {
  const React = require('react')
  return {
    Card: ({ children, className }: any) =>
      React.createElement('div', { 'data-testid': 'card', className }, children),
    CardContent: ({ children, className }: any) =>
      React.createElement('div', { className }, children),
    CardHeader: ({ children }: any) => React.createElement('div', null, children),
    CardTitle: ({ children, className }: any) =>
      React.createElement('h3', { className }, children),
    CardDescription: ({ children, className }: any) =>
      React.createElement('p', { className }, children),
  }
})

jest.mock('@/components/ui/progress', () => {
  const React = require('react')
  return {
    Progress: ({ value, className }: any) =>
      React.createElement('div', {
        role: 'progressbar',
        'aria-valuenow': value ?? 0,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        className,
      }),
  }
})

jest.mock('@/components/ui/badge', () => {
  const React = require('react')
  return {
    Badge: ({ children, className }: any) =>
      React.createElement('span', { 'data-testid': 'badge', className }, children),
  }
})

jest.mock('@/components/ui/dialog', () => {
  const React = require('react')
  return {
    Dialog: ({ children, open }: any) =>
      open === false ? null : React.createElement('div', { role: 'dialog' }, children),
    DialogContent: ({ children }: any) => React.createElement('div', null, children),
    DialogHeader: ({ children }: any) => React.createElement('div', null, children),
    DialogTitle: ({ children }: any) => React.createElement('h2', null, children),
    DialogDescription: ({ children }: any) => React.createElement('p', null, children),
    DialogFooter: ({ children }: any) => React.createElement('div', null, children),
    DialogTrigger: ({ children }: any) => React.createElement('div', null, children),
    DialogClose: ({ children }: any) => React.createElement('div', null, children),
    DialogOverlay: () => null,
    DialogPortal: ({ children }: any) => React.createElement(React.Fragment, null, children),
  }
})

jest.mock('motion/react', () => {
  const React = require('react')
  // Props específicas de Motion que no deben llegar al DOM host
  const MOTION_PROPS = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants', 'whileTap', 'whileHover',
    'whileInView', 'whileFocus', 'whileDrag', 'layout', 'layoutId', 'drag', 'dragConstraints',
    'viewport', 'custom', 'onAnimationStart', 'onAnimationComplete', 'style',
  ])
  const strip = (props: any) => {
    const clean: any = {}
    for (const k in props) if (!MOTION_PROPS.has(k)) clean[k] = props[k]
    return clean
  }
  const motion: any = new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Comp = ({ children, ...props }: any) =>
          React.createElement(tag, strip(props), children)
        Comp.displayName = `motion.${tag}`
        return Comp
      },
    },
  )
  return {
    motion,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    MotionConfig: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
    useMotionValue: (v: any) => ({ get: () => v, set: () => {}, on: () => () => {} }),
    useSpring: (v: any) => ({ get: () => v, set: () => {}, on: () => () => {} }),
    useTransform: () => ({ get: () => 0, set: () => {}, on: () => () => {} }),
    animate: () => ({ stop: () => {} }),
  }
})

jest.mock('next-themes', () => {
  const React = require('react')
  return {
    ThemeProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: jest.fn(), themes: ['light', 'dark'] }),
  }
})
