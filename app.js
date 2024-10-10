const express = require("express");
const path = require("path");
const cors = require("cors");
const serveStatic = require("serve-static");
const uploadRouter = require("./routes/upload");
const roomRouter = require("./routes/room");
const {md2html} = require("./utils");
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
    res.render("chat");
  } else {
    res.render("index", {title: "OnlineChat"});
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
      password: null
    };
    rooms.set(roomID, room);
  }
  return room;
}

io.sockets.on("connection", function (socket) {
  socket.on("register", function (username, roomID = "/", password = "") {
    if (!roomID.startsWith("?")) {
      socket.emit("invalid room");
      return;
    }

    let room = getRoom(roomID);
    username = username.trim();

    let isFirstPerson = room.users.size === 0;

    if (isFirstPerson) {
      if (password === null) {
        socket.emit("set password");
        return;
      } else {
        room.password = password;
      }
    }

    if (room.password !== "" && room.password !== password) {
      socket.emit("invalid password");
      return;
    }

    if (room.usernameSet.has(username) || username === "Admin") {
      socket.emit("conflict username");
    } else {
      room.usernameSet.add(username);
      room.users.set(socket.id, {
        username,
        isAdmin: isFirstPerson
      });
      userID2roomID.set(socket.id, roomID);
      socket.join(roomID);
      socket.emit("register success");

      let data = {
        content: `${username} 加入聊天！`,
        sender: "Admin",
        type: "TEXT"
      };
      io.to(roomID).emit("message", data);
      io.to(roomID).emit("update users", Array.from(room.users.values()));
    }
  });

  socket.on("message", function (data, roomID = "/") {  	
	let room = getRoom(roomID);
    if (room.users.has(socket.id)) {
      if (!data) return;
      if (data.content === undefined) return;
      if (data.type === undefined) data.type = "TEXT";
      let user = room.users.get(socket.id);
      let kickMessage = undefined;
      if (user.isAdmin) {
        if (data.content.startsWith("kick")) {
          let kickedUser = data.content.substring(4);
          kickedUser = kickedUser.trim();
          for (let [id, user] of room.users.entries()) {
            if (user.username === kickedUser) {
              room.users.delete(id);
              room.usernameSet.delete(user.username);
              kickMessage = {
                content: `${user.username} 踢出聊天室！`,
                sender: "Admin",
                type: "TEXT",
              };
			  io.to(roomID).emit("update users", Array.from(room.users.values()));
              break;
            }
          }
        }
      }
      if (user.username === undefined || user.username === "") {
        user.username = "Anonymous";
      }
      data.sender = user.username;
      if (data.type === "TEXT") {
        data.content = md2html(data.content);
      }
      io.to(roomID).emit("message", data);
      if (kickMessage) io.to(roomID).emit("message", kickMessage);
    } else {
      let data = {
        content: `登录已过期，请刷新页面或点击[修改昵称]!`,
        sender: "Admin",
        type: "TEXT",
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
        room.usernameSet.delete(username);
        room.users.delete(socket.id);
        if (room.users.size === 0) {
          rooms.delete(roomID);
        }
		
        let data = {
          content: `${username} 已离开！`,
          sender: "Admin",
          type: "TEXT",
        };
        io.to(roomID).emit("message", data);		
		io.to(roomID).emit("update users", Array.from(room.users.values()));		
      }
    }
  });
});

server.listen(process.env.PORT || 3000);  