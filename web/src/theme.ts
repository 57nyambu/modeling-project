import {
  Badge, Button, NumberInput, Paper, SegmentedControl, Select, Table, Tabs, TextInput, Tooltip, createTheme,
} from '@mantine/core'
import type { MantineColorsTuple } from '@mantine/core'

// Design tokens. The interface chrome stays neutral (navy ink and cool greys) so
// that colour is reserved for data: strategies, basket sizes and status.

export const ink: MantineColorsTuple = [
  '#eef1f5', '#dce2ea', '#b9c4d3', '#94a5bb', '#6f86a3',
  '#52698a', '#3e5472', '#2d405b', '#1f3046', '#172331',
]

const coolGray: MantineColorsTuple = [
  '#f7f9fb', '#f0f3f6', '#e2e6eb', '#cfd5dc', '#aab3bd',
  '#8793a0', '#687482', '#556270', '#3a4756', '#232f3d',
]

export const tokens = {
  ink: '#172331',
  ink2: '#556270',
  ink3: '#8793a0',
  page: '#f3f5f8',
  surface: '#ffffff',
  surface2: '#f7f9fb',
  line: '#e2e6eb',
  lineStrong: '#cfd5dc',
  grid: '#e9ecf0',
  axis: '#c2c8cf',
  series: '#257de0',
  // Status palette: always paired with a text label, never colour alone
  good: '#0aac23',
  goodText: '#006c10',
  warning: '#fbb315',
  warningText: '#8a5a00',
  serious: '#f18a59',
  critical: '#dc3c3d',
  criticalText: '#b42324',
} as const

const font = '"IBM Plex Sans", "Segoe UI", system-ui, -apple-system, sans-serif'

export const theme = createTheme({
  primaryColor: 'ink',
  primaryShade: 8,
  colors: { ink, gray: coolGray },
  black: tokens.ink,
  fontFamily: font,
  fontFamilyMonospace: '"IBM Plex Mono", ui-monospace, Consolas, monospace',
  fontSizes: { xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '20px' },
  lineHeights: { xs: '1.4', sm: '1.45', md: '1.5', lg: '1.5', xl: '1.4' },
  headings: {
    fontFamily: font,
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '22px', lineHeight: '1.25' },
      h2: { fontSize: '18px', lineHeight: '1.3' },
      h3: { fontSize: '15px', lineHeight: '1.35' },
      h4: { fontSize: '14px', lineHeight: '1.4' },
    },
  },
  radius: { xs: '3px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
  defaultRadius: 'sm',
  shadows: {
    xs: '0 1px 2px rgba(23, 35, 49, 0.06)',
    sm: '0 1px 3px rgba(23, 35, 49, 0.08), 0 1px 2px rgba(23, 35, 49, 0.04)',
    md: '0 6px 16px rgba(23, 35, 49, 0.10), 0 2px 4px rgba(23, 35, 49, 0.06)',
    lg: '0 12px 32px rgba(23, 35, 49, 0.14)',
    xl: '0 20px 48px rgba(23, 35, 49, 0.18)',
  },
  focusRing: 'auto',
  cursorType: 'pointer',
  components: {
    Button: Button.extend({ defaultProps: { radius: 'sm', fw: 500 } }),
    Paper: Paper.extend({ defaultProps: { radius: 'md' } }),
    Table: Table.extend({
      defaultProps: { verticalSpacing: 7, horizontalSpacing: 'sm', fz: 'sm', highlightOnHover: true },
    }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, multiline: true, maw: 300, fz: 'xs', openDelay: 250 } }),
    Badge: Badge.extend({ defaultProps: { radius: 'xs', variant: 'light', fw: 600, tt: 'none' } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: 'xs', hideControls: true } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'xs' } }),
    Select: Select.extend({ defaultProps: { size: 'xs', allowDeselect: false, checkIconPosition: 'right' } }),
    SegmentedControl: SegmentedControl.extend({ defaultProps: { size: 'xs', radius: 'sm' } }),
    Tabs: Tabs.extend({ defaultProps: { keepMounted: false } }),
  },
})
