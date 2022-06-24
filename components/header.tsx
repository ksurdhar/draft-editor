import { MenuIcon } from '@heroicons/react/solid'

const HeaderComponent = () => {
  return (
    <header className="flex flex-row p-5 justify-between">
      <h1>Draft Writer</h1>
      <MenuIcon className="h-5 w-5"/>
    </header>
  )
}

export default HeaderComponent