const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cron = require("node-cron");
const Message = require("./models/message");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =======================
   HTTP + SOCKET.IO
======================= */
const server = http.createServer(app);
const io = new Server(server);

/* =======================
   APP CONFIG
======================= */
app.set("view engine", "ejs");
app.use(express.static("public"));

/* =======================
   MONGODB CONNECT
======================= */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Atlas connected"))
  .catch(err => console.error("❌ Mongo error:", err));

/* =======================
   ROUTES
======================= */
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/chat", async (req, res) => {
  const { username, room } = req.query;

  // 🛑 SAFETY GUARD
  if (!username || !room) {
    return res.redirect("/");
  }

  const messages = await Message.find({ room }).sort({ createdAt: 1 });

  res.render("chat", { username, room, messages });
});

/* =======================
   SOCKET.IO
======================= */
io.on("connection", (socket) => {

  socket.on("joinRoom", ({ username, room }) => {
    if (!username || !room) return;

    socket.join(room);
    socket.username = username;
    socket.room = room;

    console.log(`👤 ${username} joined ${room}`);
  });

  socket.on("chatMessage", async (msg) => {
    if (!socket.username || !socket.room || !msg.trim()) return;

    const message = await Message.create({
      user: socket.username,
      room: socket.room,
      text: msg
    });

    io.to(socket.room).emit("message", {
      _id: message._id,
      user: message.user,
      text: message.text
    });
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});

/* =======================
   CRON JOB – CLEAR CHAT
   EVERY DAY AT 12:00 AM
======================= */
cron.schedule("0 0 * * *", async () => {
  try {
    await Message.deleteMany({});
    console.log("🧹 Chat messages cleared at 12 AM");
  } catch (err) {
    console.error("❌ Error clearing messages:", err);
  }
});

/* =======================
   SERVER START
======================= */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
