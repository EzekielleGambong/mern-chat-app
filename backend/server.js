const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const colors = require("colors"); // Import the colors library

dotenv.config(); // Load environment variables

connectDB(); // Connect to MongoDB

const User = require("../backend/models/userModel");
const app = express(); // Initialize Express application

app.use(express.json()); // To accept JSON data

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.post("/api/updatePic", async (req, res) => {
  const { pic, user } = req.body;
  console.log(pic, user.email);

  try {
    const result = await User.updateOne(
      {
        email: user.email,
      },
      {
        $set: {
          pic: pic,
        },
      }
    );
    console.log(result);
    res.status(200).send("Updated Image");
  } catch (error) {
    console.error(error);
    res.status(500).send("Failed to update image");
  }
});

// --------------------------deployment------------------------------
const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running..");
  });
}
// --------------------------deployment------------------------------

// Error Handling middlewares
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  () => console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:3000",
    // credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User Joined Room: " + room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;

      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });

  socket.on("disconnect", () => {
    console.log("USER DISCONNECTED");
    socket.leave(userData._id);
  });
});
