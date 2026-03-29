import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, InputAdornment, IconButton,
  Link as MuiLink, Divider, Autocomplete, CircularProgress,
} from '@mui/material'
import { Visibility, VisibilityOff, PersonOutlined, EmailOutlined, LockOutlined } from '@mui/icons-material'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { CurrencyOption } from '../../types'

export default function SignupPage() {
  const { signup, loading, error } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption | null>(null)
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([])
  const [currencyLoading, setCurrencyLoading] = useState(true)

  // ── Load countries & currencies from restcountries API ────────────────────
  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies')
        const data = await res.json()
        const options: CurrencyOption[] = []

        data.forEach((country: any) => {
          if (!country.currencies) return
          Object.entries(country.currencies).forEach(([code, info]: [string, any]) => {
            // Deduplicate by currency code
            if (!options.find((o) => o.currencyCode === code)) {
              options.push({
                countryName: country.name.common,
                currencyCode: code,
                currencyName: info.name,
                currencySymbol: info.symbol ?? code,
              })
            }
          })
        })

        options.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
        setCurrencyOptions(options)

        // Default: detect Indian Rupee for Indian locale
        const inr = options.find((o) => o.currencyCode === 'INR')
        if (inr) setSelectedCurrency(inr)
      } catch {
        // Fallback: common currencies
        setCurrencyOptions([
          { countryName: 'India', currencyCode: 'INR', currencyName: 'Indian Rupee', currencySymbol: '₹' },
          { countryName: 'United States', currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$' },
          { countryName: 'European Union', currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€' },
        ])
      } finally {
        setCurrencyLoading(false)
      }
    }
    loadCountries()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCurrency) return
    await signup({
      name,
      email,
      password,
      companyName,
      country: selectedCurrency.countryName,
      currency: selectedCurrency.currencyCode,
    })
  }

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 3.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          Create your company
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          First sign-up auto-creates your company and Admin account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2.5, fontSize: '0.82rem' }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="new-password"
              helperText="Minimum 8 characters"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <VisibilityOff sx={{ fontSize: 18 }} />
                      ) : (
                        <Visibility sx={{ fontSize: 18 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* Country & Currency selector */}
            <Autocomplete
              options={currencyOptions}
              value={selectedCurrency}
              onChange={(_, val) => setSelectedCurrency(val)}
              loading={currencyLoading}
              getOptionLabel={(o) => `${o.currencyCode} – ${o.currencyName} (${o.currencySymbol})`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Company default currency"
                  required
                  helperText="All expenses will be converted to this currency"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {currencyLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.currencyCode + option.countryName}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {option.currencyCode}{' '}
                      <Typography component="span" variant="body2" color="text.secondary">
                        {option.currencySymbol}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.currencyName} · {option.countryName}
                    </Typography>
                  </Box>
                </Box>
              )}
              isOptionEqualToValue={(o, v) => o.currencyCode === v.currencyCode}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !selectedCurrency}
              sx={{ mt: 0.5, py: 1.1, fontWeight: 600 }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 2.5 }} />

        <Typography variant="body2" color="text.secondary" textAlign="center">
          Already have an account?{' '}
          <MuiLink component={Link} to="/login" underline="hover" sx={{ fontWeight: 600 }}>
            Sign in
          </MuiLink>
        </Typography>
      </CardContent>
    </Card>
  )
}
