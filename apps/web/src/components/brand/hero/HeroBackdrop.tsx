import styles from './hero.module.css';

export default function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-brand-teal via-[#0a3d3f] to-brand-ink" />
      <svg
        viewBox="0 0 400 400"
        className={`${styles.drift} absolute -right-1/4 -bottom-1/4 w-[110%] text-brand-mint`}
      >
        <path
          d="M 90 40 L 350 190 Q 372 204 350 218 L 90 368 Q 60 384 60 350 L 60 58 Q 60 24 90 40 Z"
          fill="currentColor"
          fillOpacity="0.07"
        />
      </svg>
      <div className="absolute -top-24 -left-24 size-80 rounded-full bg-brand-mint/15 blur-3xl" />
      <svg className="absolute inset-0 size-full text-white/5">
        <defs>
          <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 H 0 V 32" fill="none" stroke="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
    </div>
  );
}
