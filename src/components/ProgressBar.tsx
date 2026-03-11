interface ProgressBarProps {
  value: number; // 0-100
  showLabel?: boolean;
}

export function ProgressBar({ value, showLabel = true }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, value));
  
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${percentage}%` }} />
      {showLabel && <span className="progress-label">{Math.round(percentage)}%</span>}
    </div>
  );
}
