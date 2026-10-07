export function RiceMark({ size = 40, variant = 'plain' }) {
  const img = (
    <img
      src="/img/logo_riceguardianai.png"
      alt="RiceGuardian AI"
      width={size}
      height={size}
      className="rg-logo-mark"
    />
  )
  if (variant === 'circle') {
    return <span className="rg-logo-circle">{img}</span>
  }
  return img
}
