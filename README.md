
# Secure-Chat

## 简介
这是一个在线聊天室应用。基于[chat-room](https://github.com/songquanpeng/chat-room/) 修改。
### 新增内容
- **聊天室在线人数** (在输入框上面显示当前房间在线用户及用户列表)
- **发送时间** 
- **聊天室密码功能** (第一个创建房间的用户可以设置密码，其他用户必须正确输入密码才能进入该房间)
- **图片lightbox特效**
- **聊天窗口自动嵌入分享的YouTube链接**
- **视频同步播放功能**
- **`Markdown`语法支持表格，代码高亮及任务列表**


### 特点如下（来自[chat-room](https://github.com/songquanpeng/chat-room/)）：
1. 支持发送图片消息，音频消息，视频消息以及文件消息。
2. 支持多房间，每个链接都是一个独立的聊天室，例如： https://onlinechat-0iyv.onrender.com/?roomID
3. 支持管理员踢人，输入 `kick username` 即可。
4. 第一个进入房间的自动成为管理员。
5. 页面为移动端做了专门优化。

## 演示

演示站： 
- 首页 - https://onlinechat-0iyv.onrender.com/
- 第一个用户输入用户名，房房号及密码(可选)即可进入聊天室。
- 其他用户输入对应的房间号及密码（可选）即可进入对应的聊天室。

首次访问需要稍等几秒，这是由于应用冻结了，之后就会好很多。

截图展示：
- 首页
![首页展示](https://github.com/user-attachments/assets/59306c0e-51e2-4db0-93e8-06c62acd84bb)
- 聊天室
![截图演示](https://github.com/davoola/onlinechat/assets/5195440/ad25ff93-43c4-4205-84ee-329e96cb7908)


## 部署

### 通过 Docker 部署
执行：`docker run --restart=always -d -p 3000:3000 davoola/secure-chat:latest`

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
        image: davoola/secure-chat:latest
```

### 通过源码部署
```shell script
git clone https://github.com/davoola/Secure-Chat.git
cd Secure-Chat
# 安装依赖
npm install
# 启动服务
npm start
# 推荐使用 pm2 进行启动
# 1. 安装 pm2
npm i -g pm2
# 2. 使用 pm2 启动服务
pm2 start ./server.js --name Secure-Chat
```

## 其他
代码主要来自：https://github.com/songquanpeng/chat-room/ 。
