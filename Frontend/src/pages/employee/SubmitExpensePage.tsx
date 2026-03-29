import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Select, MenuItem, FormControl, InputLabel, FormHelperText,
  Alert, Snackbar, Stack, Divider, IconButton, Chip,
  CircularProgress, Tooltip, LinearProgress,
} from '@mui/material'
import {
  AttachFile, DocumentScanner, Close, CurrencyExchange, CheckCircle,
} from '@mui/icons-material'
import { PageHeader } from '../../components/common/PageHeader'
import { useExpenses } from '../../hooks/useExpenses'
import { useAuthContext } from '../../context/AuthContext'
import { useApprovalRules } from '../../hooks/UseApprovalRules'
import { api, ocrApi, extractError } from '../../utils/api'
import type { OcrResult } from '../../types'
import { getCategoryLabel } from '../../utils/formatter'

// Categories accepted by the approval engine (plain strings, not uppercase enum)
const CATEGORIES = [
  { value: 'Travel',          label: 'Travel' },
  { value: 'Food',            label: 'Food & Beverage' },
  { value: 'Accommodation',   label: 'Accommodation' },
  { value: 'Office Supplies', label: 'Office Supplies' },
  { value: 'Entertainment',   label: 'Entertainment' },
  { value: 'Miscellaneous',   label: 'Miscellaneous' },
]

const COMMON_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD']

// Map common ISO currency codes → country name for the OCR engine
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  INR: 'India', USD: 'United States', EUR: 'Germany', GBP: 'United Kingdom',
  AED: 'UAE', SGD: 'Singapore', JPY: 'Japan', AUD: 'Australia', CAD: 'Canada',
}

export default function SubmitExpensePage() {
  const { user, company } = useAuthContext()
  const { submitExpense, submitting, error } = useExpenses()
  const { rules, fetchRules } = useApprovalRules()
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [category, setCategory] = useState('')
  const [ruleId, setRuleId] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // ── OCR state ──────────────────────────────────────────────────────────────
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([])
  const [ocrDone, setOcrDone] = useState(false)

  // ── Exchange rate state ────────────────────────────────────────────────────
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [rateLoading, setRateLoading] = useState(false)

  const companyCurrency = company?.currencyCode ?? 'INR'
  const companyCountry  = company?.country ?? 'India'

  // Load rules on mount
  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // Auto-select first rule when rules load
  useEffect(() => {
    if (rules.length > 0 && !ruleId) setRuleId(rules[0].id)
  }, [rules, ruleId])

  // ── Fetch exchange rate from main backend when currency changes ────────────
  // GET /api/currency/convert?amount=1&from={currency}&to={companyCurrency}
  useEffect(() => {
    if (currency === companyCurrency) { setExchangeRate(null); return }
    let cancelled = false
    const fetchRate = async () => {
      setRateLoading(true)
      try {
        const res = await api.get('/api/currency/convert', {
          params: { amount: 1, from: currency, to: companyCurrency },
        })
        if (!cancelled) setExchangeRate(res.data.rate ?? null)
      } catch {
        if (!cancelled) setExchangeRate(null)
      } finally {
        if (!cancelled) setRateLoading(false)
      }
    }
    fetchRate()
    return () => { cancelled = true }
  }, [currency, companyCurrency])

  const convertedAmount =
    exchangeRate && amount ? (parseFloat(amount) * exchangeRate).toFixed(2) : null

  // ── OCR: POST /process-receipt to OCR engine ──────────────────────────────
  const handleOcr = useCallback(async () => {
    if (!receiptFile) return
    setOcrLoading(true)
    setOcrWarnings([])
    setOcrDone(false)
    try {
      const formData = new FormData()
      formData.append('file', receiptFile)
      formData.append('bill_country', CURRENCY_TO_COUNTRY[currency] ?? 'United States')
      formData.append('company_country', companyCountry)
      if (category) formData.append('category', category)

      const res = await ocrApi.post<OcrResult>('/process-receipt', formData)
      const ocr = res.data

      // Auto-fill fields from OCR result — only overwrite if confident / non-null
      if (ocr.vendor)                               setVendor(ocr.vendor)
      if (ocr.amount?.original != null)             setAmount(String(ocr.amount.original))
      if (ocr.amount?.currency)                     setCurrency(ocr.amount.currency)
      if (ocr.category)                             setCategory(ocr.category)

      setOcrWarnings(ocr.warnings ?? [])
      setOcrDone(true)
    } catch (err: any) {
      setOcrWarnings([extractError(err)])
    } finally {
      setOcrLoading(false)
    }
  }, [receiptFile, currency, companyCountry, category])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setReceiptFile(file)
    setOcrDone(false)
    setOcrWarnings([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ruleId) return
    try {
      await submitExpense({
        vendor,
        amount: parseFloat(amount),
        currency,
        category,
        ruleId,
        receiptFile: receiptFile ?? undefined,
      })
      // Reset form on success
      setVendor('')
      setAmount('')
      setCurrency('INR')
      setCategory('')
      setReceiptFile(null)
      setOcrDone(false)
      setOcrWarnings([])
    } catch {
      // error is displayed via useExpenses.error
    }
  }

  const [success, setSuccess] = useState(false)
  useEffect(() => {
    if (!submitting && !error && vendor === '') {
      // form was reset = success path (rough heuristic)
    }
  }, [submitting])

  return (
    <Box>
      <PageHeader
        title="Submit Expense"
        subtitle={`Hello ${user?.name ?? 'there'} — fill in the details to submit a reimbursement claim.`}
      />

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 660 }}>
        <CardContent sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, fontSize: '0.82rem' }}>{error}</Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.5}>

              {/* Vendor */}
              <TextField
                label="Vendor / Merchant name"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
                fullWidth
                placeholder="e.g. Starbucks, Uber, Hotel Grand"
              />

              {/* Amount + Currency */}
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  inputProps={{ min: 0, step: '0.01' }}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ minWidth: 110 }}>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {COMMON_CURRENCIES.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {/* Exchange rate info (live from main backend) */}
              {rateLoading && <LinearProgress sx={{ borderRadius: 1 }} />}
              {convertedAmount && exchangeRate && !rateLoading && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1.5, py: 1, borderRadius: 2, backgroundColor: 'info.light',
                }}>
                  <CurrencyExchange sx={{ fontSize: 16, color: 'info.main' }} />
                  <Typography variant="caption" sx={{ color: 'info.main', fontWeight: 500 }}>
                    ≈ {companyCurrency} {convertedAmount} at rate {exchangeRate} (live)
                  </Typography>
                </Box>
              )}

              {/* Category */}
              <FormControl required fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>Select the expense category</FormHelperText>
              </FormControl>

              {/* Approval rule */}
              

              <Divider />

              {/* Receipt upload + OCR */}
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  Receipt{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    (optional — upload to auto-fill via OCR)
                  </Typography>
                </Typography>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
                  hidden
                  onChange={handleFileChange}
                />

                {receiptFile ? (
                  <Stack spacing={1}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1,
                      px: 1.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2,
                    }}>
                      <AttachFile sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ flex: 1 }} noWrap>
                        {receiptFile.name}
                      </Typography>
                      {ocrDone && (
                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                      <Tooltip title="Scan receipt with AI OCR">
                        <span>
                          <IconButton
                            size="small"
                            onClick={handleOcr}
                            disabled={ocrLoading}
                            sx={{ color: 'primary.main' }}
                          >
                            {ocrLoading
                              ? <CircularProgress size={16} />
                              : <DocumentScanner fontSize="small" />
                            }
                          </IconButton>
                        </span>
                      </Tooltip>
                      <IconButton size="small" onClick={() => setReceiptFile(null)}>
                        <Close fontSize="small" />
                      </IconButton>
                    </Box>

                    {ocrLoading && (
                      <Typography variant="caption" color="text.secondary">
                        Scanning receipt with AI — fields will be auto-filled…
                      </Typography>
                    )}
                    {ocrDone && !ocrLoading && (
                      <Alert severity="success" sx={{ fontSize: '0.78rem', py: 0.5 }}>
                        OCR complete — fields auto-filled. Review and adjust if needed.
                      </Alert>
                    )}
                    {ocrWarnings.map((w, i) => (
                      <Alert key={i} severity="warning" sx={{ fontSize: '0.78rem', py: 0.5 }}>
                        {w}
                      </Alert>
                    ))}
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AttachFile />}
                      onClick={() => fileRef.current?.click()}
                    >
                      Attach receipt
                    </Button>
                    <Chip
                      label="AI OCR auto-fill"
                      size="small"
                      color="primary"
                      variant="outlined"
                      icon={<DocumentScanner />}
                      onClick={() => fileRef.current?.click()}
                      sx={{ cursor: 'pointer' }}
                    />
                  </Stack>
                )}
              </Box>

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={submitting || !ruleId}
                sx={{ py: 1.1, fontWeight: 600 }}
              >
                {submitting ? 'Submitting…' : 'Submit expense'}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={success}
        autoHideDuration={4000}
        onClose={() => setSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess(false)} sx={{ fontWeight: 500 }}>
          Expense submitted! It's now in the approval queue.
        </Alert>
      </Snackbar>
    </Box>
  )
}
