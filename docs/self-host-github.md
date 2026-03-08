# GitHub 自部署双人使用

这个 fork 的推荐上线方式：

- 前端部署到 Cloudflare Pages
- 数据存 GitHub 私有仓库
- 两个人各自使用自己的 GitHub 账号和 Token
- 共用同一个账本仓库

## 1. Cloudflare Pages

导入你的 fork 仓库后，使用下面的构建参数：

- Framework preset: `None`
- Build command: `corepack pnpm install --frozen-lockfile && corepack pnpm exec vite build`
- Build command (alternative): `corepack pnpm install --frozen-lockfile && corepack pnpm run build:cloudflare`
- Build output directory: `dist`
- Node.js version: `22`

如果你想把登录页固定成 GitHub 自部署模式，在 Cloudflare Pages 的环境变量里加：

- `VITE_SELF_HOST_GITHUB_ONLY=true`
- `VITE_DISABLE_OAUTH_LOGIN=true`

这样登录页会：

- 只保留 GitHub 登录入口
- 默认强调手动 Token 登录
- 提示每位协作者都要使用自己的 GitHub Token

## 2. GitHub Token

两个人都需要各自创建自己的 Token。

推荐配置：

- 类型：`Personal access tokens (classic)`
- 权限：`repo`

不要共用一个 GitHub 账号，也不要共用一个 Token。当前 AA 结算依赖账单的 `creatorId` 区分付款人；如果共用同一个身份，结算会失真。

## 3. 创建和共享账本

1. 你打开自己部署的网址。
2. 点击 `Use GitHub token`，输入你自己的 Token。
3. 创建一个新账本。
4. 应用会在你的 GitHub 下创建一个私有仓库，名字通常以 `cent-journal-` 开头。
5. 打开这个仓库的 GitHub 页面。
6. 进入 `Settings -> Collaborators`。
7. 把另一位成员添加为 Collaborator。
8. 对方接受邀请。
9. 对方打开同一个网址，输入自己的 GitHub Token。
10. 对方进入同一个账本。

## 4. AA 结算前提

当前实现的规则是：

- `creatorId` 表示谁付款
- `归属` 标签组表示这笔支出算 `家 / 瑞 / 蕊`

因此要正常使用双人 AA：

- 两个人都必须分别登录
- 账本必须是同一个共享仓库
- 记账时要给支出选择 `归属` 标签

## 5. 验证

最小验证流程：

1. 你新增一笔“家支出”。
2. 对方刷新后能看到。
3. 对方新增一笔自己的支出。
4. 你刷新后能看到。
5. 进入统计页，确认 AA 结算面板能区分两个人的付款和归属。
