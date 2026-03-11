import { useState } from 'react';
import type { ReviewRating } from '../types';

interface RevisionModalProps {
  topicName: string;
  examName?: string;
  onClose: () => void;
  onComplete: (rating: ReviewRating) => void;
}

export function RevisionModal({ topicName, examName, onClose, onComplete }: RevisionModalProps) {
  const [isReviewing, setIsReviewing] = useState(true);

  const handleRating = (rating: ReviewRating) => {
    onComplete(rating);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {isReviewing ? (
          <>
            <h2>Revision Session</h2>
            {examName && <p className="exam-name">{examName}</p>}
            <h3>{topicName}</h3>
            <p className="instruction">Review your notes and materials for this topic.</p>
            <button onClick={() => setIsReviewing(false)}>Finish Session</button>
            <button onClick={onClose} className="secondary">Cancel</button>
          </>
        ) : (
          <>
            <h2>How did this topic feel?</h2>
            <h3>{topicName}</h3>
            <div className="rating-buttons">
              <button onClick={() => handleRating('again')} className="rating-again">
                Again
                <span>Need to review soon</span>
              </button>
              <button onClick={() => handleRating('hard')} className="rating-hard">
                Hard
                <span>Difficult but manageable</span>
              </button>
              <button onClick={() => handleRating('good')} className="rating-good">
                Good
                <span>Comfortable with this</span>
              </button>
              <button onClick={() => handleRating('easy')} className="rating-easy">
                Easy
                <span>Very confident</span>
              </button>
            </div>
            <button onClick={onClose} className="secondary">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
