# NeoBuild

<p align="center">
  <strong>电脑装机配置模拟器</strong><br>
  轻量在线装机助手 — 汇总配件、计算价格、生成可分享清单
</p>

---

## 功能亮点

- **多方案管理** — 支持创建多套配置方案，随时切换、对比、复制
- **10 大预设分类** — CPU / 显卡 / 主板 / 内存 / 硬盘 / 电源 / 散热器 / 机箱 / 风扇 / 显示器，并可自定义分类
- **智能链接识别** — 粘贴京东、淘宝、拼多多、天猫链接自动识别平台，Edge Function 抓取商品标题与图片
- **半自动化价格** — 自动获取商品信息，价格需用户确认输入；已确认价格缓存供所有用户复用
- **实时价格统计** — 自动汇总总价，饼图展示各分类占比
- **导出分享** — 一键生成 PNG 图片或复制文字清单
- **云端同步** — 注册登录后数据自动同步至 Supabase，多设备访问不怕丢失
- **本地优先** — 无需登录即可完整使用，数据保存在 localStorage
- **亮色主题** — 白底冰蓝+橙色双色调设计，干净通透

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 + CSS Variables 设计系统 |
| 状态管理 | Zustand 5 (persist middleware) |
| 云端后端 | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| 图表 | Recharts |
| 图片导出 | html-to-image |
| 图标 | Lucide React |

## 项目结构

```
NeoBuild/
├── public/
│   ├── images/              # 静态图片资源
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── auth/            # 认证相关组件
│   │   │   ├── AuthDialog.tsx      # 登录/注册对话框
│   │   │   ├── LoginPrompt.tsx     # 非强制登录提示
│   │   │   └── UserBadge.tsx       # 用户状态徽章
│   │   ├── build/           # 配置方案核心组件
│   │   │   ├── AddItemDialog.tsx   # 添加配件对话框
│   │   │   ├── AddCategoryDialog.tsx
│   │   │   ├── CategoryCard.tsx    # 分类卡片
│   │   │   ├── ExportPanel.tsx     # 导出面板
│   │   │   └── StatsPanel.tsx      # 统计面板
│   │   ├── layout/
│   │   │   └── Sidebar.tsx         # 侧边栏
│   │   └── ui/              # 基础 UI 组件
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       └── toast.tsx
│   ├── lib/
│   │   ├── cloud.ts         # Supabase 云端 CRUD
│   │   ├── product-api.ts   # 商品链接识别 API + 价格缓存
│   │   ├── supabase.ts      # Supabase 客户端 & Auth
│   │   ├── store.ts         # Zustand 状态管理
│   │   ├── types.ts         # TypeScript 类型定义
│   │   └── utils.ts         # 工具函数
│   ├── App.tsx              # 主应用组件
│   ├── index.css            # 设计系统 CSS 变量
│   └── main.tsx
├── index.html
├── tailwind.config.ts       # Tailwind 配置 (含设计 token)
├── vite.config.ts
└── package.json
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/<your-username>/NeoBuild.git
cd NeoBuild

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
npm run build
npm run preview
```

## 云端同步配置 (可选)

NeoBuild 默认使用 localStorage 存储数据，无需任何后端即可完整使用。如需启用云端同步功能：

1. 在 [Supabase](https://supabase.com) 创建项目
2. 在 SQL Editor 中执行以下建表语句：

```sql
-- 用户资料表
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  created_at timestamptz default now()
);

-- 配置方案表
create table builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 分类表
create table categories (
  id uuid primary key default gen_random_uuid(),
  build_id uuid references builds(id) on delete cascade not null,
  name text not null,
  icon text default 'Package',
  sort_order int default 0,
  is_custom boolean default false
);

-- 配件表
create table items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete cascade not null,
  name text not null,
  price numeric(12,2) default 0,
  link text,
  platform text,
  image_url text,
  note text,
  sort_order int default 0
);

-- 启用 RLS
alter table profiles enable row level security;
alter table builds enable row level security;
alter table categories enable row level security;
alter table items enable row level security;

-- RLS 策略 (示例: builds 表)
create policy "Users can view own builds" on builds for select using (user_id = auth.uid());
create policy "Users can insert own builds" on builds for insert with check (user_id = auth.uid());
create policy "Users can update own builds" on builds for update using (user_id = auth.uid());
create policy "Users can delete own builds" on builds for delete using (user_id = auth.uid());

-- 自动创建 profile 的触发器
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 自动确认邮箱的触发器 (跳过邮箱验证)
create or replace function auto_confirm_user()
returns trigger as $$
begin
  update auth.users
  set email_confirmed_at = now()
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_confirm
  after insert on auth.users
  for each row execute function auto_confirm_user();
```

3. 复制 `.env.example` 为 `.env` 并填入你的 Supabase 项目配置：

```bash
cp .env.example .env
```

在 `.env` 中填入从 Supabase Dashboard → Project Settings → API 获取的值：

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **安全提示**：切勿将 `.env` 文件提交到版本控制。`VITE_SUPABASE_ANON_KEY` 是公开的 anon key（受 RLS 保护），而非 service_role key。

## 商品链接识别 (Edge Function)

NeoBuild 部署了一个 Supabase Edge Function (`fetch-product-info`)，实现半自动化的商品信息抓取：

**工作流程：**

1. 用户粘贴电商链接 → 前端调用 Edge Function
2. Edge Function 抓取目标页面，解析 Open Graph 标签和 JSON-LD 结构化数据
3. 自动提取商品标题、图片、描述；部分页面可提取价格
4. 结果缓存到 `product_cache` 表（按 URL 去重），后续请求直接命中缓存
5. 前端根据返回的 `priceStatus` 显示提示：
   - `cached` — 价格已从缓存获取，提示用户确认
   - `unavailable` — 已识别商品但无法获取实时价格，引导用户手动输入
6. 用户确认的价格回写到缓存，供其他用户复用

**支持平台：** 京东、淘宝、天猫、拼多多（自动识别）

**部署 Edge Function 和数据表：**

在 Supabase SQL Editor 中执行：

```sql
-- 商品价格缓存表
create table product_cache (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  platform text,
  title text,
  image_url text,
  description text,
  price numeric(12,2),
  price_updated_at timestamptz,
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index idx_product_cache_url on product_cache (url);

alter table product_cache enable row level security;

create policy "Authenticated users can read product cache" on product_cache for select to authenticated using (true);
create policy "Authenticated users can insert product cache" on product_cache for insert to authenticated with check (true);
create policy "Authenticated users can update product cache" on product_cache for update to authenticated using (true);
create policy "Anonymous users can read product cache" on product_cache for select to anon using (true);
```

然后通过 Supabase Dashboard 或 CLI 部署 Edge Function（代码见 `supabase/functions/fetch-product-info/`）。

## 设计系统

NeoBuild 采用 CSS Variables + Tailwind 的混合设计系统，定义在 `src/index.css` 和 `tailwind.config.ts` 中：

- **主题风格**: 亮色白底 — 干净通透，高可读性
- **主色调**: Ice Blue (`hsl(210, 70%, 55%)`) — 冰蓝色，用于图标、按钮、交互元素
- **强调色**: Orange (`hsl(25, 95%, 53%)`) — 橙色，用于价格数字、重点高亮
- **背景层级**: White → Card → Surface，白色底上营造微妙层次
- **字体**: Inter (UI) + JetBrains Mono (价格数字)
- **动效**: `cubic-bezier(0.4, 0, 0.2, 1)` 过渡，fade-in 入场动画

## License

MIT
