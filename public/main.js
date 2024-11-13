let socket;
let username = "";
let registered = false;
let roomID = window.location.search.substring(1); 
let dialogElement;
let inputElement;
let fileInputElement;
let announcementElement;
let syncVideoContainer;
let syncVideoPlayer;
let currentSyncVideoId = null;
let isDragging = false;
let isResizing = false;
let dragStartX, dragStartY, initialX, initialY;
let resizeStartX, resizeStartY, initialWidth, initialHeight;
let iptvPlayer = null;
let currentIptvUrl = null;
let isIptvHost = false;

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
    "m3u8",
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
  let newUsername = prompt("请输入新的用户昵称：", "");
  if (newUsername !== null && newUsername !== "") {
    socket.emit("change username", newUsername, roomID);
  }
}

function register() {
  username = localStorage.getItem("username") || "";
  if (username !== "") {
    let password = localStorage.getItem("password") || "";
    socket.emit("register", username, roomID, password);
  } else {
    window.location.href = "/";
  }
}

function processInput(input) {
  input = input.trim();
  if (input.startsWith("announce ")) {
    const newAnnouncement = input.slice(10);
    socket.emit("update announcement", newAnnouncement);
    return;
  }
  switch (input) {
    case "":
      break;
    case "help":
      printMessage("<ul><li><strong>help</strong> — 帮助说明</li><li><strong>clear</strong> — 清除聊天记录</li><li><strong>announce [内容]</strong> — 更新公告栏 (支持Markdown语法)</li><li><strong>change</strong> — 修改用户名</li><li><strong>exit</strong> — 退出当前聊天窗口</li></ul>", "Admin");
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

function printMessage(content, sender = "Admin", type = "TEXT", timestamp = new Date().toISOString()) {
  let html;
  let firstChar = sender[0];
  let sendTime = new Date(timestamp).toLocaleString();
  let formattedSender = `${sender} | ${sendTime}`;

  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(?:embed\/)?(?:v\/)?(?:shorts\/)?(?:\S+)/g;
  const youtubeMatch = content.match(youtubeRegex); 

  if (youtubeMatch) {
    const videoId = youtubeMatch[0].split(/v=|v\/|embed\/|youtu\.be\/|shorts\//)[1].split(/[?&]/)[0];
    html = `<div class="chat-message shown">
      <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
      <div class="nickname">${formattedSender}</div>
      <div class="message-box">
        <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0"  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      </div>
    </div>`;
  } else {
    switch (type) {
      case "IMAGE":
        html = `<div class="chat-message shown">
          <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
          <div class="nickname">${formattedSender}</div>
          <div class="message-box"><img src="${content}" alt="${content}" class="image-preview" data-src="${content}" onclick="showLightbox('${content}')"><div class="image-thumbnail" style="background-image: url('${content}')"></div></div>
        </div>`;
        break;
      case "AUDIO":
        html = `<div class="chat-message shown">
          <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
          <div class="nickname">${formattedSender}</div>
          <div class="message-box"><audio controls src="${content}"></div>
        </div>`;
        break;
      case "VIDEO":
        html = `<div class="chat-message shown">
          <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
          <div class="nickname">${formattedSender}</div>
          <div class="message-box">
          <video controls><source src="${content}"></video>
          <button onclick="startSyncVideo('${content}')">同步播放</button>
          </div>
        </div>`;
        break;
      case "FILE":
        let parts = content.split('/');
        let text = parts[parts.length - 1];
        html = `<div class="chat-message shown">
          <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
          <div class="nickname">${formattedSender}</div>
          <div class="message-box"><a href="${content}" download="${text}">${text}</a></div>
        </div>`;
        break;
      case "TEXT":
      default:
        html = `<div class="chat-message shown">
          <div class="avatar" style="background-color:${char2color(firstChar)}">${firstChar.toUpperCase()}</div>
          <div class="nickname">${formattedSender}</div>
          <div class="message-box"><p>${content}</p></div>
        </div>`;
        break;
    } 
  }
  
  dialogElement.insertAdjacentHTML('beforeend', html);
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
    printMessage(message.content, message.sender, message.type, message.timestamp);
  });
  socket.on("register success", function () {
    registered = true;
    clearInputBox();
  });

  socket.on('sync_video_invitation', function(data) {
    const invitation = document.createElement('div');
    invitation.className = 'sync-invitation';
    invitation.setAttribute('data-video-id', data.videoId);
    invitation.style.display = 'block'; 
    invitation.innerHTML = `
      <p>${data.username} 邀请您同步观看视频</p>
      <div class="sync-invitation-buttons">
        <button class="accept-sync" onclick="acceptSync('${data.videoId}', '${data.url}')">接受</button>
        <button class="decline-sync" onclick="declineSync()">拒绝</button>
      </div>
    `;
    document.body.appendChild(invitation);
    
    setTimeout(() => {
      if (invitation.parentNode) {
        invitation.parentNode.removeChild(invitation);
      }
    }, 10000);
  });

  socket.on('sync_video_accepted', function(data) {
    showNotification(`${data.username} 接受了同步观看视频`, 'success');
  });

  socket.on('sync_video_declined', function(data) {
    showNotification(`${data.username} 拒绝了同步观看视频`, 'warning');
  });

  socket.on('sync_video_join', function(data) {
    if (currentSyncVideoId === data.videoId) {
      socket.emit('sync_video_state', {
        videoId: currentSyncVideoId,
        time: syncVideoPlayer.currentTime,
        playing: !syncVideoPlayer.paused,
        roomID
      });
    }
  });

  socket.on('sync_video_state', function(data) {
    if (!currentSyncVideoId || currentSyncVideoId !== data.videoId) return;
    syncVideoPlayer.currentTime = data.time;
    if (data.playing) {
      syncVideoPlayer.play().catch(console.error);
    } else {
      syncVideoPlayer.pause();
    }
  });

  socket.on('sync_video_control', function(data) {
    if (!currentSyncVideoId || currentSyncVideoId !== data.videoId) return;  
    const timeDiff = Math.abs(syncVideoPlayer.currentTime - data.time);
    
    syncVideoPlayer.removeEventListener('seeked', onVideoSeeked);
    syncVideoPlayer.removeEventListener('play', onVideoPlay);
    syncVideoPlayer.removeEventListener('pause', onVideoPause);
  
    switch (data.type) {
      case 'play':
        if (timeDiff > 0.5) {
          syncVideoPlayer.currentTime = data.time;
        }
        syncVideoPlayer.play().catch(console.error);
        break;
      case 'pause':
        if (timeDiff > 0.5) {
          syncVideoPlayer.currentTime = data.time;
        }
        syncVideoPlayer.pause();
        break;
      case 'seek':
        syncVideoPlayer.currentTime = data.time;
        break;
    }
    
    setTimeout(() => {
      syncVideoPlayer.addEventListener('seeked', onVideoSeeked);
      syncVideoPlayer.addEventListener('play', onVideoPlay);
      syncVideoPlayer.addEventListener('pause', onVideoPause);
    }, 100);
  });

  socket.on('sync_video_left', function(data) {
    showNotification(`${data.username} 退出了视频同步播放`, 'info');
  });

  socket.on('iptv_invitation', function(data) {
    const invitation = document.createElement('div');
    invitation.className = 'sync-invitation';
    invitation.setAttribute('data-iptv-url', data.url);
    invitation.style.display = 'block';
    invitation.innerHTML = `
      <p>${data.username} 邀请您观看IPTV直播</p>
      <div class="sync-invitation-buttons">
        <button class="accept-sync" onclick="acceptIptv('${data.url}')">接受</button>
        <button class="decline-sync" onclick="declineIptv()">拒绝</button>
      </div>
    `;
    document.body.appendChild(invitation);
    
    setTimeout(() => {
      if (invitation.parentNode) {
        invitation.parentNode.removeChild(invitation);
      }
    }, 10000);
  });

  socket.on('iptv_accepted', function(data) {
    showNotification(`${data.username} 接受了IPTV直播邀请`, 'success');
  });

  socket.on('iptv_declined', function(data) {
    showNotification(`${data.username} 拒绝了IPTV直播邀请`, 'warning');
  });

  socket.on('iptv_left', function(data) {    
	showNotification(`${data.username} 退出了IPTV直播`, 'info');	
  });
  
  socket.on("update announcement", function (htmlAnnouncement) {
    announcementElement.innerHTML = htmlAnnouncement;
  });
  socket.on("register failed", function (reason) {
    alert(reason);
    localStorage.removeItem("username");
    window.location.href = "/";
  });
  
  socket.on("username change success", function (newUsername) {
    username = newUsername;
    localStorage.setItem("username", newUsername);
    alert("昵称更改成功！");
  });

  socket.on("username change failed", function (reason) {
    alert("昵称更改失败：" + reason);
  });
  socket.on("conflict username", function () {
    registered = false;
    localStorage.removeItem("username");
    alert("用户昵称已被占用,请返回首页重新输入用户昵称！");
    window.location.href = "/";
  });
  socket.on("set password", function () {
    let password = localStorage.getItem("password") || "";
    socket.emit("register", username, roomID, password);
  });
  socket.on("invalid password", function () {
    registered = false;
    localStorage.removeItem("password");
    alert("密码错误，请返回首页重新输入！");
    window.location.href = "/";
  });
  socket.on("update users", function (users) {
    updateUserList(users);
  });
  socket.on("invalid room", function () {
    alert("无效的聊天室ID，将返回首页。");
    window.location.href = "/";
  });
  socket.on("unauthorized user", function () {
    alert("您没有权限进入此聊天室。");
    window.location.href = "/";
  });
  socket.on("room full", function () {
    alert("聊天室已满，请稍后再试。");
    window.location.href = "/";
  });
  socket.on("chat history", function (history) {
    history.forEach(message => {
      printMessage(message.content, message.sender, message.type, message.timestamp);
    });
  });
}

function closeWebsite() {
  if (confirm('确定要退出吗？')) window.location.href = "/";
}

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

function showLightbox(src) {
  let lightbox = document.getElementById("lightbox");
  let lightboxImage = document.querySelector(".lightbox-image");
  let closeButton = document.querySelector(".close-button");
  let prevButton = document.querySelector(".prev-button");
  let nextButton = document.querySelector(".next-button");

  let imageIndex = 0;
  let imageArray = [];

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
    if (e.keyCode === 37) {
      prevButton.click();
    } else if (e.keyCode === 39) {
      nextButton.click();
    } else if (e.keyCode === 27) {
      lightbox.style.display = "none";
    }
  });
}

function send() {
  let input = inputElement.value;
  if (registered) {
    processInput(input);
  } else {
    alert("请先输入用户昵称和房间密码(如果有)进行注册！");
    window.location.href = "/";
  }
}

function copyCodeToClipboard(button) {
  const codeBlock = button.nextElementSibling.querySelector('code');
  const textArea = document.createElement('textarea');
  textArea.value = codeBlock.textContent;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  
  const originalText = button.innerHTML;
  button.textContent = 'Copied!';
  setTimeout(() => {
    button.innerHTML = originalText;
  }, 2000);
}

function playVideoFromUrl() {
  const videoUrl = document.getElementById('videoUrl').value.trim();
  if (!videoUrl) {
    showNotification('请输入有效的视频URL地址', 'error');
    return;
  }
  
  if (videoUrl.toLowerCase().endsWith('.m3u8')) {
    startIptvStream(videoUrl);
  } else {
    startSyncVideo(videoUrl);
  }
  
  document.getElementById('videoUrl').value = '';
}

function initIptvPlayer() {
  if (!iptvPlayer) {
    iptvPlayer = videojs('iptvPlayer', {
      fluid: true,
      controls: true,
      autoplay: true,
      preload: 'auto',
      html5: {
        hls: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true,
          withCredentials: true,
          xhrSetup: function(xhr, url) {
            xhr.setRequestHeader('Accept', 'application/x-mpegURL');
            xhr.withCredentials = true;
          }
        }
      }
    });

    const iptvContainer = document.getElementById('iptvPlayerContainer');
    const header = iptvContainer.querySelector('.iptv-player-header');
    header.addEventListener('mousedown', (e) => startDragging(e, iptvContainer));

    addResizeHandles(iptvContainer);
  }
}

function addResizeHandles(container) {
  const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${pos}`;
    handle.addEventListener('mousedown', (e) => initResize(e, container, pos));
    container.appendChild(handle);
  });
}

function startIptvStream(url) {
  const iptvContainer = document.getElementById('iptvPlayerContainer');
  
  if (!iptvPlayer) {
    initIptvPlayer();
  }
  
  iptvContainer.style.display = 'block';
  currentIptvUrl = url;
  isIptvHost = true;
  
  socket.emit('iptv_invitation', {
    url: url,
    roomID: roomID
  });

  const encodedUrl = url.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
  
  iptvPlayer.src({
    src: encodedUrl,
    type: 'application/x-mpegURL'
  });
  
  iptvPlayer.play().catch(error => {
    console.error('播放错误:', error);
    showNotification('播放失败，请检查直播源是否有效', 'error');
  });
}


function leaveIptvPlayer() {
  const iptvContainer = document.getElementById('iptvPlayerContainer');
  iptvContainer.style.display = 'none';
  
  if (iptvPlayer) {
    iptvPlayer.pause();
    iptvPlayer.src('');
    currentIptvUrl = null;
    
    if (isIptvHost) {
      socket.emit('iptv_ended', {
        roomID: roomID,
        username: username
      });
    } else {
      socket.emit('iptv_left', {
        roomID: roomID,
        username: username
      });	
    }
    isIptvHost = false;
    showNotification('已退出IPTV直播', 'info');
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `sync-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function acceptIptv(url) {
  const invitation = document.querySelector('.sync-invitation');
  if (invitation) {
    invitation.remove();
  }
  
  const iptvContainer = document.getElementById('iptvPlayerContainer');
  
  if (!iptvPlayer) {
    initIptvPlayer();
  }
  
  iptvContainer.style.display = 'block';
  currentIptvUrl = url;
  isIptvHost = false;
  
  const encodedUrl = url.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
  
  iptvPlayer.src({
    src: encodedUrl,
    type: 'application/x-mpegURL'
  });
  
  iptvPlayer.play().catch(error => {
    console.error('播放错误:', error);
    showNotification('播放失败，请检查直播源是否有效', 'error');
  });
  
  socket.emit('iptv_accepted', {
    roomID: roomID
  });
  
  showNotification('已加入IPTV直播', 'success');
}

function declineIptv() {
  const invitation = document.querySelector('.sync-invitation');
  if (invitation) {
    invitation.remove();
  }
  
  socket.emit('iptv_declined', {
    roomID: roomID
  });
}

function initSyncVideoPlayer() {
  syncVideoContainer = document.getElementById('syncVideoContainer');
  syncVideoPlayer = document.getElementById('syncVideo');

  syncVideoPlayer.addEventListener('play', onVideoPlay);
  syncVideoPlayer.addEventListener('pause', onVideoPause);
  syncVideoPlayer.addEventListener('seeked', onVideoSeeked);
  
  const header = syncVideoContainer.querySelector('.sync-video-header');
  header.addEventListener('mousedown', (e) => startDragging(e, syncVideoContainer));
  
  addResizeHandles(syncVideoContainer);
}

function startDragging(e, container) {
  if (e.target.classList.contains('resize-handle')) return;
  
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  initialX = container.offsetLeft;
  initialY = container.offsetTop;
  
  const dragMove = (e) => drag(e, container);
  const dragEnd = () => {
    isDragging = false;
    document.removeEventListener('mousemove', dragMove);
    document.removeEventListener('mouseup', dragEnd);
  };
  
  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
}

function drag(e, container) {
  if (!isDragging) return;
  
  e.preventDefault();
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  
  container.style.left = `${initialX + dx}px`;
  container.style.top = `${initialY + dy}px`;
}

function stopDragging() {
  isDragging = false;
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDragging);
}

function initResize(e, container, position) {
  e.preventDefault();
  e.stopPropagation();
  
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  initialWidth = container.offsetWidth;
  initialHeight = container.offsetHeight;
  initialX = container.offsetLeft;
  initialY = container.offsetTop;
  
  const resizeMove = (e) => resize(e, container, position);
  const resizeEnd = () => {
    isResizing = false;
    document.removeEventListener('mousemove', resizeMove);
    document.removeEventListener('mouseup', resizeEnd);
  };
  
  document.addEventListener('mousemove', resizeMove);
  document.addEventListener('mouseup', resizeEnd);
}

function resize(e, container, position) {
  if (!isResizing) return;
  
  e.preventDefault();
  const dx = e.clientX - resizeStartX;
  const dy = e.clientY - resizeStartY;
  
  let newWidth = initialWidth;
  let newHeight = initialHeight;
  let newX = initialX;
  let newY = initialY;
  
  switch (position) {
    case 'top-left':
      newWidth = initialWidth - dx;
      newHeight = initialHeight - dy;
      newX = initialX + dx;
      newY = initialY + dy;
      break;
    case 'top-right':
      newWidth = initialWidth + dx;
      newHeight = initialHeight - dy;
      newY = initialY + dy;
      break;
    case 'bottom-left':
      newWidth = initialWidth - dx;
      newHeight = initialHeight + dy;
      newX = initialX + dx;
      break;
    case 'bottom-right':
      newWidth = initialWidth + dx;
      newHeight = initialHeight + dy;
      break;
  }
  
  const minWidth = 320;
  const minHeight = 240;
  
  if (newWidth >= minWidth) {
    container.style.width = `${newWidth}px`;
    if (position.includes('left')) {
      container.style.left = `${newX}px`;
    }
  }
  
  if (newHeight >= minHeight) {
    container.style.height = `${newHeight}px`;
    if (position.includes('top')) {
      container.style.top = `${newY}px`;
    }
  }
}

function stopResizing() {
  isResizing = false;
  document.removeEventListener('mousemove', resize);
  document.removeEventListener('mouseup', stopResizing);
}

function startSyncVideo(videoUrl) {
  if (!syncVideoContainer) {
    initSyncVideoPlayer();
  }
  
  currentSyncVideoId = Date.now().toString();
  socket.emit('start_sync_video', {
    videoId: currentSyncVideoId,
    url: videoUrl,
    roomID
  });
  
  syncVideoContainer.style.display = 'block';
  syncVideoPlayer.src = videoUrl;
  syncVideoPlayer.load();
}

function leaveSyncVideo() {
  if (currentSyncVideoId) {
    socket.emit('sync_video_left', {
      videoId: currentSyncVideoId,
      roomID,
      username: username
    });
    currentSyncVideoId = null;
    syncVideoContainer.style.display = 'none';
    syncVideoPlayer.pause();
    syncVideoPlayer.src = '';
    showNotification('已退出视频同步播放', 'info');
  }
}

function acceptSync(videoId, url) {
  if (!syncVideoContainer) {
    initSyncVideoPlayer();
  }
  
  currentSyncVideoId = videoId;
  syncVideoContainer.style.display = 'block';
  syncVideoPlayer.src = url;
  syncVideoPlayer.load();
  
  socket.emit('sync_video_accepted', { videoId, roomID });  
  socket.emit('sync_video_join', {
    videoId: currentSyncVideoId,
    roomID
  });
  
  const invitation = document.querySelector('.sync-invitation');
  if (invitation) {
    invitation.remove();
  }
}

function declineSync() {
  const invitation = document.querySelector('.sync-invitation');
  if (invitation) {
    const videoId = invitation.getAttribute('data-video-id');
    socket.emit('sync_video_declined', {
      videoId,
      roomID
    });
    invitation.remove();
  }
}

function onVideoPlay() {
  if (currentSyncVideoId) {
    socket.emit('sync_video_control', {
      type: 'play',
      time: syncVideoPlayer.currentTime,
      videoId: currentSyncVideoId,
      roomID
    });
  }
}

function onVideoPause() {
  if (currentSyncVideoId) {
    socket.emit('sync_video_control', {
      type: 'pause',
      time: syncVideoPlayer.currentTime,
      videoId: currentSyncVideoId,
      roomID
    });
  }
}

function onVideoSeeked() {
  if (currentSyncVideoId && !syncVideoPlayer.seeking) {
    socket.emit('sync_video_control', {
      type: 'seek',
      time: syncVideoPlayer.currentTime,
      videoId: currentSyncVideoId,
      roomID
    });
  }
}

window.onload = function () {
  dialogElement = document.getElementById("dialog");
  inputElement = document.getElementById("input");
  fileInputElement = document.getElementById("fileInput");
  announcementElement = document.getElementById("announcement");
  videoUrlElement = document.getElementById('videoUrl');
  initSocket();
  register();
  initSyncVideoPlayer();
  
  inputElement.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (e.shiftKey) { 
        return;
      }
      e.preventDefault();
      send();
    }
  });
  
  videoUrlElement.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {  
      e.preventDefault();
      playVideoFromUrl();
    }
  });
};