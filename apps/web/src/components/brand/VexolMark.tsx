export default function VexolMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="8.5" strokeLinecap="round">
        <path d="M18 41 30 29" opacity="0.82" />
        <path d="m31 48 29-29" />
        <path d="m51 50 21-21" />
        <path d="m42 82 40-40" />
        <path d="m27 74 13-13" opacity="0.82" />
        <path d="m77 67 6-6" opacity="0.82" />
      </g>
      <g fill="currentColor" opacity="0.82">
        <circle cx="41" cy="19" r="4.5" />
        <circle cx="19" cy="61" r="4.5" />
        <circle cx="63" cy="82" r="4.5" />
      </g>
    </svg>
  );
}
