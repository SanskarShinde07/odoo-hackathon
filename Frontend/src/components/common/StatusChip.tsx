import { Chip } from '@mui/material'
import type { ExpenseStatus } from '../../types'
import { getStatusLabel, getStatusColor } from '../../utils/formatter'

interface StatusChipProps {
  status: ExpenseStatus
  size?: 'small' | 'medium'
}

export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  return (
    <Chip
      label={getStatusLabel(status)}
      color={getStatusColor(status)}
      size={size}
      sx={{
        fontWeight: 500,
        fontSize: '0.72rem',
        letterSpacing: '0.01em',
        ...(status === 'APPROVED' && {
          backgroundColor: '#E8F8EE',
          color: '#1B7A3E',
        }),
        ...(status === 'IN_REVIEW' && {
          backgroundColor: '#E8F4FB',
          color: '#1A5E85',
        }),
        ...(status === 'PENDING' && {
          backgroundColor: '#FEF6E4',
          color: '#8A5A00',
        }),
        ...(status === 'REJECTED' && {
          backgroundColor: '#FDECEA',
          color: '#9B2B22',
        }),
      }}
    />
  )
}