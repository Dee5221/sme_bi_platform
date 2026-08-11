import './LoadingSkeleton.css';

type Props = {
  rows?: number;
};

export function LoadingSkeleton({ rows = 3 }: Props) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="ui-skeleton__row" />
      ))}
    </div>
  );
}
