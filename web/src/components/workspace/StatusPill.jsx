const TONE_CLASS = {
  success: 'rg-status-pill--success',
  warning: 'rg-status-pill--warning',
  danger: 'rg-status-pill--danger',
  muted: 'rg-status-pill--muted',
  info: 'rg-status-pill--info',
}

export function StatusPill({ children, tone = 'muted' }) {
  return <span className={`rg-status-pill ${TONE_CLASS[tone] || TONE_CLASS.muted}`}>{children}</span>
}
