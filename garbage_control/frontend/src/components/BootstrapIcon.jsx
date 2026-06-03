import iconSprite from "bootstrap-icons/bootstrap-icons.svg";

export default function BootstrapIcon({ name, className = "", ...props }) {
  const classes = ["bi-icon", className].filter(Boolean).join(" ");

  return (
    <svg
      {...props}
      className={classes}
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`${iconSprite}#${name}`} />
    </svg>
  );
}
