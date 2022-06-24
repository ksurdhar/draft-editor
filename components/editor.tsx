import React, { useState } from "react";
import API from "../lib/utils";

type EditorProps = {
  documentText: string
  documentId: string
}

const Editor = ({ documentText, documentId }: EditorProps) => {
  const [ text, setText ] = useState((documentText || ''))

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    API.patch(`documents/${documentId}`, { content: text })
  }

  const handleChange = (e: React.FormEvent<HTMLTextAreaElement>) => {
    setText(e.currentTarget.value)
  }

  return (
    <>
      <form className="flex-grow" onSubmit={handleSubmit}>
        <textarea className="border-solid border-2 border-slate-300 rounded-md w-full h-full" value={text} onChange={handleChange} />
        {/* <input className="px-8 py-3 font-semibold rounded dark:bg-gray-100 dark:text-gray-800 cursor-pointer" type="submit" value="submit" /> */}
      </form>
    </>
  );
}

export default Editor
