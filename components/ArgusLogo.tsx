export function ArgusLogo({ size = 32, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer diamond — observation frame */}
      <path d="M16 2L30 16L16 30L2 16L16 2Z" stroke={color} strokeWidth="1.5" fill="none"/>
      {/* Inner diamond — focused center */}
      <path d="M16 10L22 16L16 22L10 16L16 10Z" fill={color}/>
    </svg>
  )
}
