const express = require('express')
const http = require('http')
const socketIo = require('socket.io')

// Set up Express
const app = express()
const server = http.createServer(app)

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: 'https://www.whetstone-writer.com',
    methods: ['GET', 'POST'],
  },
})

// Handle a client connection
io.on('connection', socket => {
  const documentId = socket.handshake.query.documentId
  socket.join(documentId)

  console.log(`Client connected to room: ${documentId}`)

  // Emit a message to the clients in the same room
  socket.to(documentId).emit('joined', 'A new user has joined the document.')

  // Handle messages sent from the client
  socket.on('message', msg => {
    console.log(`Message from client in room ${documentId}:`, msg)

    // Broadcast the message to all clients in the same room
    socket.to(documentId).emit('message', msg)
  })

  socket.on('document-updated', msg => {
    console.log(`Document in room ${documentId} updated:`, msg)

    // Broadcast the message to all clients in the same room
    socket.to(documentId).emit('document-updated', msg)
  })

  // Handle client disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected from room: ${documentId}`)
    socket.to(documentId).emit('left', 'A user has left the document.')
  })
})

// Start the server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
