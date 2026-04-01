import { useState } from "react";

export default function PasswordInput({ className = "form-control", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="gc-password-field">
      <input
        {...props}
        className={className}
        type={visible ? "text" : "password"}
      />
      <button
        type="button"
        className="gc-password-field__toggle"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
      >
        <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
