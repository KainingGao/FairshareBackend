MongoDB atlas kygao22@gmail.com
Render kygao22@gmail.com - github

# FairShare Backend API 文档

## 基础信息

- 基础URL: `https://fairshare-backend-sean.onrender.com`
- 所有请求和响应都使用 JSON 格式
- 所有请求都需要设置 header: `Content-Type: application/json`

## API 端点

### 1. 服务器唤醒接口

由于使用 Render 免费计划，服务器在一段时间不活动后会休眠。首次访问时建议先调用唤醒接口。

```
GET /wake-up
```

响应示例：
```json
{
    "status": "Server is awake"
}
```

### 2. 博客文章接口

#### 2.1 获取所有博客文章

```
GET /api/blogs
```

响应示例：
```json
[
    {
        "_id": "65d1234567890",
        "title": "2024税务更新",
        "excerpt": "了解2024年最新税务政策",
        "content": "文章内容...",
        "category": "Tax Tips",
        "date": "2024-02-18T10:00:00.000Z"
    }
]
```

#### 2.2 创建新博客文章

```
POST /api/blogs
```

请求体：
```json
{
    "title": "文章标题",
    "excerpt": "文章摘要",
    "content": "文章完整内容",
    "category": "分类名称"
}
```

响应示例：
```json
{
    "acknowledged": true,
    "insertedId": "65d1234567890"
}
```

#### 2.3 更新博客文章

```
PUT /api/blogs/:id
```

请求体（可以只包含需要更新的字段）：
```json
{
    "title": "更新后的标题",
    "content": "更新后的内容"
}
```

响应示例：
```json
{
    "acknowledged": true,
    "modifiedCount": 1,
    "matchedCount": 1
}
```

#### 2.4 删除博客文章

```
DELETE /api/blogs/:id
```

响应示例：
```json
{
    "acknowledged": true,
    "deletedCount": 1
}
```

### 3. 聊天助手接口

#### 3.1 创建新对话线程

```
POST /api/chat/thread
```

响应示例：
```json
{
    "threadId": "thread_abc123xyz"
}
```

#### 3.2 发送消息

```
POST /api/chat/message
```

请求体：
```json
{
    "threadId": "thread_abc123xyz",
    "message": "您好，我想了解一下小企业税务申报的流程"
}
```

响应示例：
```json
{
    "message": "助手回复的内容..."
}
```

#### 3.3 获取所有对话线程

```
GET /api/chat/history/threads
```

响应示例：
```json
[
    {
        "threadId": "thread_abc123xyz",
        "createdAt": "2024-02-18T10:00:00.000Z",
        "messageCount": 5
    },
    {
        "threadId": "thread_def456uvw",
        "createdAt": "2024-02-18T11:30:00.000Z",
        "messageCount": 3
    }
]
```

#### 3.4 获取对话历史

```
GET /api/chat/history/:threadId
```

响应示例：
```json
[
    {
        "role": "user",
        "content": "用户发送的消息",
        "timestamp": "2024-02-18T10:00:00.000Z"
    },
    {
        "role": "assistant",
        "content": "助手的回复",
        "timestamp": "2024-02-18T10:00:01.000Z"
    }
]
```

## 错误处理

所有接口在遇到错误时会返回相应的 HTTP 状态码和错误信息：

```json
{
    "message": "错误描述信息"
}
```

常见状态码：
- 200: 请求成功
- 201: 创建成功
- 400: 请求参数错误
- 404: 资源未找到
- 500: 服务器内部错误

## 使用建议

1. 第一次调用 API 时，建议先调用 wake-up 接口
2. 博客文章的创建和更新操作要确保必填字段都已提供
3. 聊天功能使用时要先创建线程，保存返回的 threadId 用于后续对话
4. 所有请求都应该包含错误处理逻辑

## 注意事项

1. 服务器部署在 Render 免费计划上，首次请求可能需要等待 30 秒左右
2. 图片内容建议使用外部存储服务，API 只处理文本内容
3. 建议在前端实现适当的加载状态和错误提示
4. 聊天接口的响应时间可能较长，建议实现适当的超时处理