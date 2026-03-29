import { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, IconButton, Divider, Alert,
  List, ListItem, ListItemText, ListItemSecondaryAction,
} from '@mui/material'
import {
  AddCircleOutline, DeleteOutline, DragIndicator,
  EditOutlined, AccountTreeOutlined,
} from '@mui/icons-material'
import { PageHeader } from '../../components/common/PageHeader'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useApprovalRules } from '../../hooks/UseApprovalRules'
import { useUsers } from '../../hooks/useUser'
import type { ApprovalRule, ApprovalConditionType, CreateApprovalRulePayload } from '../../types'
import { formatDate } from '../../utils/formatter'

const CONDITION_LABELS: Record<ApprovalConditionType, string> = {
  SEQUENTIAL: 'Sequential',
  PERCENTAGE: 'Percentage threshold',
  SPECIFIC_APPROVER: 'Specific approver',
  HYBRID: 'Hybrid (% OR specific approver)',
}

// ── Create/Edit Rule Dialog ───────────────────────────────────────────────────
function RuleDialog({
  open,
  onClose,
  onSubmit,
  loading,
  users,
  initialRule,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateApprovalRulePayload) => Promise<void>
  loading: boolean
  users: { id: string; name: string; role: string }[]
  initialRule?: ApprovalRule | null
}) {
  const [name, setName] = useState('')
  const [isManagerApprover, setIsManagerApprover] = useState(true)
  const [approvalSequence, setApprovalSequence] = useState(true)
  const [conditionType, setConditionType] = useState<ApprovalConditionType>('SEQUENTIAL')
  const [percentageThreshold, setPercentageThreshold] = useState<number>(60)
  const [specificApproverId, setSpecificApproverId] = useState('')
  const [approvers, setApprovers] = useState<{ userId: string; stepNumber: number }[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialRule) {
      setName(initialRule.name)
      setIsManagerApprover(initialRule.isManagerApprover)
      setApprovalSequence(initialRule.approvalSequence)
      setConditionType(initialRule.conditionType)
      setPercentageThreshold(initialRule.percentageThreshold ?? 60)
      setSpecificApproverId(initialRule.specificApproverId ?? '')
      setApprovers(initialRule.approvers.map((a) => ({ userId: a.userId, stepNumber: a.stepNumber })))
    } else {
      setName(''); setIsManagerApprover(true); setApprovalSequence(true)
      setConditionType('SEQUENTIAL'); setPercentageThreshold(60); setSpecificApproverId('')
      setApprovers([])
    }
    setError(null)
    setSelectedUser('')
  }, [initialRule, open])

  const addApprover = () => {
    if (!selectedUser) return
    if (approvers.find((a) => a.userId === selectedUser)) return
    setApprovers((prev) => [...prev, { userId: selectedUser, stepNumber: prev.length + 1 }])
    setSelectedUser('')
  }

  const removeApprover = (userId: string) => {
    setApprovers((prev) => {
      const filtered = prev.filter((a) => a.userId !== userId)
      return filtered.map((a, i) => ({ ...a, stepNumber: i + 1 }))
    })
  }

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) { setError('Rule name is required.'); return }
    try {
      await onSubmit({
        name,
        isManagerApprover,
        approvers,
        approvalSequence,
        conditionType,
        percentageThreshold: conditionType !== 'SEQUENTIAL' ? percentageThreshold : undefined,
        specificApproverId: (conditionType === 'SPECIFIC_APPROVER' || conditionType === 'HYBRID')
          ? specificApproverId : undefined,
      })
      onClose()
    } catch {
      setError('Failed to save rule. Please try again.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {initialRule ? 'Edit approval rule' : 'Create approval rule'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error" sx={{ fontSize: '0.82rem' }}>{error}</Alert>}

          <TextField
            label="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            placeholder="e.g. Standard Approval, High Value Expense…"
          />

          <FormControlLabel
            control={
              <Switch
                checked={isManagerApprover}
                onChange={(e) => setIsManagerApprover(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Include direct manager as first approver
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Employee's manager automatically becomes Step 0
                </Typography>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={approvalSequence}
                onChange={(e) => setApprovalSequence(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Sequential approval order
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Each approver is notified only after the previous one acts
                </Typography>
              </Box>
            }
          />

          <Divider />

          {/* Approvers list */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Approvers
            </Typography>

            {approvers.length > 0 && (
              <List dense sx={{ mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                {approvers.map((a, i) => {
                  const u = users.find((usr) => usr.id === a.userId)
                  return (
                    <ListItem key={a.userId} divider={i < approvers.length - 1}>
                      <DragIndicator sx={{ fontSize: 16, color: 'text.secondary', mr: 1 }} />
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            Step {a.stepNumber}: {u?.name ?? a.userId}
                          </Typography>
                        }
                        secondary={u?.role ?? ''}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          color="error"
                          edge="end"
                          onClick={() => removeApprover(a.userId)}
                        >
                          <DeleteOutline sx={{ fontSize: 16 }} />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  )
                })}
              </List>
            )}

            <Stack direction="row" spacing={1}>
              <FormControl sx={{ flex: 1 }} size="small">
                <InputLabel>Add approver</InputLabel>
                <Select
                  label="Add approver"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  {users
                    .filter((u) => !approvers.find((a) => a.userId === u.id))
                    .map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddCircleOutline />}
                onClick={addApprover}
                disabled={!selectedUser}
              >
                Add
              </Button>
            </Stack>
          </Box>

          <Divider />

          {/* Condition type */}
          <FormControl fullWidth>
            <InputLabel>Approval condition</InputLabel>
            <Select
              label="Approval condition"
              value={conditionType}
              onChange={(e) => setConditionType(e.target.value as ApprovalConditionType)}
            >
              {(Object.keys(CONDITION_LABELS) as ApprovalConditionType[]).map((k) => (
                <MenuItem key={k} value={k}>{CONDITION_LABELS[k]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {(conditionType === 'PERCENTAGE' || conditionType === 'HYBRID') && (
            <TextField
              label="Approval percentage threshold (%)"
              type="number"
              value={percentageThreshold}
              onChange={(e) => setPercentageThreshold(parseInt(e.target.value, 10))}
              inputProps={{ min: 1, max: 100 }}
              fullWidth
              helperText="Expense is approved when this % of approvers approve it"
            />
          )}

          {(conditionType === 'SPECIFIC_APPROVER' || conditionType === 'HYBRID') && (
            <FormControl fullWidth>
              <InputLabel>Key approver (auto-approves if they approve)</InputLabel>
              <Select
                label="Key approver (auto-approves if they approve)"
                value={specificApproverId}
                onChange={(e) => setSpecificApproverId(e.target.value)}
              >
                {users.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={loading}
          sx={{ fontWeight: 600 }}
        >
          {loading ? 'Saving…' : initialRule ? 'Save changes' : 'Create rule'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Rule Card ─────────────────────────────────────────────────────────────────
function RuleCard({
  rule,
  onEdit,
  onDelete,
}: {
  rule: ApprovalRule
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {rule.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Created {formatDate(rule.createdAt)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={onEdit}>
              <EditOutlined sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutline sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1.5, gap: 0.75 }}>
          {rule.isManagerApprover && (
            <Chip label="Manager first" size="small" color="primary" variant="outlined" />
          )}
          <Chip
            label={rule.approvalSequence ? 'Sequential' : 'Parallel'}
            size="small"
            variant="outlined"
          />
          <Chip
            label={CONDITION_LABELS[rule.conditionType]}
            size="small"
            color="secondary"
            variant="outlined"
          />
          {rule.percentageThreshold && (
            <Chip label={`${rule.percentageThreshold}% threshold`} size="small" variant="outlined" />
          )}
          {rule.specificApproverName && (
            <Chip label={`Key: ${rule.specificApproverName}`} size="small" variant="outlined" color="warning" />
          )}
        </Stack>

        {rule.approvers.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Approver sequence
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
              {rule.isManagerApprover && (
                <>
                  <Chip
                    label="Manager (Step 0)"
                    size="small"
                    sx={{ fontSize: '0.72rem', backgroundColor: '#EEF1FD', color: '#4361EE', fontWeight: 500 }}
                  />
                  <Typography variant="caption" color="text.secondary">→</Typography>
                </>
              )}
              {rule.approvers.map((a, i) => (
                <Stack key={a.userId} direction="row" alignItems="center" spacing={0.5}>
                  <Chip
                    label={`${a.userName} (Step ${a.stepNumber})`}
                    size="small"
                    sx={{ fontSize: '0.72rem', fontWeight: 500 }}
                  />
                  {i < rule.approvers.length - 1 && (
                    <Typography variant="caption" color="text.secondary">→</Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApprovalRulesPage() {
  const { rules, loading, actionLoading, fetchRules, createRule, updateRule, deleteRule } =
    useApprovalRules()
  const { users, fetchUsers } = useUsers()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null)

  useEffect(() => { fetchRules(); fetchUsers() }, [fetchRules, fetchUsers])

  const handleCreate = async (payload: CreateApprovalRulePayload) => {
    await createRule(payload)
  }

  const handleEdit = async (payload: CreateApprovalRulePayload) => {
    if (!editingRule) return
    await updateRule(editingRule.id, payload)
  }

  const openCreate = () => { setEditingRule(null); setDialogOpen(true) }
  const openEdit = (rule: ApprovalRule) => { setEditingRule(rule); setDialogOpen(true) }

  const eligibleUsers = users
    .filter((u) => u.role !== 'EMPLOYEE')
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))

  return (
    <Box>
      <PageHeader
        title="Approval Rules"
        subtitle="Configure multi-level approval workflows for expense reimbursements"
        action={
          <Button
            variant="contained"
            startIcon={<AccountTreeOutlined />}
            onClick={openCreate}
            sx={{ fontWeight: 600 }}
          >
            New rule
          </Button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : rules.length === 0 ? (
        <Card
          elevation={0}
          sx={{ border: '1px dashed', borderColor: 'divider', py: 6, textAlign: 'center' }}
        >
          <AccountTreeOutlined sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            No approval rules yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create your first rule to define how expenses get approved.
          </Typography>
          <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 600 }}>
            Create first rule
          </Button>
        </Card>
      ) : (
        <Stack spacing={2}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => openEdit(rule)}
              onDelete={() => deleteRule(rule.id)}
            />
          ))}
        </Stack>
      )}

      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={editingRule ? handleEdit : handleCreate}
        loading={actionLoading}
        users={eligibleUsers}
        initialRule={editingRule}
      />
    </Box>
  )
}
