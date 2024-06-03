let socket;
let username = "";
let registered = false;
let roomID = window.location.pathname;
let dialogElement;
let inputElement;
let fileInputElement;
let onlineUsers = new Set();

function filename2type(fileName) {
  let extension = fileName.split(".").pop().toLowerCase();
  let imageFormats = [
    "png",
    "jpg",
    "bmp",
    "gif",
    "ico",
    "jpeg",
    "apng",
    "svg",
    "tiff",
    "webp",
  ];
  let audioFormats = [
    "mp3",
    "wav",
    "ogg",
  ];
  let videoFormats = [
    "mp4",
    "webm",
  ];
  if (imageFormats.includes(extension)) {
    return "IMAGE";
  } else if (audioFormats.includes(extension)) {
    return "AUDIO";
  } else if (videoFormats.includes(extension)) {
    return "VIDEO";
  }
  return "FILE";
}

function uploadFile() {
  let file = fileInputElement.files[0];
  let formData = new FormData();
  formData.append("file", file);

  let progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");

  let progressText = document.createElement("div");
  progressText.classList.add("progress-text");
  progressBar.appendChild(progressText);

  let uploadingText = document.createElement("div");
  uploadingText.classList.add("uploading-text");
  uploadingText.textContent = "正在上传";
  progressBar.appendChild(uploadingText);

  let progressPercentage = document.createElement("div");
  progressPercentage.classList.add("progress-percentage");
  progressBar.appendChild(progressPercentage);

  dialogElement.appendChild(progressBar);

  let currentProgress = 0;
  const progressInterval = setInterval(() => {
    if (currentProgress < 100) {
      currentProgress++;
      progressPercentage.textContent = `${currentProgress}%`;
      progressBar.style.width = `${currentProgress}%`;
    } else {
      clearInterval(progressInterval);
    }
  }, 50);

  fetch("/upload", {
    method: "POST",
    body: formData,
    onProgress: (event) => {
      if (event.lengthComputable) {
        let progress = Math.round((event.loaded / event.total) * 100);
        if (progress > currentProgress) {
          currentProgress = progress;
          progressPercentage.textContent = `${currentProgress}%`;
          progressBar.style.width = `${currentProgress}%`;
        }
      }
    },
  })
    .then((res) => {
      return res.json();
    })
    .then((data) => {
      let filePath = data.path;
      sendMessage(filePath, filename2type(file.name));
      dialogElement.removeChild(progressBar);
    });
}

function changeUsername() {
  username = prompt("请输入新的用户昵称：", "");
  if (username !== null && username !== "") {
    registered = false;
    register();
  }
}

function register() {
  if (username !== "") {
    let password = prompt("请输入房间密码(如果有):");
    socket.emit("register", username, roomID, password);
  }
}

function processInput(input) {
  input = input.trim();
  switch (input) {
    case "":
      break;
    case "help":
      printMessage("<ul><li><strong>help</strong> — 帮助说明</li><li><strong>clear</strong> — 清除聊天记录</li><li><strong>change</strong> — 修改用户名</li><li><strong>exit</strong> — 退出当前聊天窗口</li></ul>", "Admin");
      break;
    case "clear":
      clearMessage();
      break;
    case "change":
      changeUsername();
      break;
    case "exit":
      closeWebsite();
      break;
    default:
      sendMessage(input);
      break;
  }
  clearInputBox();
}

function clearInputBox() {
  inputElement.value = "";
}

function clearMessage() {
  dialogElement.innerHTML = "";
}

function char2color(c) {
  let num = c.charCodeAt(0);
  let r = Math.floor(num % 255);
  let g = Math.floor((num / 255) % 255);
  let b = Math.floor((r + g) % 255);
  if (g < 20) g += 20;
  return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
}

function printMessage(content, sender = "Admin", type = "TEXT") {
  let html;
  let firstChar = sender[0];
  //Add time
  let sendTime = new Date().toLocaleString(); // 获取当前时间
  let formattedSender = `${sender} | ${sendTime}`; // 添加发送时间  

  // 检查消息内容是否包含 YouTube 视频链接
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?(?:\S+)/g;
  const youtubeMatch = content.match(youtubeRegex); 

  if (youtubeMatch) {
    // 提取 YouTube 视频 ID
    const videoId = youtubeMatch[0].split(/v=|v\/|embed\/|youtu\.be\/|shorts\//)[1].split(/[?&]/)[0];

    // 生成 YouTube 嵌入式播放器的 HTML 代码
    html = `<div class="chat-message shown">
      <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
      <div class="nickname">${formattedSender}</div>
      <div class="message-box">
        <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0"  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    </div>`;
  } 
  else {
    // 处理其他类型的消息
	switch (type) {
		case "IMAGE":
			html = `<div class="chat-message shown">
		<div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
		<div class="nickname">${formattedSender}</div>
		<div class="message-box"><img src="${content}" alt="${content}" class="image-preview" data-src="${content}" onclick="showLightbox('${content}')"><div class="image-thumbnail" style="background-image: url('${content}')"></div></div>
			</div>`
			break;
		case "AUDIO":
			html = `<div class="chat-message shown">
		<div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
		<div class="nickname">${formattedSender}</div>
		<div class="message-box"><audio controls src="${content}"></div>
			</div>`
			break;
		case "VIDEO":
			html = `<div class="chat-message shown">
		<div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
		<div class="nickname">${formattedSender}</div>
		<div class="message-box"><video controls><source src="${content}"></video></div>
			</div>`
			break;
		case "FILE":
			let parts = content.split('/');
			let text = parts[parts.length - 1];
			html = `<div class="chat-message shown">
		<div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
		<div class="nickname">${formattedSender}</div>
		<div class="message-box"><a href="${content}" download="${text}">${text}</a></div>
			</div>`
			break;
		case "TEXT":
			default:
			html = `<div class="chat-message shown">
		<div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
		<div class="nickname">${formattedSender}</div>
		<div class="message-box"><p>${content}</p></div>
			</div>`
			break;
				} 
  
		}
  
  dialogElement.insertAdjacentHTML('beforeend', html)
  dialogElement.scrollTop = dialogElement.scrollHeight;
}

function sendMessage(content, type = "TEXT") {
  let data = {
    content,
    type,
  };
  socket.emit("message", data, roomID);
}

function initSocket() {
  socket = io();
  socket.on("message", function (message) {
    printMessage(message.content, message.sender, message.type);
  });
  socket.on("register success", function () {
    registered = true;
    localStorage.setItem("username", username);
    clearInputBox();
  });
  socket.on("conflict username", function () {
    registered = false;
    localStorage.setItem("username", "");
    alert("用户昵称已被占用，请输入新的用户昵称！");
    changeUsername();
  });
  socket.on("invalid password", function () {
    registered = false;
    alert("密码错误,请重新输入!");
    register();
  });
  socket.on("update users", function (users) {
    updateUserList(users);
  });
}

/* //原始文件，用户昵称颜色同色，同时css文件中需要给出颜色
function updateUserList(users) {
  let userListElement = document.getElementById("userList");
  let usernames = users.map(user => user.username);
  userListElement.textContent = usernames.join("、");
  let userCountElement = document.getElementById("userCount");
  userCountElement.textContent = users.length;
}
*/
// 以下代码实现用户颜色从列表中依次显示

function updateUserList(users) {
  let userListElement = document.getElementById("userList");
  userListElement.innerHTML = "";

  const colors = ["#ff0000", "#00ff00", "#ff00ff", "#d8bfd8", "#00ffff", "#0000ff"];
  const userColorMap = new Map();

  users.forEach((user, index) => {
    let randomColor = colors[index % colors.length];
    userColorMap.set(user.username, randomColor);
    const userSpan = document.createElement("span");
    userSpan.textContent = user.username;
    userSpan.style.color = randomColor;
    userListElement.appendChild(userSpan);
  });

  let userCountElement = document.getElementById("userCount");
  userCountElement.textContent = users.length;
}

function closeWebsite() {
  if (confirm('确定要退出吗？')) {
    if (navigator.userAgent.indexOf("Firefox") != -1 || navigator.userAgent.indexOf("Chrome") != -1) {
      window.location.href = "about:blank";
      window.close();
    } else {
      window.opener = null;
      window.open("", "_self");
      window.close();
    };
  }
}
//图片显示
function showLightbox(src) {
  let lightbox = document.getElementById("lightbox");
  let lightboxImage = document.querySelector(".lightbox-image");
  let closeButton = document.querySelector(".close-button");
  let prevButton = document.querySelector(".prev-button");
  let nextButton = document.querySelector(".next-button");

  let imageIndex = 0;
  let imageArray = []; // 存储所有图片的 src

  // 收集所有图片的 src
  let imageElements = document.querySelectorAll(".image-preview");
  imageElements.forEach((img, index) => {
    imageArray.push(img.getAttribute("data-src"));
    if (img.getAttribute("data-src") === src) {
      imageIndex = index;
    }
  });

  lightboxImage.src = imageArray[imageIndex];

  lightbox.style.display = "block";

  closeButton.onclick = function () {
    lightbox.style.display = "none";
  };

  prevButton.onclick = function () {
    imageIndex = (imageIndex - 1 + imageArray.length) % imageArray.length;
    lightboxImage.src = imageArray[imageIndex];
  };

  nextButton.onclick = function () {
    imageIndex = (imageIndex + 1) % imageArray.length;
    lightboxImage.src = imageArray[imageIndex];
  };

  window.onclick = function (event) {
    if (event.target == lightbox) {
      lightbox.style.display = "none";
    }
  };
  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 37 /* ArrowLeft */) {
      prevButton.click();
    } else if (e.keyCode === 39 /* ArrowRight */) {
      nextButton.click();
    } else if (e.keyCode === 27 /* Escape */) {
      lightbox.style.display = "none";
    }
  });
}
//图片显示

function send() {
  let input = inputElement.value;
  if (registered) {
    processInput(input);
  } else {
    alert("请先输入用户昵称和房间密码(如果有)进行注册！");
  }
}

window.onload = function () {
  initSocket();
  dialogElement = document.getElementById("dialog");
  inputElement = document.getElementById("input");
  fileInputElement = document.getElementById("fileInput");
  inputElement.addEventListener("keydown", function (e) {
	if (e.keyCode == 13 /* ENTER */ && !e.shiftKey) {
		e.preventDefault();
		send();
	} else if (e.keyCode == 13 /* ENTER */ && e.shiftKey) {
		e.preventDefault();
		inputElement.value += "\n";
	}
  });
  username = localStorage.getItem("username");
  if (username) {
    register();
  } else {
    changeUsername();
  }
  //user
  updateOnlineUsers();
  
};