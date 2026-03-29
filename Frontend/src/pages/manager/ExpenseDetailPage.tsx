import { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Button, TextField,
  Divider, Avatar, Chip, CircularProgress, Alert, Stepper,
  Step, StepLabel, StepContent,
} from '@mui/material'
import {
  ArrowBack, CheckCircleOutline, CancelOutlined, AccessTime,
  CategoryOutlined, CalendarToday, PersonOutlined, StorefrontOutlined,
} from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/common/PageHeader'
import { StatusChip } from '../../components/common/StatusChip'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useApprovals } from '../../hooks/useApprovals'
import { useAuthContext } from '../../context/AuthContext'
import { formatAmount, formatDate, formatDateTime, getCategoryLabel } from '../../utils/formatter'

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', mt: 0.2 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
      </Box>
    </Stack>
  )
}

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const { selectedExpense, loading, actionLoading, error, fetchExpenseById, approveExpense, rejectExpense } =
    useApprovals()

  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<'approved' | 'rejected' | null>(null)

  useEffect(() => {
    if (id) fetchExpenseById(id)
  }, [id, fetchExpenseById])

  const handleApprove = async () => {
    if (!id || !user?.id) return
    setActionError(null)
    try {
      await approveExpense({ expenseId: id, approverId: user.id, comment })
      setActionSuccess('approved')
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to approve. Please try again.')
    }
  }

  const handleReject = async () => {
    if (!id || !user?.id) return
    if (!comment.trim()) {
      setActionError('A comment is required when rejecting an expense.')
      return
    }
    setActionError(null)
    try {
      await rejectExpense({ expenseId: id, approverId: user.id, comment })
      setActionSuccess('rejected')
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to reject. Please try again.')
    }
  }

  if (loading) return <LoadingSpinner fullPage />

  if (!selectedExpense) {
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>Back</Button>
        <Alert severity="warning">Expense not found.</Alert>
      </Box>
    )
  }

  const e = selectedExpense

  return (
    <Box>
      <PageHeader
        title="Expense Detail"
        breadcrumbs={[
          { label: 'Approvals', href: '/manager/approvals' },
          { label: e.vendor || e.description },
        ]}
        action={
          <Button startIcon={<ArrowBack />} onClick={() => navigate(-1)} variant="outlined" size="small">
            Back
          </Button>
        }
      />

      <Stack spacing={2.5}>
        {/* Main expense card */}
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2.5 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.25 }}>
                  {e.vendor || e.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Expense ID: {e.id}
                </Typography>
              </Box>
              <StatusChip status={e.status} size="medium" />
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Stack spacing={2} sx={{ flex: 1 }}>
                <InfoRow
                  icon={<PersonOutlined sx={{ fontSize: 18 }} />}
                  label="Submitted by (ID)"
                  value={e.employeeId}
                />
                <InfoRow
                  icon={<StorefrontOutlined sx={{ fontSize: 18 }} />}
                  label="Vendor"
                  value={e.vendor || '—'}
                />
                <InfoRow
                  icon={<CategoryOutlined sx={{ fontSize: 18 }} />}
                  label="Category"
                  value={getCategoryLabel(e.category)}
                />
                <InfoRow
                  icon={<CalendarToday sx={{ fontSize: 18 }} />}
                  label="Expense date"
                  value={formatDate(e.date)}
                />
                <InfoRow
                  icon={<AccessTime sx={{ fontSize: 18 }} />}
                  label="Submitted on"
                  value={formatDateTime(e.createdAt)}
                />
              </Stack>

              <Box
                sx={{
                  px: 3, py: 2, borderRadius: 2,
                  backgroundColor: 'primary.light',
                  textAlign: 'center', minWidth: 160, alignSelf: 'flex-start',
                }}
              >
                <Typography variant="caption" sx={{ color: 'primary.dark', fontWeight: 500 }}>
                  Amount
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.dark', mt: 0.5 }}>
                  {formatAmount(e.amount, e.currency)}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Approval timeline */}
        {e.comments.length > 0 && (
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Approval timeline
              </Typography>
              <Stepper orientation="vertical" nonLinear>
                {e.comments.map((c, i) => (
                  <Step key={i} active={false} completed>
                    <StepLabel
                      StepIconComponent={() => (
                        <Avatar
                          sx={{
                            width: 28, height: 28, fontSize: '0.75rem',
                            bgcolor: c.action === 'APPROVED' ? '#E8F8EE' : '#FDECEA',
                            color: c.action === 'APPROVED' ? '#1B7A3E' : '#9B2B22',
                            fontWeight: 700,
                          }}
                        >
                          {c.action === 'APPROVED' ? '✓' : '✗'}
                        </Avatar>
                      )}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {c.approverName}
                        </Typography>
                        <Chip
                          label={c.action === 'APPROVED' ? 'Approved' : 'Rejected'}
                          size="small"
                          sx={{
                            height: 18, fontSize: '0.68rem', fontWeight: 600,
                            backgroundColor: c.action === 'APPROVED' ? '#E8F8EE' : '#FDECEA',
                            color: c.action === 'APPROVED' ? '#1B7A3E' : '#9B2B22',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(c.timestamp)}
                        </Typography>
                      </Stack>
                    </StepLabel>
                    {c.comment && (
                      <StepContent>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          "{c.comment}"
                        </Typography>
                      </StepContent>
                    )}
                  </Step>
                ))}
              </Stepper>
            </CardContent>
          </Card>
        )}

        {/* Action card — only shown when expense is still pending */}
        {e.status !== 'APPROVED' && e.status !== 'REJECTED' && e.status !== 'CANCELLED' && (
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Your decision
              </Typography>

              {(error || actionError) && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '0.82rem' }}>
                  {actionError ?? error}
                </Alert>
              )}

              {actionSuccess ? (
                <Alert severity={actionSuccess === 'approved' ? 'success' : 'error'} sx={{ fontSize: '0.82rem' }}>
                  Expense {actionSuccess === 'approved' ? 'approved' : 'rejected'} successfully.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <TextField
                    label="Comment"
                    multiline
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    fullWidth
                    placeholder="Add a comment (required for rejection)…"
                  />
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={
                        actionLoading
                          ? <CircularProgress size={14} color="inherit" />
                          : <CheckCircleOutline />
                      }
                      disabled={actionLoading}
                      onClick={handleApprove}
                      sx={{ fontWeight: 600 }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={
                        actionLoading
                          ? <CircularProgress size={14} color="inherit" />
                          : <CancelOutlined />
                      }
                      disabled={actionLoading}
                      onClick={handleReject}
                      sx={{ fontWeight: 600 }}
                    >
                      Reject
                    </Button>
                  </Stack>
                </Stack>
              )}
            </CardContent>
          </Card>
        )}
      </Stack>
    </Box>
  )
}
