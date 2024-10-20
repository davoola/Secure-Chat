const express = require("express");
const path = require("path");
const cors = require("cors");
const serveStatic = require("serve-static");
const uploadRouter = require("./routes/upload");
const roomRouter = require("./routes/room");
const {md2html} = require("./utils");
const fs = require('fs');
const app = express();
const server = require("http").createServer(app);
let io = require("socket.io")(server);
app.io = io;
app.use(cors());
app.use(serveStatic(path.join(__dirname, "public"), {maxAge: "600000"}));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use("/upload", uploadRouter);

app.get("/", (req, res) => {
  if (req.query && Object.keys(req.query).length > 0) {
    const roomID = Object.keys(req.query)[0];
    res.render("chat", { roomID });
  } else {
    res.render("index", {title: "Secure Chat"});
  }
});

app.use("/", roomRouter);

app.use(function (req, res) {
  res.status(404);
  res.send({error: "Not found"});
});

let rooms = new Map();
let userID2roomID = new Map();

function getRoom(roomID) {
  let room = rooms.get(roomID);
  if (!room) {
    room = {
      users: new Map(),
      usernameSet: new Set(),
      password: getSpecialRoomPassword(roomID)
    };
    rooms.set(roomID, room);
  }
  return room;
}

function getSpecialRoomPassword(roomID) {
  switch(roomID) { // Special roomID && Password
    case "MyLove": return "5201314"; 
    case "Tech": return "abc";
    case "Sci": return "xyz";
    default: return null;
  }
}

function loadChatHistory(roomID) {
  if (!isSpecialRoom(roomID)) return [];
  
  const filePath = path.join(__dirname, 'public/upload', `_records-${roomID}.json`);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading chat history:', err);
    return [];
  }
}

function saveChatHistory(roomID, message) {
  if (!isSpecialRoom(roomID)) return;
  
  const filePath = path.join(__dirname, 'public/upload', `_records-${roomID}.json`);
  try {
    let records = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      records = JSON.parse(data || '[]');
    }
    records.push(message);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
}

function isSpecialRoom(roomID) {
  return ["MyLove", "Tech", "Sci"].includes(roomID); // Special roomID
}

io.sockets.on("connection", function (socket) {
  socket.on("register", function (username, roomID = "/", password = "") {
    let room = getRoom(roomID);

    if (room.usernameSet.has(username)) {
      socket.emit("conflict username");
      return;
    }

    if (isSpecialRoom(roomID)) {
      if (roomID === "MyLove") {
        if (username !== "Jack" && username !== "Amy") { // Special UserName
          socket.emit("unauthorized user");
          return;
        }
      }
      if (password !== room.password) {
        socket.emit("invalid password");
        return;
      }
    }

    room.users.set(socket.id, {
      username,
      isAdmin: room.users.size === 0
    });
    room.usernameSet.add(username);
    userID2roomID.set(socket.id, roomID);
    socket.join(roomID);
    socket.emit("register success");

    let data = {
      content: `${username} 加入聊天！`,
      sender: "Admin",
      type: "TEXT",
      timestamp: new Date().toISOString()
    };
    io.to(roomID).emit("message", data);
    io.to(roomID).emit("update users", Array.from(room.users.values()));

    if (isSpecialRoom(roomID)) {
      const chatHistory = loadChatHistory(roomID);
      socket.emit("chat history", chatHistory);
    }
  });
  
  

  socket.on("change username", function (newUsername, roomID = "/") {
    let room = getRoom(roomID);
    let oldUsername = room.users.get(socket.id).username;
	
	// Special handling for MyLove room
	if (roomID === "MyLove") {
		if (newUsername !== "Jack" && newUsername !== "Amy") {
		socket.emit("username change failed", "玉堂深处,惟迎知音……");
		return;
		}
	}
	
    // Check if the new username is already in use in the current room
    if (room.usernameSet.has(newUsername) && newUsername !== oldUsername) {
      socket.emit("username change failed", "用户昵称已被占用");
      return;
    }

    // Remove old username and add new username to the set
    room.usernameSet.delete(oldUsername);
    room.usernameSet.add(newUsername);

    // Update the username in the room's users map
    room.users.get(socket.id).username = newUsername;

    // Notify the client that the username change was successful
    socket.emit("username change success", newUsername);

    // Notify all users in the room about the username change
    let data = {
      content: `${oldUsername} 已更改昵称为 ${newUsername}`,
      sender: "Admin",
      type: "TEXT",
      timestamp: new Date().toISOString()
    };
    io.to(roomID).emit("message", data);
    io.to(roomID).emit("update users", Array.from(room.users.values()));
  });

  socket.on("message", function (data, roomID = "/") {  	
    let room = getRoom(roomID);
    if (room.users.has(socket.id)) {
      if (!data) return;
      if (data.content === undefined) return;
      if (data.type === undefined) data.type = "TEXT";
      let user = room.users.get(socket.id);
      if (user.username === undefined || user.username === "") {
        user.username = "Anonymous";
      }
      data.sender = user.username;
      data.timestamp = new Date().toISOString();
      if (data.type === "TEXT") {
        data.content = md2html(data.content);
      }
      io.to(roomID).emit("message", data);
      if (isSpecialRoom(roomID)) {
        saveChatHistory(roomID, data);
      }
    } else {
      let data = {
        content: `登录已过期，请刷新页面或点击[修改昵称]!`,
        sender: "Admin",
        type: "TEXT",
        timestamp: new Date().toISOString()
      };
      socket.emit("message", data);
    }
  });

  socket.on("disconnect", () => {
    let roomID = userID2roomID.get(socket.id);
    if (roomID) {
      let room = getRoom(roomID);
      if (room.users.has(socket.id)) {
        userID2roomID.delete(socket.id);
        let username = room.users.get(socket.id).username;
        room.users.delete(socket.id);
        room.usernameSet.delete(username);
        if (room.users.size === 0) {
          rooms.delete(roomID);
        }
		
        let data = {
          content: `${username} 已离开！`,
          sender: "Admin",
          type: "TEXT",
          timestamp: new Date().toISOString()
        };
        io.to(roomID).emit("message", data);		
        io.to(roomID).emit("update users", Array.from(room.users.values()));		
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});