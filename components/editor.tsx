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

  const handleChange = (e: React.FormEvent<HTMLInputElement>) => {
    setText(e.currentTarget.value)
  }

  return (
    <>
      <h2>Editor</h2>
      <form className="" onSubmit={handleSubmit}>
        <label>
          Content:
          <input className="border-solid border-2 border-black rounded-md" 
            type="text" value={text} onChange={handleChange} />
        </label>
        <input className="px-8 py-3 font-semibold rounded dark:bg-gray-100 dark:text-gray-800 cursor-pointer" type="submit" value="submit" />
      </form>
    </>
  );
}

export default Editor
