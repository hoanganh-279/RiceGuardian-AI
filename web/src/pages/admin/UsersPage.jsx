import { useEffect, useState } from 'react'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { RgModal } from '../../components/layout/RgModal.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { FEATURES } from '../../constants/features.js'
import { ROLE_LABELS } from '../../constants/roles.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { api } from '../../services/api.js'

const STAFF_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'technician', label: 'Kỹ thuật viên' },
]

const EMPTY_STAFF = { fullName: '', email: '', phone: '', role: 'technician' }
const EMPTY_FARMER = { fullName: '', email: '', phone: '', role: 'farmer' }

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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

function PasswordCell({ password }) {
  const [visible, setVisible] = useState(false)
  const value = String(password || '').trim()
  if (!value) {
    return <span className="text-muted">—</span>
  }
  return (
    <div className="rg-table-password">
      <span className="rg-table-password-value font-monospace">
        {visible ? value : '•'.repeat(Math.min(Math.max(value.length, 6), 12))}
      </span>
      <button
        type="button"
        className="rg-password-toggle rg-table-password-toggle"
        onClick={() => setVisible((open) => !open)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
      >
        {visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </button>
    </div>
  )
}

/**
 * @param {{ audience?: 'staff' | 'farmer' }} props
 * staff = Admin / Quản lý / KTV — farmer = tài khoản App nông dân (khách hàng)
 */
export default function UsersPage({ audience = 'staff' }) {
  const { user } = useAuth()
  const isFarmerAudience = audience === 'farmer'
  const feature = isFarmerAudience ? FEATURES.B1 : FEATURES.B1_STAFF
  const emptyForm = isFarmerAudience ? EMPTY_FARMER : EMPTY_STAFF

  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    const params = isFarmerAudience
      ? { role: 'farmer', limit: 100 }
      : { excludeRole: 'farmer', limit: 100 }
    return api.getUsers(params).then((result) => {
      const rows = result.items || []
      setItems(
        isFarmerAudience
          ? rows.filter((row) => row.role === 'farmer')
          : rows.filter((row) => row.role !== 'farmer'),
      )
    })
  }

  useEffect(() => {
    setForm(isFarmerAudience ? EMPTY_FARMER : EMPTY_STAFF)
    setStatus('')
    setError('')
    load().catch((err) => setError(err.message))
  }, [audience])

  async function handleCreate(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = isFarmerAudience ? { ...form, role: 'farmer' } : form
      const created = await api.createUser(payload)
      setOpen(false)
      setForm(emptyForm)
      const temp = created.temporaryPassword
      setStatus(
        temp
          ? `Đã tạo ${created.fullName}. Mật khẩu tạm: ${temp}`
          : `Đã tạo ${created.fullName}.`,
      )
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function runConfirm() {
    if (!confirm) return
    setError('')
    setSaving(true)
    try {
      if (confirm.kind === 'lock') {
        const result = await api.lockUser(confirm.row.id)
        setStatus(
          result.status === 'locked'
            ? `Đã khóa ${confirm.row.fullName}.`
            : `Đã mở khóa ${confirm.row.fullName}.`,
        )
      }
      if (confirm.kind === 'reset') {
        const result = await api.resetUserPassword(confirm.row.id)
        setStatus(
          result.temporaryPassword
            ? `Mật khẩu tạm của ${confirm.row.fullName}: ${result.temporaryPassword}`
            : `Đã đặt lại mật khẩu ${confirm.row.fullName}.`,
        )
      }
      if (confirm.kind === 'delete') {
        await api.deleteUser(confirm.row.id)
        setStatus(`Đã xóa ${confirm.row.fullName}.`)
      }
      setConfirm(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const emailRequired = !isFarmerAudience
  const labelFor = (row) => row.email || row.phone || row.fullName

  return (
    <PageFrame
      code={feature.code}
      title={feature.title}
      description={feature.description}
      actions={
        <button
          type="button"
          className="btn btn-rg"
          onClick={() => {
            setForm(emptyForm)
            setOpen(true)
          }}
        >
          {isFarmerAudience ? 'Tạo tài khoản nông dân' : 'Tạo tài khoản'}
        </button>
      }
    >
      <FeatureMeta code={feature.code} />
      {error ? <p className="text-danger">{error}</p> : null}
      {status ? <p className="text-success">{status}</p> : null}
      <div className="table-responsive">
        <table className="rg-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Liên hệ</th>
              {isFarmerAudience ? null : <th>Vai trò</th>}
              <th>Mật khẩu</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isFarmerAudience ? 5 : 6} className="text-muted">
                  Chưa có tài khoản trong danh sách này.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id}>
                  <td>{row.fullName}</td>
                  <td>
                    {row.email || '—'}
                    <div className="small text-muted">{row.phone}</div>
                  </td>
                  {isFarmerAudience ? null : <td>{ROLE_LABELS[row.role] || row.role}</td>}
                  <td>
                    <PasswordCell password={row.password} />
                  </td>
                  <td>{row.status === 'locked' ? 'Khóa' : 'Hoạt động'}</td>
                  <td className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setConfirm({ kind: 'lock', row })}
                    >
                      {row.status === 'locked' ? 'Mở khóa' : 'Khóa'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setConfirm({ kind: 'reset', row })}
                    >
                      Reset MK
                    </button>
                    {row.id === user?.id ? null : (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setConfirm({ kind: 'delete', row })}
                      >
                        Xóa
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {open ? (
        <RgModal
          title={isFarmerAudience ? 'Tạo tài khoản nông dân' : 'Tạo tài khoản nhân sự'}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={handleCreate}>
            <label className="form-label" htmlFor="usr-name">
              Họ tên
            </label>
            <input
              id="usr-name"
              className="form-control mb-2"
              required
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            />
            <label className="form-label" htmlFor="usr-email">
              Email {emailRequired ? '' : '(không bắt buộc với nông dân)'}
            </label>
            <input
              id="usr-email"
              type="email"
              className="form-control mb-2"
              required={emailRequired}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <label className="form-label" htmlFor="usr-phone">
              Số điện thoại
            </label>
            <input
              id="usr-phone"
              className="form-control mb-2"
              required
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            {isFarmerAudience ? (
              <p className="small text-muted mb-3">
                Tài khoản App nông dân — quản lý riêng, không lẫn với Admin / KTV / Quản lý.
              </p>
            ) : (
              <>
                <label className="form-label" htmlFor="usr-role">
                  Vai trò
                </label>
                <select
                  id="usr-role"
                  className="form-select mb-3"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                >
                  {STAFF_ROLES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <p className="small text-muted">Mật khẩu mặc định: 123456@ (hiện một lần sau khi tạo).</p>
            <div className="d-flex gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="submit" className="btn btn-rg" disabled={saving}>
                {saving ? 'Đang tạo…' : 'Tạo'}
              </button>
            </div>
          </form>
        </RgModal>
      ) : null}
      {confirm ? (
        <RgModal
          title={
            confirm.kind === 'delete'
              ? `Xóa ${labelFor(confirm.row)}?`
              : confirm.kind === 'reset'
                ? `Đặt lại mật khẩu ${labelFor(confirm.row)}?`
                : `${confirm.row.status === 'locked' ? 'Mở khóa' : 'Khóa'} ${labelFor(confirm.row)}?`
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm.kind === 'delete'
              ? 'Tài khoản sẽ bị xóa và không đăng nhập được nữa.'
              : confirm.kind === 'reset'
                ? 'Mật khẩu tạm sẽ hiện một lần sau khi xác nhận.'
                : isFarmerAudience
                  ? 'Tài khoản khóa không đăng nhập được trên app nông dân.'
                  : 'Tài khoản khóa không đăng nhập được trên website quản trị.'}
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-light" onClick={() => setConfirm(null)}>
              Hủy
            </button>
            <button
              type="button"
              className={confirm.kind === 'delete' ? 'btn btn-danger' : 'btn btn-rg'}
              disabled={saving}
              onClick={runConfirm}
            >
              {saving ? 'Đang xử lý…' : 'Xác nhận'}
            </button>
          </div>
        </RgModal>
      ) : null}
    </PageFrame>
  )
}

export function StaffUsersPage() {
  return <UsersPage audience="staff" />
}

export function FarmerUsersPage() {
  return <UsersPage audience="farmer" />
}
