import Link from "next/link"

const HeaderComponent = () => {
  return (
    <header className="p-4 bg-gray-800 text-gray-100">
      <div className="container flex flex-end h-6 mx-auto">
        <ul className="items-stretch hidden space-x-3 md:flex">
          <li className="flex">
            <Link href="/documents">
              <a rel="noopener noreferrer" href="#" className="flex items-center px-4 -mb-1 border-b-2 border-transparent">My Documents</a>
            </Link>
          </li>
          <li className="flex">
            <Link href="/about">
              <a rel="noopener noreferrer" href="#" className="flex items-center px-4 -mb-1 border-b-2 border-transparent">About</a>
            </Link>
          </li>
          <li className="flex">
            <Link href="/contact">
              <a rel="noopener noreferrer" href="#" className="flex items-center px-4 -mb-1 border-b-2 border-transparent text-violet-400 border-violet-400">Contact</a>
            </Link>
          </li>
        </ul>
        <button className="flex justify-end p-4 md:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>
    </header>
  )
}

export default HeaderComponent