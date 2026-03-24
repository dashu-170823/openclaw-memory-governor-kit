# OpenClaw Memory Governor Kit

给 `OpenClaw` 安装一套更完整的记忆治理底座。

这套 kit 不是单独装一个插件，而是把下面 3 层一起补齐：

- `lossless-claw`：负责当前会话上下文，尽量不丢现场
- `OpenViking`：负责跨会话检索，让记忆能延续
- `文件系统`：负责项目事实真相源，保证关键信息可追溯、可核对

在这个基础上，这个仓库再补上：

- `doctor`：巡检当前记忆系统状态
- `repair`：补齐缺失文件并修复记忆配置漂移
- `reindex`：重建项目事实索引
- `promote`：把已批准的候选记忆提升为长期记忆

## 这套东西适合谁

适合下面这类用户：

- 你已经在用 `OpenClaw`
- 你想让记忆系统不只是“能搜到”，而是“有边界、有治理、有巡检”
- 你想把 `lossless-claw + OpenViking + 文件真相源` 这套结构落地
- 你后面准备扩展到更多项目、更多 agent，想先把底座打稳

如果你还没有 `OpenClaw`，或者本机连 `openclaw.json` 都还没有，这个仓库还不是第一步。

## 一句话理解记忆架构

可以把这套结构理解成：

- `lossless-claw` 记住“这次聊天现场”
- `OpenViking` 记住“跨会话还能复用的东西”
- `文件系统` 保存“必须精确、必须回源核对的项目事实”
- `.memory-control` 负责“候选记忆先暂存，别急着写进长期记忆”

也就是说，这不是把所有内容都塞进向量库，而是明确分层：

- 当前会话，不等于长期记忆
- 长期记忆，不等于项目全文
- 项目全文，应该留在文件里

默认共享边界也要讲清楚：

- `OpenViking` 默认同步 `org` 和 `project` 这两层稳定共享记忆
- `agent` 私有记忆默认留在本地文件里，不自动进共享检索层
- 如果以后要把某个 agent 的经验共享出去，应该先人工改写成共享摘要，再写入 `org/project` 层

## 它会给你装什么

安装后会多出两部分：

### 1. Codex Skill

安装到：

```text
<CODEX_HOME>/skills/openclaw-memory-governor
```

作用：

- 让 Codex 知道什么时候该 `doctor`
- 什么时候该 `repair`
- 什么时候该 `reindex`
- 什么时候该 `promote`
- 什么时候该解释记忆分层和作用域

### 2. OpenClaw Runtime Scripts

安装到：

```text
<OPENCLAW_HOME>/scripts/
```

包括：

- `openclaw-memory-governor.mjs`
- `openclaw-memory-governor-lib.mjs`
- `openclaw-memory-governor.test.mjs`

作用：

- 真正执行治理逻辑
- 修补工作区里的记忆规则文件
- 修补 `openclaw.json` 里的记忆相关配置
- 重建 `facts-index.md`
- 管理候选记忆提升流程

## 安装前准备

安装前请先确认：

- 你本机已经有一个可用的 `OpenClaw`
- `~/.openclaw/openclaw.json` 已存在
- `Node.js` 已安装并可在终端里运行 `node`
- 如果你要用跨会话检索，`OpenViking` 相关环境已经准备好

Windows 下最常见的默认路径是：

- `C:\Users\<你的用户名>\.openclaw`
- `C:\Users\<你的用户名>\.codex`

## 快速安装

### 方式 1：默认路径安装

在仓库根目录打开 PowerShell，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### 方式 2：自定义路径安装

如果你的路径不是默认值，执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -OpenClawHome "D:\custom\.openclaw" -CodexHome "D:\custom\.codex"
```

### 方式 3：只复制文件，不立刻修复

如果你只想先把文件装进去，暂时不跑 `repair` / `doctor`：

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -SkipRepair
```

## 安装器会做什么

安装脚本会按这个顺序工作：

1. 检查目标 `OpenClaw` 目录是否存在
2. 检查 `openclaw.json` 是否存在
3. 把 skill 复制到 `<CODEX_HOME>/skills/openclaw-memory-governor`
4. 把 runtime 脚本复制到 `<OPENCLAW_HOME>/scripts`
5. 默认执行：
   - `repair`
   - `doctor`

也就是说，安装器不是只拷文件，它还会尝试把这套记忆治理真正补齐。

## 装完后怎么判断成功

如果安装顺利，你通常会看到：

- skill 已复制到 `.codex/skills/openclaw-memory-governor`
- runtime 已复制到 `.openclaw/scripts`
- `repair` 执行完成
- `doctor` 检查结果通过

如果 `doctor` 输出里大部分是 `PASS`，说明这套底座已经基本装好了。

如果有失败项，最常见的情况是：

- `OpenViking` 当下没有启动
- 本机没有 `Node`
- 目标路径不是你真实在用的 `OpenClaw`

## 最常用的 4 个命令

### 1. 巡检当前状态

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs doctor
```

适合：

- 想检查这套记忆系统现在好不好
- 想知道 `OpenViking`、`Ollama`、治理文件是不是正常

### 2. 修复和补齐

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs repair
```

适合：

- 缺少治理文件
- `facts-index.md` 没生成
- 记忆相关配置漂了

### 3. 重建项目事实索引

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs reindex
```

适合：

- 项目结构变了
- 想让 agent 更快找到真正的事实文件

### 4. 提升候选记忆

```powershell
node <OPENCLAW_HOME>/scripts/openclaw-memory-governor.mjs promote
```

适合：

- 你已经在 `.memory-control/candidates.json` 里准备好了候选记忆
- 这些条目已经被批准
- 你想把它们正式写入长期记忆文件

## 为什么要同时讲 `lossless-claw` 和 `OpenViking`

因为这两者不是一回事。

### `lossless-claw` 做什么

它主要负责：

- 当前会话上下文拼装
- 尽量不丢失当前聊天现场
- 让 agent 在一次会话里保持连续性

它更像“当前上下文引擎”。

### `OpenViking` 做什么

它主要负责：

- 跨会话记忆检索
- 把稳定、可复用的信息留到后面继续用
- 在不同会话之间提供延续性

它更像“长期检索层”。

但这里有一个很重要的边界：

- 默认共享的是 `组织记忆` 和 `项目记忆`
- 不是把每个 agent 的私有经验直接全灌进去

这样做的目的，就是降低“记忆串味”和跨 agent 污染风险。

### 为什么还要保留文件真相源

因为有些东西不能只靠记忆回答，比如：

- 精确配置
- 项目全文
- 架构细节
- 真实脚本内容

这些内容必须回到文件里核对，所以这套方案始终坚持：

**项目全文留在文件里，长期记忆只留摘要、索引、规则和稳定经验。**

## 记忆放哪一层

这套治理大致分成 5 个位置：

- `root`
  - 全局长期记忆和总方向
- `org`
  - 组织规则、共享记忆
- `project`
  - 项目级长期摘要和决策记忆
- `agent`
  - 某个 agent 的私有经验
- `.memory-control`
  - 候选记忆暂存区

其中默认同步关系是：

- `org/project` -> 可以进入 `OpenViking`
- `agent` -> 默认只留在本地文件
- `.memory-control` -> 先暂存，不直接进入共享长期记忆

最重要的一条规则：

**不要把原始整段会话、项目全文、短期任务状态直接写进长期记忆。**

## 常见问题

### 1. 安装时报“找不到 openclaw.json”

说明你给的 `OpenClaw` 路径不对，或者这个机器上还没有初始化过 OpenClaw。

### 2. `doctor` 里 `OpenViking health` 失败

通常表示 `OpenViking` 这一刻没在监听端口，不一定是配置错了。  
你可以先把服务拉起来，再重新跑一次 `doctor`。

### 3. 为什么候选记忆不自动进入长期记忆

这是故意的。  
如果候选记忆一生成就自动进入长期记忆，后面很容易把噪声、短期状态、误判内容写死。

### 4. 为什么项目全文不直接放进 `OpenViking`

因为项目全文是“真相源”，不是“摘要层”。  
把全文直接塞进长期检索层，后面更容易出现混淆、重复和失真。

## 仓库结构

```text
.
├─ install.ps1
├─ LICENSE
├─ README.md
├─ runtime/
│  └─ scripts/
│     ├─ openclaw-memory-governor.mjs
│     ├─ openclaw-memory-governor-lib.mjs
│     └─ openclaw-memory-governor.test.mjs
└─ skill/
   └─ openclaw-memory-governor/
      ├─ SKILL.md
      ├─ agents/
      └─ references/
```

## 开源许可

本项目使用 `MIT License`。
