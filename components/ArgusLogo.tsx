export function ArgusLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="14" fill="#000000" />
      <circle cx="14" cy="14" r="13.5" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <path d="M14 8L21 20.5H7L14 8Z" fill="white" />
    </svg>
  )
}
