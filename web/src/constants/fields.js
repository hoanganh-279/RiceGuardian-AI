export function fieldDetailPath(role, fieldId) {
  if (!fieldId) return ''
  if (role === 'manager') return `/manager/fields/${fieldId}`
  return `/technician/fields/${fieldId}`
}
