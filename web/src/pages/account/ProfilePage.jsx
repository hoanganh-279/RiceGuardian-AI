import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { api } from '../../services/api.js'
import { FEATURES } from '../../constants/features.js'
import { ROLE_LABELS } from '../../constants/roles.js'

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

function PasswordInput({ id, label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="rg-password-field">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="form-control"
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <button
          type="button"
          className="rg-password-toggle"
          onClick={() => setShow((open) => !open)}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={show}
        >
          {show ? <EyeOpenIcon /> : <EyeClosedIcon />}
        </button>
      </div>
    </>
  )
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export default function ProfilePage() {
  const { user, applyUser } = useAuth()
  const [fullName, setFullName] = useState(user.fullName)
  const [phone, setPhone] = useState(user.phone)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    setFullName(user.fullName)
    setPhone(user.phone)
  }, [user.fullName, user.phone])

  const dirty = fullName.trim() !== (user.fullName || '') || phone.trim() !== (user.phone || '')

  const initials = useMemo(() => initialsFromName(fullName || user.fullName), [fullName, user.fullName])

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setStatus('')
    if (!dirty) return
    setSaving(true)
    try {
      const next = await api.updateProfile({ fullName: fullName.trim(), phone: phone.trim() })
      applyUser(next)
      setStatus('Đã lưu thay đổi.')
    } catch (err) {
      setError(err.message || 'Không lưu được hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setFullName(user.fullName)
    setPhone(user.phone)
    setError('')
    setStatus('')
  }

  async function handleChangePassword(event) {
    event.preventDefault()
    setModalError('')
    if (newPassword.length < 6) {
      setModalError('Mật khẩu mới cần ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setModalError('Xác nhận mật khẩu không khớp.')
      return
    }
    try {
      await api.changePassword({ oldPassword, newPassword })
      setModalOpen(false)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setStatus('Đã đổi mật khẩu.')
    } catch (err) {
      setModalError(err.message)
    }
  }

  return (
    <PageFrame title={FEATURES.A3.title} description={FEATURES.A3.description}>
      <div className="rg-profile">
        <section className="rg-profile-card">
          <div className="rg-profile-card-head">
            <div className="rg-profile-avatar" aria-hidden="true">
              {initials}
            </div>
            <div>
              <h2 className="h5 mb-1">{user.fullName}</h2>
              <p className="small text-muted mb-0">{ROLE_LABELS[user.role] || user.role}</p>
            </div>
          </div>

          {status ? (
            <div className="alert alert-success py-2" role="status">
              {status}
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSave}>
            <label className="form-label" htmlFor="fullName">
              Họ tên
            </label>
            <input
              id="fullName"
              className="form-control mb-3"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
            <label className="form-label" htmlFor="phone">
              Số điện thoại
            </label>
            <input
              id="phone"
              className="form-control mb-3"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input id="email" className="form-control mb-3" value={user.email} disabled readOnly />
            <label className="form-label" htmlFor="role">
              Vai trò
            </label>
            <input id="role" className="form-control mb-3" value={ROLE_LABELS[user.role] || user.role} disabled readOnly />
            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-rg" type="submit" disabled={!dirty || saving}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
              <button className="btn btn-light" type="button" onClick={handleReset} disabled={!dirty || saving}>
                Hủy
              </button>
            </div>
          </form>
        </section>

        <section className="rg-profile-card">
          <h2 className="h5 mb-1">Bảo mật</h2>
          <p className="small text-muted mb-3">Đổi mật khẩu đăng nhập. Cần mật khẩu hiện tại.</p>
          <button type="button" className="btn btn-rg-ghost" onClick={() => setModalOpen(true)}>
            Đổi mật khẩu
          </button>
        </section>
      </div>

      {modalOpen ? (
        <RgModal
          title="Đổi mật khẩu"
          onClose={() => {
            setModalOpen(false)
            setModalError('')
          }}
        >
          <form onSubmit={handleChangePassword}>
            <PasswordInput
              id="oldPassword"
              label="Mật khẩu hiện tại"
              value={oldPassword}
              onChange={setOldPassword}
              autoComplete="current-password"
            />
            <PasswordInput
              id="newPassword"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordInput
              id="confirmPassword"
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            {modalError ? (
              <div className="alert alert-danger py-2" role="alert">
                {modalError}
              </div>
            ) : null}
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setModalOpen(false)
                  setModalError('')
                }}
              >
                Hủy
              </button>
              <button type="submit" className="btn btn-rg">
                Cập nhật
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}
