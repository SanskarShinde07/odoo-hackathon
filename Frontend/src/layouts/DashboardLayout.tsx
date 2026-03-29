import { useState } from 'react'
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Tooltip,
} from '@mui/material'
import {
  Menu as MenuIcon,
  ReceiptLong, History, PendingActions,
  Group, Rule, Logout,
} from '@mui/icons-material'
import { useAuthContext } from '../context/AuthContext'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'
import { getRoleLabel } from '../utils/formatter'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

const DRAWER_WIDTH = 240

// ─── Nav config per role ──────────────────────────────────────────────────────
const NAV_ITEMS: Record<UserRole, { label: string; path: string; icon: React.ReactNode }[]> = {
  EMPLOYEE: [
    { label: 'Submit Expense',  path: '/employee/submit',  icon: <ReceiptLong fontSize="small" /> },
    { label: 'My Expenses',     path: '/employee/history', icon: <History fontSize="small" /> },
  ],
  MANAGER: [
    { label: 'Pending Approvals', path: '/manager/approvals', icon: <PendingActions fontSize="small" /> },
  ],
  ADMIN: [
    { label: 'Users',           path: '/admin/users',  icon: <Group fontSize="small" /> },
    { label: 'Approval Rules',  path: '/admin/rules',  icon: <Rule fontSize="small" /> },
    // Admin can also access manager and employee views
    { label: 'Approvals',       path: '/manager/approvals', icon: <PendingActions fontSize="small" /> },
    { label: 'Submit Expense',  path: '/employee/submit',   icon: <ReceiptLong fontSize="small" /> },
  ],
}

export default function DashboardLayout() {
  const { user, isAuthenticated, isLoading } = useAuthContext()
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  const navItems = user ? NAV_ITEMS[user.role] : []

  // ── Sidebar content ────────────────────────────────────────────────────────
  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            backgroundColor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>R</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1, color: 'text.primary' }}>
            ReimburseFlow
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user ? getRoleLabel(user.role) : ''}
          </Typography>
        </Box>
      </Box>

      {/* Nav items */}
      <List sx={{ px: 1.5, pt: 2, flex: 1 }} dense>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            location.pathname.startsWith(item.path + '/')
          return (
            <ListItemButton
              key={item.path}
              selected={isActive}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              sx={{ mb: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 34, color: isActive ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          )
        })}
      </List>

      {/* User info at bottom */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: '0.8rem',
            bgcolor: 'primary.light',
            color: 'primary.main',
            fontWeight: 700,
          }}
        >
          {user?.name?.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.2 }}
            noWrap
          >
            {user?.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Logout">
          <IconButton size="small" onClick={logout} sx={{ color: 'text.secondary' }}>
            <Logout fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            borderRight: '1px solid rgba(0,0,0,0.06)',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Mobile sidebar */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          backgroundColor: 'background.default',
        }}
      >
        {/* Mobile top bar */}
        <AppBar
          position="sticky"
          color="inherit"
          elevation={0}
          sx={{
            display: { xs: 'flex', md: 'none' },
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <Toolbar>
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              ReimburseFlow
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 1100, width: '100%', mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}