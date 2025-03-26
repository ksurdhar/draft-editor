'use client'

interface LoaderProps {
  className?: string
}

export const Loader = ({ className }: LoaderProps) => {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/[.15] border-t-black/[.45]"></div>
    </div>
  )
}
