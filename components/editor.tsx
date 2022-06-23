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
      <form onSubmit={handleSubmit}>
        <label>
          Content:
          <input type="text" value={text} onChange={handleChange} />
        </label>
        <input type="submit" value="Submit" />
      </form>
    </>
  );
}

export default Editor
