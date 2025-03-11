'use client'
import { ReactNode, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Custom TypewriterText component for the typewriter effect
const TypewriterText = ({ text, className }: { text: string; className: string }) => {
  const [displayText, setDisplayText] = useState(text) // Initialize with full text
  const [key, setKey] = useState(0)
  const isInitialRender = useRef(true)
  const prevTextRef = useRef(text)

  useEffect(() => {
    // On initial render, show the full text immediately (no animation)
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    // Skip animation if it's just a document navigation (from tree)
    // Only animate when the text actually changes from user edits
    if (prevTextRef.current === text) {
      return
    }

    // Save current text for future comparison
    prevTextRef.current = text

    // Reset and start new animation when text changes from edits
    setDisplayText('')
    setKey(prev => prev + 1)

    let index = 0
    const interval = setInterval(() => {
      setDisplayText(text.substring(0, index + 1))
      index++

      if (index >= text.length) {
        clearInterval(interval)
      }
    }, 15) // Character typing speed

    return () => clearInterval(interval)
  }, [text])

  return (
    <span key={key} className={className}>
      {displayText}
      {displayText.length < text.length && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, duration: 0.5 }}>
          |
        </motion.span>
      )}
    </span>
  )
}

interface ListItemProps {
  leftIcon?: ReactNode
  rightContent?: ReactNode
  label: string
  depth?: number
  isSelected?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  children?: ReactNode
  isExpanded?: boolean
  theme?: 'light' | 'dark'
  containerProps?: React.HTMLAttributes<HTMLLIElement>
  itemContainerProps?: React.HTMLAttributes<HTMLDivElement>
  showSelectedStyles?: boolean
}

export const ListItem = ({
  leftIcon,
  rightContent,
  label,
  depth = 0,
  isSelected = false,
  onClick,
  onDoubleClick,
  children,
  isExpanded,
  theme = 'light',
  containerProps = {},
  itemContainerProps = {},
  showSelectedStyles = true,
}: ListItemProps) => {
  const [hasRecentClick, setHasRecentClick] = useState(false)

  // Handle single click
  const handleSingleClick = () => {
    console.log('CLICK EVENT DETECTED')

    // If we've already handled a double-click recently, ignore this click
    if (hasRecentClick) return

    // If there's a double-click, the browser will call onDoubleClick instead
    // and this will be canceled by setting hasRecentClick
    setTimeout(() => {
      if (!hasRecentClick) {
        console.log('✅ SINGLE CLICK CONFIRMED')
        if (onClick) onClick()
      }
      setHasRecentClick(false)
    }, 10) // Very small delay to let double-click be detected first if it's coming
  }

  // Handle native double-click event
  const handleDoubleClick = () => {
    console.log('🔥 NATIVE DOUBLE CLICK DETECTED')
    setHasRecentClick(true)

    if (onDoubleClick) {
      onDoubleClick()
    }

    // Reset after a short time
    setTimeout(() => {
      setHasRecentClick(false)
    }, 300)
  }

  const getThemeClasses = () => {
    if (theme === 'light') {
      return {
        hover: 'hover:bg-white/[.2]',
        selected: showSelectedStyles ? '!bg-white/[.25]' : '',
        text: 'text-black/[.70]',
      }
    }
    return {
      hover: 'hover:bg-black/[.05]',
      selected: showSelectedStyles ? '!bg-black/[.07]' : '',
      text: 'text-black/[.70]',
    }
  }

  const themeClasses = getThemeClasses()

  return (
    <li className="group list-none" {...containerProps}>
      <div
        onClick={handleSingleClick}
        onDoubleClick={handleDoubleClick}
        className={`flex items-center justify-between px-2 py-1.5 ${themeClasses.hover} cursor-pointer rounded-lg ${
          isSelected ? themeClasses.selected : ''
        }`}
        style={{
          paddingLeft: `${(depth + 1) * 20}px`,
          transition: 'background-color 0s',
        }}
        {...itemContainerProps}>
        <div className="flex min-w-0 items-center gap-2">
          {leftIcon && (
            <div className="flex items-center gap-1">
              <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{leftIcon}</div>
            </div>
          )}
          <TypewriterText
            text={label}
            className={`uppercase ${themeClasses.text} block h-[20px] truncate text-sm font-[600] font-semibold leading-[20px]`}
          />
        </div>
        {rightContent && <div className="ml-2 flex shrink-0 items-center">{rightContent}</div>}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {children && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{
              opacity: isExpanded ? 1 : 0,
              height: isExpanded ? 'auto' : 0,
              y: isExpanded ? 0 : -5,
              transitionEnd: {
                overflow: isExpanded ? 'visible' : 'hidden',
              },
            }}
            exit={{ opacity: 0, height: 0, y: -5, overflow: 'hidden' }}
            transition={{
              duration: 0.3,
              ease: [0.2, 0.8, 0.2, 1.0],
              opacity: { duration: 0.35 },
            }}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
