export default function GembaLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="currentColor" opacity="0.08" />
      <path
        d="M10 16a6 6 0 0 1 12 0v3h-5v-3a1 1 0 0 0-2 0v3h-5z"
        fill="currentColor"
      />
    </svg>
  );
}
