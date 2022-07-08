import Link from "next/link"
import { useState } from "react"
import Layout from "../../components/layout"

const RegistrationPage = () => {  
  const [ email, setEmail ] = useState('')
  const [ password, setPassword ] = useState('')

  // make a post request to create user
  // hit an api route
  // make validations (Ensure there isn't an existing user)
  // if good, create user
  // return some kind of session token

  return (
    <Layout>
      <div className="flex flex-col max-w-md p-6 self-center rounded-md sm:p-10 dark:bg-gray-900 dark:text-gray-100">
        <div className="mb-8 text-center">
          <h1 className="my-3 text-4xl font-bold">Sign up</h1>
          <p className="text-sm dark:text-gray-400">Sign up to access your account</p>
        </div>
        <div className="space-y-12 ng-untouched ng-pristine ng-valid">
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm">Email address</label>
              <input onChange={(event) => {
                event.preventDefault()
                setEmail(event.target.value)
              }} type="email" name="email" id="email" className="w-full px-3 py-2 border rounded-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm">Password</label>
              </div>
              <input onChange={(event) => {
                event.preventDefault()
                setPassword(event.target.value)
              }} type="password" name="password" id="password" className="w-full px-3 py-2 border rounded-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <button className="w-full px-8 py-3 font-semibold rounded-md dark:bg-violet-400 dark:text-gray-900"
                onClick={(e) => {
                  e.preventDefault()
                  console.log(email, password)
                }}>Submit</button>
            </div>
            <p className="px-6 text-sm text-center dark:text-gray-400">Already have an account? <Link rel="noopener noreferrer" href="/login" className="hover:underline dark:text-violet-400"><a>Log in</a></Link>.</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default RegistrationPage