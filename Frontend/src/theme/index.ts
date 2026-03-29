import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: {
      main: '#4361EE',
      light: '#EEF1FD',
      dark: '#2D47C9',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#3ECFCF',
      light: '#EAF9F9',
      dark: '#2AABAB',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#27AE60',
      light: '#E8F8EE',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#F39C12',
      light: '#FEF6E4',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#E74C3C',
      light: '#FDECEA',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#2980B9',
      light: '#E8F4FB',
    },
    background: {
      default: '#F5F7FA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    divider: 'rgba(0,0,0,0.06)',
  },
  typography: {
    fontFamily: '"DM Sans", "Roboto", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 500, color: '#64748B' },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    button: { textTransform: 'none', fontWeight: 500 },
    caption: { color: '#94A3B8' },
  },
  shape: {
    borderRadius: 10,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.05)',
    '0 1px 4px rgba(0,0,0,0.08)',
    '0 2px 8px rgba(0,0,0,0.08)',
    '0 4px 12px rgba(0,0,0,0.08)',
    '0 4px 16px rgba(0,0,0,0.10)',
    ...Array(19).fill('none'),
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          padding: '8px 20px',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        contained: {
          '&:hover': { opacity: 0.92 },
        },
        outlined: {
          borderColor: 'rgba(0,0,0,0.12)',
          '&:hover': { borderColor: 'rgba(0,0,0,0.24)', backgroundColor: 'rgba(0,0,0,0.02)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
          borderRadius: 14,
          border: '1px solid rgba(0,0,0,0.05)',
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            backgroundColor: '#FAFBFC',
            transition: 'background 0.2s',
            '&:hover': { backgroundColor: '#F5F7FA' },
            '&.Mui-focused': { backgroundColor: '#FFFFFF' },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          borderRadius: 8,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.75rem',
          height: 24,
          borderRadius: 6,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: '#F8FAFC',
          color: '#94A3B8',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '10px 16px',
        },
        body: {
          borderBottom: '1px solid rgba(0,0,0,0.04)',
          padding: '12px 16px',
          fontSize: '0.875rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: '#FAFBFC' },
          '&:last-child td': { borderBottom: 'none' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: 'rgba(0,0,0,0.06)' },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '1px 0',
          '&.Mui-selected': {
            backgroundColor: '#EEF1FD',
            color: '#4361EE',
            '& .MuiListItemIcon-root': { color: '#4361EE' },
            '&:hover': { backgroundColor: '#E4E9FC' },
          },
        },
      },
    },
  },
})

export default theme