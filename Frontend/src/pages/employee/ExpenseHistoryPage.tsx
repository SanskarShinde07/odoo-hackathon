import { useEffect, useState } from 'react'
import {
  Box, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Stack, Tabs, Tab,
  Collapse, IconButton, Chip, Tooltip, LinearProgress,
} from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowUp, Receipt } from '@mui/icons-material'
import { PageHeader } from '../../components/common/PageHeader'
import { StatusChip } from '../../components/common/StatusChip'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useExpenses } from '../../hooks/useExpenses'
import type { Expense, ExpenseStatus } from '../../types'
import { formatAmount, formatDate, getCategoryLabel } from '../../utils/formatter'

const STATUS_TABS: { label: string; value: ExpenseStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'In Review', value: 'IN_REVIEW' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
]

function ApprovalStepProgress({ expense }: { expense: Expense }) {
  const pct =
    expense.totalApproverSteps > 0
      ? (expense.currentApproverStep / expense.totalApproverSteps) * 100
      : 0

  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary">
        Step {expense.currentApproverStep} / {expense.totalApproverSteps}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          mt: 0.5,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(0,0,0,0.06)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            backgroundColor:
              expense.status === 'APPROVED'
                ? '#27AE60'
                : expense.status === 'REJECTED'
                ? '#E74C3C'
                : '#4361EE',
          },
        }}
      />
    </Box>
  )
}

function CommentRow({ expense, open }: { expense: Expense; open: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ py: 0, border: 'none' }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ px: 2, py: 1.5, backgroundColor: '#FAFBFC', borderRadius: 1, mb: 0.5 }}>
            {expense.comments.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No approver comments yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {expense.comments.map((c, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Chip
                      label={c.action === 'APPROVED' ? '✓' : '✗'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: c.action === 'APPROVED' ? '#E8F8EE' : '#FDECEA',
                        color: c.action === 'APPROVED' ? '#1B7A3E' : '#9B2B22',
                      }}
                    />
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {c.approverName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        · Step {c.step} · {formatDate(c.timestamp)}
                      </Typography>
                      {c.comment && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {c.comment}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  )
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {formatDate(expense.date)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getCategoryLabel(expense.category)}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
            {expense.description}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatAmount(expense.amount, expense.currency)}
          </Typography>
          {expense.currency !== expense.companyCurrency && (
            <Typography variant="caption" color="text.secondary">
              ≈ {formatAmount(expense.amountInCompanyCurrency, expense.companyCurrency)}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <StatusChip status={expense.status} />
        </TableCell>
        <TableCell>
          <ApprovalStepProgress expense={expense} />
        </TableCell>
        <TableCell>
          {expense.receiptUrl ? (
            <Tooltip title="View receipt">
              <IconButton size="small" href={expense.receiptUrl} target="_blank">
                <Receipt fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Typography variant="caption" color="text.secondary">
              —
            </Typography>
          )}
        </TableCell>
      </TableRow>
      <CommentRow expense={expense} open={open} />
    </>
  )
}

export default function ExpenseHistoryPage() {
  const { expenses, loading, fetchMyExpenses } = useExpenses()
  const [activeTab, setActiveTab] = useState<ExpenseStatus | 'ALL'>('ALL')

  useEffect(() => {
    fetchMyExpenses()
  }, [fetchMyExpenses])

  const filtered =
    activeTab === 'ALL' ? expenses : expenses.filter((e) => e.status === activeTab)

  // Summary stats
  const approved = expenses.filter((e) => e.status === 'APPROVED').length
  const pending = expenses.filter((e) => e.status === 'PENDING' || e.status === 'IN_REVIEW').length
  const rejected = expenses.filter((e) => e.status === 'REJECTED').length

  return (
    <Box>
      <PageHeader title="My Expenses" subtitle="Track all your submitted expense claims" />

      {/* Quick stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: expenses.length, color: '#4361EE', bg: '#EEF1FD' },
          { label: 'Approved', value: approved, color: '#27AE60', bg: '#E8F8EE' },
          { label: 'Pending', value: pending, color: '#F39C12', bg: '#FEF6E4' },
          { label: 'Rejected', value: rejected, color: '#E74C3C', bg: '#FDECEA' },
        ].map((s) => (
          <Card
            key={s.label}
            elevation={0}
            sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: 'divider', minWidth: 80 }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, color: s.color }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
          </Card>
        ))}
      </Stack>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {/* Filter tabs */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            textColor="primary"
            indicatorColor="primary"
          >
            {STATUS_TABS.map((tab) => (
              <Tab
                key={tab.value}
                label={tab.label}
                value={tab.value}
                sx={{ fontSize: '0.8rem', minHeight: 44, fontWeight: 500 }}
              />
            ))}
          </Tabs>
        </Box>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              No expenses found for this filter.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell>Date / Category</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Approval</TableCell>
                  <TableCell>Receipt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((expense) => (
                  <ExpenseRow key={expense.id} expense={expense} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  )
}
