import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { FieldBoard } from '../../components/fields/FieldTile.jsx'
import { PageFrame } from '../../components/layout/PageFrame.jsx'
import { FeatureMeta } from '../../components/placeholders/PlaceholderChrome.jsx'
import { fieldDetailPath } from '../../constants/fields.js'
import { FEATURES } from '../../constants/features.js'
import { api } from '../../services/api.js'

export default function MapPage() {
  const { selectedOrgIds, user, isManager, isAdmin } = useAuth()
  const [features, setFeatures] = useState([])
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [uploadingFieldId, setUploadingFieldId] = useState(null)
  const canManageCover = !isManager

  useEffect(() => {
    let alive = true
    api
      .getFieldBoard(selectedOrgIds)
      .then((rows) => {
        if (alive) setFeatures(rows)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [selectedOrgIds])

  async function onCoverUpload(field, file, source) {
    setError('')
    setWarning('')
    setUploadingFieldId(field.id)
    try {
      const next = await api.uploadFieldCover(field.id, file, source)
      setFeatures((rows) => rows.map((row) => (row.id === field.id ? { ...row, ...next } : row)))
      if (next.blbWarning) setWarning(next.blbWarning)
    } catch (err) {
      setError(err.message || 'Không thể lưu ảnh.')
    } finally {
      setUploadingFieldId(null)
    }
  }

  return (
    <PageFrame
      code="D2"
      title={FEATURES.D2.title}
      description={
        isAdmin
          ? 'Toàn hệ thống. ' + FEATURES.D2.description
          : isManager
            ? 'Toàn vùng đơn vị. ' + FEATURES.D2.description
            : FEATURES.D2.description
      }
    >
      <FeatureMeta code="D2" />
      {error ? <p className="text-danger">{error}</p> : null}
      {warning ? <p className="text-warning">{warning}</p> : null}
      <div className="rg-meta mb-3">
        <span>Đỏ: nguy cơ cao</span>
        <span>Vàng: trung bình</span>
        <span>Xanh: ổn định</span>
      </div>
      <FieldBoard
        fields={features}
        showOrg
        hrefFor={(field) => fieldDetailPath(user.role, field.id)}
        canManageCover={canManageCover}
        uploadingFieldId={uploadingFieldId}
        onCoverUpload={onCoverUpload}
      />
    </PageFrame>
  )
}
