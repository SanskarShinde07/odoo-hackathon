import { Box, CircularProgress, Typography } from '@mui/material'

interface LoadingSpinnerProps {
  message?: string
  fullPage?: boolean
}

export function LoadingSpinner({ message, fullPage = false }: LoadingSpinnerProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1.5}
      sx={
        fullPage
          ? { minHeight: '60vh' }
          : { py: 6 }
      }
    >
      <CircularProgress size={32} thickness={4} sx={{ color: 'primary.main' }} />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  )
}