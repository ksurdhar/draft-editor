import { useState } from "react"

interface FooterProps {
  wordCountAtPos: number
  wordCount: number
  initFadeIn: boolean
  fadeOut: boolean
}

const getCounterFormats = (wordCountAtPos: number, wordCount: number) => {
  const formattedPosPage = wordCountAtPos === 0 ? 1 : Math.ceil(wordCountAtPos/500)
  const formattedPage = wordCount === 0 ? 1 : Math.ceil(wordCount/500)
  const formattedPercentage = wordCount === 0 ? 0 : Math.round(wordCountAtPos/wordCount*100)

  return [
    `${wordCountAtPos}/${wordCount} words`,
    `page ${formattedPosPage}/${formattedPage}`, 
    `${formattedPercentage}%`
  ]
}

const Footer = ({ initFadeIn, fadeOut, wordCount, wordCountAtPos}: FooterProps) => {
  const [ activeFormat, setActiveFormat ] = useState(0)
  const counterFormats = getCounterFormats(wordCountAtPos, wordCount)
    
  return (
    <div className={`fixed ${initFadeIn ? 'footer-gradient' : 'bg-transparent'} ${fadeOut ? 'opacity-0' : 'opacity-100' }  transition-opacity duration-700 hover:opacity-100 w-[100vw] h-[50px] bottom-0 left-0 z-10`}>
    <div className='font-index text-sm md:text-base pr-[20px] cursor-pointer fixed bottom-0 right-0' onClick={() => {
      if (activeFormat < 2) {
        setActiveFormat(activeFormat + 1)
      } else {
        setActiveFormat(0)
      }
    }}> 
      { counterFormats[activeFormat] }
    </div>
  </div>
  )
}

export default Footer