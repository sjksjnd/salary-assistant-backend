# 微信云托管部署指南

## 前置准备
- 微信小程序账号（已注册并获取 AppID / AppSecret）
- 云托管已开通（微信公众平台 → 云托管 → 开通）

## 部署步骤

### 1. 创建 MySQL 实例
云托管控制台 → 数据库 → 新建 MySQL：
- 版本：MySQL 8.0
- 规格：入门版 1核1G （初期够用）
- 存储：20GB
- 名称：`salary-mysql`

创建后记录以下信息（在「数据库详情」页查看）：
- 内网地址（HOST）
- 端口（PORT，默认 3306）
- 用户名（USER）
- 密码（PASSWORD）

在数据库中创建数据库 `salary_assistant`：
```sql
CREATE DATABASE salary_assistant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 新建服务
云托管控制台 → 服务列表 → 新建服务：
- 服务名称：`salary-api`
- 来源：代码仓库 / 本地上传
  - 代码仓库：授权 GitHub/Gitee，选择仓库和分支，代码路径填 `backend/`
  - 本地上传：将 `backend/` 目录打包成 zip 上传
- 端口：`3000`
- 监听地址：`0.0.0.0`
- 实例规格：1 核 512MB / 1核1G（初期选最小）
- 实例数：1 （初期 1 个足够）

### 3. 配置环境变量
服务设置 → 环境变量 → 添加以下变量：

```env
NODE_ENV=production
PORT=3000

# 数据库（用第1步创建的 MySQL 内网信息）
DB_HOST=你的MySQL内网地址
DB_PORT=3306
DB_NAME=salary_assistant
DB_USER=你的数据库用户名
DB_PASSWORD=你的数据库密码

# JWT 密钥（随机32位以上字符串）
JWT_SECRET=请替换为32位以上随机字符串
JWT_ACCESS_EXPIRES=2h
JWT_REFRESH_EXPIRES=7d

# 微信小程序
WX_APPID=你的小程序AppID
WX_SECRET=你的小程序AppSecret

# 微信登录出站 TLS（可选）
# 推荐：导入云环境/代理 CA 证书
# WECHAT_CA_CERT_PATH=/path/to/ca.pem
# 应急：仅对微信登录接口关闭证书校验
# WECHAT_TLS_REJECT_UNAUTHORIZED=false

# 管理员（用于 /api/config 全局配置写入）
# 二选一或同时配置，多个值用英文逗号分隔
ADMIN_USER_IDS=1
# ADMIN_OPENIDS=openid1,openid2

# Redis（可选，没有就留空）
# REDIS_HOST=
# REDIS_PORT=6379
# REDIS_PASSWORD=

# 限流
RATE_LIMIT_GLOBAL=100
RATE_LIMIT_LOGIN=5
RATE_LIMIT_CONTRACT=5
RATE_LIMIT_CALC=10

# 反向代理信任设置
# 默认只信任 loopback/linklocal/uniquelocal。若云托管必须按跳数识别真实 IP，可设置为 1。
# TRUST_PROXY=1
```

### 4. 触发部署
- 代码仓库方式：推送代码到指定分支会自动触发构建部署
- 本地上传方式：上传 zip 后点「部署」

查看构建日志，等待构建成功。

### 5. 验证
部署成功后，服务会自动启动并执行：
1. `node migrations/run.js`（建表）
2. `node seeds/run.js`（种子数据）
3. `node src/app.js`（启动服务）

访问服务的公网域名：
```
https://xxx.sh.run.tcloudbase.com/health
```
应返回：`{"status":"ok","timestamp":...}`

### 6. 小程序对接

#### 方式 A：wx.cloud.callContainer（推荐，免配域名）

在小程序 `app.js` 中初始化：
```javascript
wx.cloud.init({
  env: '你的云托管环境ID',
  traceUser: true,
});
```

调用 API：
```javascript
wx.cloud.callContainer({
  path: '/api/workhours',
  method: 'GET',
  header: {
    'X-WX-SERVICE': 'salary-api',
    'Authorization': 'Bearer ' + wx.getStorageSync('token'),
  },
  success: (res) => {
    console.log(res.data);
  },
});
```

#### 方式 B：直接请求公网域名
需要在微信公众平台 → 开发管理 → 服务器域名中配置 request 合法域名。

### 7. 常见问题

**构建失败：找不到 package.json**
- 检查代码路径是否正确（如果代码在 `backend/` 子目录，代码路径填 `backend/`）

**启动失败：数据库连接不上**
- 确认 DB_HOST 是内网地址（不是公网地址）
- 确认数据库和云托管服务在同一环境
- 确认数据库名、用户名、密码正确

**微信登录失败 / SSL证书验证错误**
- 当前代码默认开启 HTTPS 证书验证。
- 若云环境存在自签名代理证书，推荐配置 `WECHAT_CA_CERT_PATH=/path/to/ca.pem`，只给微信登录请求信任该 CA。
- 也可以把 CA 加入系统信任库或使用 Node 官方 `NODE_EXTRA_CA_CERTS`。
- 紧急恢复登录时可设置 `WECHAT_TLS_REJECT_UNAUTHORIZED=false`，它只作用于微信 `jscode2session` 请求；修复 CA 后应移除。可识别的关闭值包括 `false`、`0`、`no`、`off`。
- 启动后首次微信登录会打印 `[WeChat TLS] outbound TLS config`，可用来确认线上是否读到了 CA/关闭校验配置；日志不会包含 AppSecret。
- 如果未设置上述变量但平台返回自签名证书错误，代码会仅对该次微信登录请求自动重试一次并关闭证书校验，同时打印 `[WeChat TLS] self-signed certificate detected...` 警告。

**配置系统 CA 证书**
```dockerfile
# 将 CA 证书添加到系统信任库
COPY ca.pem /usr/local/share/ca-certificates/
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
```

**每次部署都重新执行迁移？**
- 是，但迁移脚本是幂等的（CREATE TABLE IF NOT EXISTS / ON DUPLICATE KEY UPDATE），重复执行安全。
- 如果不想每次都执行，把 Dockerfile 的 CMD 改为只启动服务，首次部署后手动在 Web Shell 里执行迁移。
