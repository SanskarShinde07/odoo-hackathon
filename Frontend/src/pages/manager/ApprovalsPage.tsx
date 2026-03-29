import { useEffect } from 'react'
import {
  Box, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Stack, Button, Chip, Avatar,
} from '@mui/material'
import { CheckCircleOutline, CancelOutlined, ArrowForward } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/common/PageHeader'
import { StatusChip } from '../../components/common/StatusChip'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useApprovals } from '../../hooks/useApprovals'
import { useAuthContext } from '../../context/AuthContext'
import type { Expense } from '../../types'
import { formatAmount, formatDate, getCategoryLabel } from '../../utils/formatter'

function ApproverStepBadge({ current, total }: { current: number; total: number }) {
  return (
    <Chip
      label={`Step ${current} of ${total}`}
      size="small"
      sx={{
        backgroundColor: '#EEF1FD',
        color: '#4361EE',
        fontWeight: 600,
        fontSize: '0.72rem',
      }}
    />
  )
}

function EmployeeAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#4361EE', '#3ECFCF', '#E74C3C', '#F39C12', '#27AE60']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <Avatar sx={{ width: 28, height: 28, fontSize: '0.72rem', fontWeight: 700, bgcolor: color + '22', color }}>
      {initials}
    </Avatar>
  )
}

function ApprovalRow({ expense, onApprove, onReject }: {
  expense: Expense
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const navigate = useNavigate()
  return (
    <TableRow sx={{ cursor: 'pointer' }} onClick={() => navigate(`/manager/approvals/${expense.id}`)}>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EmployeeAvatar name={expense.employeeName} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {expense.vendor || expense.employeeName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(expense.date)}
            </Typography>
          </Box>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{getCategoryLabel(expense.category)}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 160, display: 'block' }}>
          {expense.description}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatAmount(expense.amountInCompanyCurrency, expense.companyCurrency)}
        </Typography>
        {expense.currency !== expense.companyCurrency && (
          <Typography variant="caption" color="text.secondary">
            {formatAmount(expense.amount, expense.currency)}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <StatusChip status={expense.status} />
      </TableCell>
      <TableCell>
        <ApproverStepBadge current={expense.currentApproverStep} total={expense.totalApproverSteps} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Stack direction="row" spacing={0.75}>
          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
            onClick={() => onApprove(expense.id)}
            sx={{ fontSize: '0.75rem', py: 0.4, px: 1 }}
          >
            Approve
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<CancelOutlined sx={{ fontSize: 14 }} />}
            onClick={() => onReject(expense.id)}
            sx={{ fontSize: '0.75rem', py: 0.4, px: 1 }}
          >
            Reject
          </Button>
          <Button
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={() => navigate(`/manager/approvals/${expense.id}`)}
            sx={{ fontSize: '0.75rem', py: 0.4, px: 1, color: 'text.secondary' }}
          >
            Detail
          </Button>
        </Stack>
      </TableCell>
    </TableRow>
  )
}

export default function ApprovalsPage() {
  const { user } = useAuthContext()
  const { pendingApprovals, loading, fetchPendingApprovals, approveExpense, rejectExpense } =
    useApprovals()

  useEffect(() => {
    fetchPendingApprovals()
  }, [fetchPendingApprovals])

  // Quick-action approve from the list (no comment required for approval)
  const handleApprove = async (id: string) => {
    if (!user?.id) return
    await approveExpense({ expenseId: id, approverId: user.id, comment: '' })
  }

  // Quick-action reject prompts for comment via browser prompt (full form is on detail page)
  const handleReject = async (id: string) => {
    if (!user?.id) return
    const comment = window.prompt('Rejection reason (required):')
    if (!comment?.trim()) return   // user cancelled or left blank
    await rejectExpense({ expenseId: id, approverId: user.id, comment })
  }

  return (
    <Box>
      <PageHeader
        title="Pending Approvals"
        subtitle="Review and act on expense claims awaiting your decision"
      />

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card elevation={0} sx={{ px: 2.5, py: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#4361EE' }}>
            {pendingApprovals.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Awaiting action</Typography>
        </Card>
        <Card elevation={0} sx={{ px: 2.5, py: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#F39C12' }}>
            {pendingApprovals.filter(
              (e) => new Date(e.createdAt) > new Date(Date.now() - 7 * 86400000)
            ).length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Submitted this week</Typography>
        </Card>
        <Card elevation={0} sx={{ px: 2.5, py: 2, flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#27AE60' }}>
            {[...new Set(pendingApprovals.map((e) => e.employeeId))].length}
          </Typography>
          <Typography variant="body2" color="text.secondary">Team members</Typography>
        </Card>
      </Stack>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {loading ? (
          <LoadingSpinner />
        ) : pendingApprovals.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CheckCircleOutline sx={{ fontSize: 40, color: '#27AE60', mb: 1 }} />
            <Typography variant="body1" sx={{ fontWeight: 600 }}>All caught up!</Typography>
            <Typography variant="body2" color="text.secondary">
              No expenses waiting for your approval.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor / Employee</TableCell>
                  <TableCell>Category / Description</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approval step</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingApprovals.map((expense) => (
                  <ApprovalRow
                    key={expense.id}
                    expense={expense}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  )
}
