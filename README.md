# 🏠 Home Pantry 家庭食材管理

一个简洁的家庭食材管理小程序，帮助你记录食材、追踪过期日期，避免食物浪费。

## ✨ 功能特性

- **添加食材** - 记录名称、数量、过期日期和存放位置
- **过期提醒** - 智能识别临期和过期食材，用颜色直观区分
  - 🟢 绿色：正常（超过3天过期）
  - 🟡 黄色：临期（3天内过期）
  - 🔴 红色：已过期
- **位置管理** - 支持自定义存放位置（冷藏、冷冻等）
- **双视图模式** - 列表视图和网格视图自由切换
- **一键标记** - 食材吃完后快速标记删除
- **搜索筛选** - 按名称搜索和按位置筛选
- **数据隔离** - 基于微信 open_id 的多用户数据隔离
- **跨设备同步** - 数据存储在云端，多设备自动同步

## 🛠 技术栈

- **平台**: 微信小程序
- **前端**: 微信小程序原生框架（WXML + WXSS + JS）
- **后端**: Supabase（REST API + Edge Functions）
- **数据库**: PostgreSQL
- **用户认证**: 微信登录（wx.login + open_id）

## 📦 项目结构

```
HomePantry_mini/
├── app.js                          # 应用主入口
├── app.json                        # 小程序配置
├── app.wxss                        # 全局样式
├── pages/
│   └── index/
│       ├── index.js                # 主页面逻辑
│       ├── index.wxml              # 主页面结构
│       ├── index.wxss              # 主页面样式
│       └── index.json              # 主页面配置
├── utils/
│   ├── supabase.js                 # Supabase API 封装
│   └── date.js                     # 日期处理工具
├── supabase-edge-functions/
│   └── wechat-login/
│       └── index.ts                # 微信登录 Edge Function
└── supabase-migrations/
    ├── 001_add_user_id.sql         # 添加 user_id 字段
    ├── 002_setup_rls.sql           # RLS 策略（已废弃）
    └── 003_disable_rls.sql         # 禁用 RLS，改用 SQL 过滤
```

## 🚀 部署步骤

### 1. 克隆项目

```bash
git clone https://github.com/MasonWest/home-pantry.git
cd HomePantry_mini
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 Supabase SQL 编辑器中执行以下迁移文件：

```bash
# 依次执行
supabase-migrations/001_add_user_id.sql
supabase-migrations/003_disable_rls.sql
```

注意：`002_setup_rls.sql` 已废弃，不要执行。

3. 创建微信登录 Edge Function
   - 在 Supabase Dashboard → Edge Functions → New Function
   - 命名为 `wechat-login`
   - 复制 `supabase-edge-functions/wechat-login/index.ts` 内容
   - 在 Secrets 中配置：
     - `WECHAT_APPID`: 你的微信小程序 appid
     - `WECHAT_SECRET`: 你的微信小程序 appsecret

### 3. 配置微信小程序

1. 在 [微信公众平台](https://mp.weixin.qq.com) 注册小程序
2. 获取小程序 AppID
3. 在 `project.config.json` 中配置 AppID

### 4. 开发工具

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目目录
3. 编译预览

## 📊 数据库结构

### pantry_items 表（食材表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT | 主键，自增 |
| name | TEXT | 物品名称（必填） |
| quantity | INTEGER | 数量（默认1） |
| expiry_date | DATE | 过期日期（必填） |
| location | TEXT | 存放位置（必填） |
| user_id | TEXT | 用户 open_id（必填，用于数据隔离） |
| created_at | TIMESTAMP WITH TIME ZONE | 创建时间（自动） |

### custom_locations 表（自定义位置表）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | BIGINT | 主键，自增 |
| name | TEXT | 位置名称（必填，唯一） |
| user_id | TEXT | 用户 open_id（必填，用于数据隔离） |
| created_at | TIMESTAMP WITH TIME ZONE | 创建时间（自动） |

## 🔒 数据隔离机制

本项目使用 **SQL 层面过滤** 实现数据隔离：

- 所有查询都添加 `user_id=eq.${userId}` 条件
- 所有写操作都包含 `user_id` 字段
- 所有删除和更新操作都同时匹配 `id` 和 `user_id`
- 即使数据库策略宽松，代码层面也保证每个用户只能访问自己的数据

**优点：**
- ✅ 简单可靠，不依赖 Supabase 特殊功能
- ✅ 性能更好，单次请求完成
- ✅ 易于调试，日志清晰
- ✅ 无状态，不依赖连接池

## 📱 使用说明

1. **首次登录**
   - 打开小程序后自动调用微信登录
   - 获取 open_id 并存储到本地
   - 用于数据隔离和跨设备同步

2. **添加食材**
   - 填写物品名称、数量
   - 选择过期日期和存放位置
   - 点击"添加物品"

3. **查看状态**
   - 绿色表示正常
   - 黄色表示临期（3天内）
   - 红色表示已过期

4. **标记吃完**
   - 点击"已吃完"按钮可删除食材记录

5. **管理位置**
   - 点击存放位置旁边的 "+" 按钮
   - 可添加、编辑、删除自定义位置

6. **搜索筛选**
   - 在搜索框输入食材名称
   - 点击位置标签进行筛选

## 🎨 视图模式

- **列表视图** - 完整信息展示，适合查看详情
- **网格视图** - 紧凑卡片展示，适合快速浏览

## 🔧 旧数据迁移

如果从旧版本迁移，需要更新数据库中的 user_id：

```sql
-- 查看当前有哪些 user_id
SELECT DISTINCT user_id FROM pantry_items;
SELECT DISTINCT user_id FROM custom_locations;

-- 将所有数据更新为你的 open_id（替换下面的 open_id）
UPDATE pantry_items SET user_id = '你的_open_id_放在这里';
UPDATE custom_locations SET user_id = '你的_open_id_放在这里';

-- 验证更新
SELECT user_id, COUNT(*) FROM pantry_items GROUP BY user_id;
SELECT user_id, COUNT(*) FROM custom_locations GROUP BY user_id;
```

获取 open_id 的方式：
- 在小程序控制台查看日志，搜索 `获取到 open_id:`

## 📄 许可证

MIT License

## 📞 联系方式

- GitHub: https://github.com/MasonWest/home-pantry
- 问题反馈: 在 GitHub 上提交 Issue

---

**注意**: 本项目仅供个人学习和小范围使用。如需公开发布，请确保 Supabase 配置安全并添加必要的保护措施。