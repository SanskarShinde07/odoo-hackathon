import { useEffect, useState } from 'react'
import {
  Box, Card, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, Stack, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, Avatar, Alert,
} from '@mui/material'
import {
  PersonAddAlt, EditOutlined, DeleteOutline, SwapHoriz,
} from '@mui/icons-material'
import { PageHeader } from '../../components/common/PageHeader'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useUsers } from '../../hooks/useUser'
import type { User, UserRole, CreateUserPayload } from '../../types'
import { formatDate, getRoleLabel, getRoleColor } from '../../utils/formatter'

// ── Create User Dialog ────────────────────────────────────────────────────────
function CreateUserDialog({
  open,
  onClose,
  onSubmit,
  managers,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateUserPayload) => Promise<void>
  managers: User[]
  loading: boolean
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('EMPLOYEE')
  const [managerId, setManagerId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName(''); setEmail(''); setPassword(''); setRole('EMPLOYEE'); setManagerId(''); setError(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    setError(null)
    try {
      await onSubmit({ name, email, password, role, managerId: managerId || undefined })
      handleClose()
    } catch {
      setError('Failed to create user. Please try again.')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add new user</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error" sx={{ fontSize: '0.82rem' }}>{error}</Alert>}
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required />
          <TextField
            label="Temporary password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <MenuItem value="EMPLOYEE">Employee</MenuItem>
              <MenuItem value="MANAGER">Manager</MenuItem>
            </Select>
          </FormControl>
          {role === 'EMPLOYEE' && managers.length > 0 && (
            <FormControl fullWidth>
              <InputLabel>Assign manager</InputLabel>
              <Select
                label="Assign manager"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <MenuItem value="">— None —</MenuItem>
                {managers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={loading || !name || !email || !password}
          sx={{ fontWeight: 600 }}
        >
          {loading ? 'Creating…' : 'Create user'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Change Role Dialog ────────────────────────────────────────────────────────
function ChangeRoleDialog({
  user,
  open,
  onClose,
  onSubmit,
  loading,
}: {
  user: User | null
  open: boolean
  onClose: () => void
  onSubmit: (userId: string, role: UserRole) => Promise<void>
  loading: boolean
}) {
  const [role, setRole] = useState<UserRole>('EMPLOYEE')

  useEffect(() => {
    if (user) setRole(user.role)
  }, [user])

  const handleSubmit = async () => {
    if (!user) return
    await onSubmit(user.id, role)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Change role</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Updating role for <strong>{user?.name}</strong>
        </Typography>
        <FormControl fullWidth>
          <InputLabel>New role</InputLabel>
          <Select label="New role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <MenuItem value="EMPLOYEE">Employee</MenuItem>
            <MenuItem value="MANAGER">Manager</MenuItem>
          </Select>
        </FormControl>
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
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Assign Manager Dialog ─────────────────────────────────────────────────────
function AssignManagerDialog({
  employee,
  managers,
  open,
  onClose,
  onSubmit,
  loading,
}: {
  employee: User | null
  managers: User[]
  open: boolean
  onClose: () => void
  onSubmit: (employeeId: string, managerId: string) => Promise<void>
  loading: boolean
}) {
  const [managerId, setManagerId] = useState('')

  useEffect(() => {
    if (employee) setManagerId(employee.managerId ?? '')
  }, [employee])

  const handleSubmit = async () => {
    if (!employee || !managerId) return
    await onSubmit(employee.id, managerId)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Assign manager</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a manager for <strong>{employee?.name}</strong>
        </Typography>
        <FormControl fullWidth>
          <InputLabel>Manager</InputLabel>
          <Select label="Manager" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <MenuItem value="">— None —</MenuItem>
            {managers.map((m) => (
              <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" size="small">Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          size="small"
          disabled={loading || !managerId}
          sx={{ fontWeight: 600 }}
        >
          {loading ? 'Saving…' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { users, loading, actionLoading, fetchUsers, createUser, updateUserRole, assignManager, deleteUser } =
    useUsers()

  const [createOpen, setCreateOpen] = useState(false)
  const [roleUser, setRoleUser] = useState<User | null>(null)
  const [managerEmployee, setManagerEmployee] = useState<User | null>(null)

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const managers = users.filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN')
  const employees = users.filter((u) => u.role === 'EMPLOYEE')

  function userInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle={`${users.length} team member${users.length !== 1 ? 's' : ''} in your company`}
        action={
          <Button
            variant="contained"
            startIcon={<PersonAddAlt />}
            onClick={() => setCreateOpen(true)}
            sx={{ fontWeight: 600 }}
          >
            Add user
          </Button>
        }
      />

      {/* Stats */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: users.length },
          { label: 'Managers', value: managers.length },
          { label: 'Employees', value: employees.length },
        ].map((s) => (
          <Card key={s.label} elevation={0} sx={{ px: 2, py: 1.5, flex: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Card>
        ))}
      </Stack>

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Reports to</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            bgcolor: 'primary.light',
                            color: 'primary.main',
                          }}
                        >
                          {userInitials(user.name)}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {user.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleLabel(user.role)}
                        color={getRoleColor(user.role)}
                        size="small"
                        sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      {user.managerName ? (
                        <Typography variant="body2">{user.managerName}</Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(user.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        {user.role !== 'ADMIN' && (
                          <>
                            <Tooltip title="Change role">
                              <IconButton size="small" onClick={() => setRoleUser(user)}>
                                <EditOutlined sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            {user.role === 'EMPLOYEE' && (
                              <Tooltip title="Assign manager">
                                <IconButton size="small" onClick={() => setManagerEmployee(user)}>
                                  <SwapHoriz sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Delete user">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => deleteUser(user.id)}
                              >
                                <DeleteOutline sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createUser}
        managers={managers}
        loading={actionLoading}
      />
      <ChangeRoleDialog
        user={roleUser}
        open={!!roleUser}
        onClose={() => setRoleUser(null)}
        onSubmit={updateUserRole}
        loading={actionLoading}
      />
      <AssignManagerDialog
        employee={managerEmployee}
        managers={managers}
        open={!!managerEmployee}
        onClose={() => setManagerEmployee(null)}
        onSubmit={assignManager}
        loading={actionLoading}
      />
    </Box>
  )
}
