import type { InputHTMLAttributes } from 'react';
import './Input.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, id, className = '', ...rest }: Props) {
  const inputId = id || rest.name || label.replace(/\s+/g, '-').toLowerCase();

  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={inputId}>
      <span className="ui-field__label">{label}</span>
      <input id={inputId} className={`ui-field__input ${error ? 'is-invalid' : ''}`} {...rest} />
      {error ? <span className="ui-field__error">{error}</span> : null}
      {!error && hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}
