'use client'
import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ListItemProps {
  leftIcon?: ReactNode
  rightContent?: ReactNode
  label: string
  depth?: number
  isSelected?: boolean
  onClick?: () => void
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
  children,
  isExpanded,
  theme = 'light',
  containerProps = {},
  itemContainerProps = {},
  showSelectedStyles = true
}: ListItemProps) => {
  const getThemeClasses = () => {
    if (theme === 'light') {
      return {
        hover: 'hover:bg-white/[.2]',
        selected: showSelectedStyles ? '!bg-white/[.25]' : '',
        text: 'text-black/[.70]'
      }
    }
    return {
      hover: 'hover:bg-black/[.05]',
      selected: showSelectedStyles ? '!bg-black/[.07]' : '',
      text: 'text-black/[.70]'
    }
  }

  const themeClasses = getThemeClasses()

  return (
    <li 
      className="list-none group" 
      {...containerProps}
    >
      <div
        onClick={onClick}
        className={`flex items-center justify-between py-1.5 px-2 ${themeClasses.hover} rounded-lg cursor-pointer ${
          isSelected ? themeClasses.selected : ''
        }`}
        style={{
          paddingLeft: `${(depth + 1) * 20}px`,
          transition: 'background-color 0s'
        }}
        {...itemContainerProps}
      >
        <div className="flex items-center min-w-0 gap-2">
          {leftIcon && (
            <div className="flex items-center gap-1">
              <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                {leftIcon}
              </div>
            </div>
          )}
          <span className={`uppercase ${themeClasses.text} text-sm font-semibold block h-[20px] leading-[20px] truncate font-[600]`}>
            {label}
          </span>
        </div>
        {rightContent && (
          <div className="flex items-center ml-2 shrink-0">
            {rightContent}
          </div>
        )}
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
                overflow: isExpanded ? 'visible' : 'hidden'
              }
            }}
            exit={{ opacity: 0, height: 0, y: -5, overflow: 'hidden' }}
            transition={{ 
              duration: 0.3,
              ease: [0.2, 0.8, 0.2, 1.0],
              opacity: { duration: 0.35 }
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
} 