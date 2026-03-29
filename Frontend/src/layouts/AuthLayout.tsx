import { Outlet, Navigate } from 'react-router-dom'
import { Box, Stack, Typography } from '@mui/material'
import { useAuthContext } from '../context/AuthContext'
import { getDefaultRoute } from '../utils/formatter'

export default function AuthLayout() {
  const { isAuthenticated, user } = useAuthContext()

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultRoute(user.role)} replace />
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        // subtle grid pattern
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(67,97,238,0.06) 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 420 }}>
        {/* Logo / Brand */}
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 3,
              backgroundColor: 'primary.main',
              mb: 1.5,
            }}
          >
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
              R
            </Typography>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            ReimburseFlow
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Expense reimbursement, simplified
          </Typography>
        </Box>

        {/* Page content (Login or Signup form) */}
        <Outlet />
      </Stack>
    </Box>
  )
}