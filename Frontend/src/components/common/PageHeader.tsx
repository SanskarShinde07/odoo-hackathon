import { Box, Typography, Breadcrumbs, Link } from '@mui/material'
import type { ReactNode } from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  action?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs sx={{ mb: 0.5 }}>
            {breadcrumbs.map((b, i) =>
              b.href && i < breadcrumbs.length - 1 ? (
                <Link
                  key={i}
                  href={b.href}
                  underline="hover"
                  color="text.secondary"
                  sx={{ fontSize: '0.8rem' }}
                >
                  {b.label}
                </Link>
              ) : (
                <Typography
                  key={i}
                  color={i === breadcrumbs.length - 1 ? 'text.primary' : 'text.secondary'}
                  sx={{ fontSize: '0.8rem' }}
                >
                  {b.label}
                </Typography>
              )
            )}
          </Breadcrumbs>
        )}

        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
          {title}
        </Typography>

        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  )
}