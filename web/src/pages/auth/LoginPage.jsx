import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { RiceMark } from '../../components/RiceMark.jsx'
import { homePath } from '../../components/layout/navConfig.js'

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M3.5 9.2c4.2 6.2 12.8 6.2 17 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M8 13.1v2.35M12 14.15v2.55M16 13.1v2.35"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M3.5 14.8c4.2-6.2 12.8-6.2 17 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.15" r="3.15" fill="currentColor" />
      <circle cx="13.15" cy="15.05" r="0.85" fill="#fff" />
    </svg>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const result = await login({ identifier, password })
      navigate(homePath(result.user.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Không đăng nhập được.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rg-login">
      <section className="rg-login-hero" aria-hidden="true">
        <div className="rg-login-hero-copy">
          <h2 className="rg-display display-5 mb-0">Nền tảng AI đa phương thức giám sát, dự báo sớm bệnh hại và quản lý canh tác lúa thông minh.</h2>
          <p>Nền tảng dự báo sớm cho hợp tác xã, doanh nghiệp và kỹ thuật viên ngoài hiện trường.</p>
        </div>
      </section>
      <section className="rg-login-panel">
        <div className="rg-brand-mark rg-brand-mark--panel">
          <RiceMark size={150} />
          <span>RiceGuardian AI</span>
        </div>
        <p className="text-uppercase small mb-2" style={{ letterSpacing: '0.14em', color: 'var(--rg-primary-dark)' }}>
          Website quản trị
        </p>
        <p className="lead">Đăng nhập bằng email hoặc số điện thoại để vào không gian làm việc của bạn.</p>
        <form onSubmit={handleSubmit}>
          <label className="form-label" htmlFor="identifier">
            Email hoặc số điện thoại
          </label>
          <input
            id="identifier"
            className="form-control mb-3"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <label className="form-label" htmlFor="password">
            Mật khẩu
          </label>
          <div className="rg-password-field">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="rg-password-toggle"
              onClick={() => setShowPassword((open) => !open)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
            </button>
          </div>
          {error ? (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          ) : null}
          <button className="btn btn-rg w-100 py-2" type="submit" disabled={pending}>
            {pending ? 'Đang xác thực danh tính…' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </div>
  )
}
