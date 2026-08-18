interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showCount?: boolean;
  count?: number;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  showCount = false,
  count,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'text-sm gap-0.5',
    md: 'text-base gap-1',
    lg: 'text-2xl gap-1.5',
  };

  return (
    <div className={`inline-flex items-center ${sizeClasses[size]}`}>
      {Array.from({ length: maxStars }).map((_, idx) => {
        const starValue = idx + 1;
        const isFilled = starValue <= Math.round(rating);

        return (
          <button
            key={idx}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(starValue)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} ${
              isFilled ? 'text-amber-400' : 'text-slate-200'
            }`}
            aria-label={`${starValue} star rating`}
          >
            ★
          </button>
        );
      })}
      {showCount && (
        <span className="ml-1 text-xs font-medium text-slate-500">
          {rating.toFixed(1)} {count !== undefined && `(${count})`}
        </span>
      )}
    </div>
  );
}
