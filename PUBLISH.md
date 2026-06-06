# 发布指南

| 方式 | 适用场景 | 是否生成 CHANGELOG |
|---|---|---|
| [一、本地快速发布（绕过 Changesets）](#一本地快速发布绕过-changesets) | 快速修复，不关注 CHANGELOG | ❌ |
| [二、通过 GitHub Actions 自动发布](#二通过-github-actions-自动发布) | 推荐的正式发版方式 | ✅（含 PR 链接） |

---

### 零、前提条件

在 [npmjs.com → Access Tokens](https://www.npmjs.com/settings/~/tokens) 中生成 NPM_TOKEN，需要勾选「Bypass two-factor authentication (2FA)」否则会 403

## 一、本地快速发布（绕过 Changesets）

不走 Changesets 流程，**不会自动生成 CHANGELOG**，需手动修改版本号。

### 前提条件

已登录 npm 账号：

```bash
pnpm login --registry https://registry.npmjs.org

pnpm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN
```

### 操作步骤

```bash
cd libs/vite-plugin-crx-hmr

# 1. 手动修改 package.json 中的版本号

# 2. 一步完成：类型检查 + 构建 + 发布到 npm
pnpm release
```

`libs/vite-plugin-crx-hmr/package.json` 中的 `release` 脚本实际执行：

```
pnpm type-check && pnpm build && pnpm publish --no-git-checks
```

---

## 二、通过 GitHub Actions 自动发布

自动发布由 `.github/workflows/release.yml` 驱动，每次 push 到 `main` 分支时触发。

### 前提条件

#### 配置 GitHub Actions

- 在 GitHub 仓库的 **Settings → Actions → General → Workflow permissions** 中勾选 **Allow GitHub Actions to create and approve pull requests**

#### 配置 Secrets

- 在 GitHub 仓库的 **Settings → Secrets and variables → Actions → Repository secrets** 中添加：

| Secret 名称 | 说明 |
|---|---|
| `NPM_TOKEN` | 参考上方「零、前提条件」 |
| `GITHUB_TOKEN` | GitHub Actions 自动注入，**无需手动配置** |

> **注意**：必须添加到 **Repository secrets**，而非 Environment secrets。`release.yml` 中的 job 未绑定任何 `environment`，Environment secrets 对其不可见。

### 发布流程

自动发布分两个阶段，由 `changesets/action` 根据当前仓库状态自动判断执行哪个阶段：

#### 阶段一：创建「Version Packages」PR

**触发条件**：`.changeset/` 目录中存在未处理的 changeset 文件（即执行过 `pnpm changeset` 并 push 后）

**执行动作**：`changesets/action` 自动创建或更新一个名为「Version Packages」的 PR，PR 内包含：

- `libs/vite-plugin-crx-hmr/package.json` 版本号更新
- `libs/vite-plugin-crx-hmr/CHANGELOG.md` 变更记录（含 PR 链接）

#### 阶段二：发布到 npm

**触发条件**：「Version Packages」PR 被合并到 `main` 分支

**执行动作**：`changesets/action` 执行 `pnpm release`（即 `pnpm build && changeset publish`），完成：

- 构建 `libs/vite-plugin-crx-hmr/dist/` 产物
- 将包发布到 npm（启用 npm provenance，证明包由 CI 构建）
- 在 GitHub 上打对应版本的 Tag

### 完整操作步骤

```bash
# 1. 本地创建 changeset
pnpm changeset

# 2. 提交 changeset 文件并推送到 main
git add .changeset/
git commit -m "chore: add changeset for vite-plugin-crx-hmr"
git push origin main
# → 触发 release workflow，自动创建「Version Packages」PR

# 3. 在 GitHub 上合并「Version Packages」PR
# → 再次触发 release workflow，自动构建并发布到 npm
```
