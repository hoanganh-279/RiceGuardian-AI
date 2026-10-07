import { RgModal } from '../layout/RgModal.jsx'
import { PhotoReviewPanel } from './PhotoReviewPanel.jsx'

export function PhotoReviewModal({ photo, onClose, onRescan, onReview }) {
  return (
    <RgModal title="Đối chiếu nhận diện" onClose={onClose} large>
      <PhotoReviewPanel photo={photo} onRescan={onRescan} onReview={onReview} />
    </RgModal>
  )
}
