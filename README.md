
# Online Chat

## 简介
这是一个在线聊天室应用。基于[chat-room](https://github.com/songquanpeng/chat-room/) 修改，添加了当前**聊天室在线人数**及**首页显示**。
首页内容请编辑 `/views/index.ejs` 文件即可。

特点如下（来自[chat-room](https://github.com/songquanpeng/chat-room/)）：
1. 支持发送图片消息，音频消息，视频消息以及文件消息。
2. 有配套的[安卓客户端](https://github.com/songquanpeng/chat-room-android)。
3. 支持多房间，每个链接都是一个独立的聊天室，例如： https://onlinechat-0iyv.onrender.com/roomID
4. 支持管理员踢人，输入 `kick username` 即可。
5. 第一个进入房间的自动成为管理员。
6. 页面为移动端做了专门优化。

## 演示

演示站： 
- 首页 - https://onlinechat-0iyv.onrender.com/
- 聊天页面 - https://onlinechat-0iyv.onrender.com/roomID
> roomID 可以是任意字符串，但不能以"?"开头，如果以'?"开头会打开首页。

首次访问需要稍等几秒，这是由于应用冻结了，之后就会好很多。

截图展示：
![ss](https://github.com/davoola/onlinechat/assets/5195440/11f259ae-b0bc-4f4b-b6d5-e5fa8d90fb07)


## 部署

### 通过 Docker 部署
执行：`docker run --restart=always -d -p 3000:3000 davoola/onelinechat`

开放的端口号为 3000，之后用 Nginx 配置域名，反代以及 SSL 证书即可。

更新版本的命令：`docker run --rm -v /var/run/docker.sock:/var/run/docker.sock containrrr/watchtower -cR`

### 通过Docker-compose部署
docker-compose.ymal文件内容如下：
```yml
version: "3"
services:
    onlinechat:
        restart: always
        ports:
            - 3000:3000
        image: davoola/onlinechat:v2
```

### 通过源码部署
```shell script
git clone https://github.com/davoola/onlinechat.git
cd onlinechat
# 安装依赖
npm install
# 启动服务
npm start
# 推荐使用 pm2 进行启动
# 1. 安装 pm2
npm i -g pm2
# 2. 使用 pm2 启动服务
pm2 start ./app.js --name chat-room
```

## 其他
代码主要来自：https://github.com/songquanpeng/chat-room/ 。
