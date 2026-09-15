# Zotero PDF2zh Companion

一个面向 Zotero 9 的非官方轻量伴侣扩展。它复用
[zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) 的翻译、文件生成和附件导入能力，只补充两个日常入口：

- 点击一次即可检查并启动本机 PDF2zh Server，然后调用 PDF2zh 翻译当前选择。
- 将同一 Zotero 条目下的原文 PDF 与译文 PDF 放进左右两个阅读器，便于对照阅读。

当前版本：`1.2.2`。

1.2.2 修复了 1.2.1 发行包缺少 `update_url`、被正式安装器拒绝的问题。请下载新版，不要继续安装旧包。新版通过 GitHub Release 的 `updates.json` 提供更新信息。

## 功能边界

本扩展负责：

- 本地 Server 健康检查与按需启动；
- 调用 PDF2zh 的 `translatePDF` 入口；
- 原文/译文附件配对；
- 手动和自动左右对照阅读；
- 本地诊断状态页。

PDF 选择、批量任务、翻译引擎、语言、模型、`mono`/`dual` 文件生成、文件命名以及译文挂回原条目，仍由原版 PDF2zh 负责。本扩展不会修改 PDF2zh 的服务商和模型配置。

## 运行要求

- Windows 10/11；
- Zotero 9；
- 已安装并启用 Zotero PDF2zh；
- 已部署可运行的 PDF2zh Server；
- Server 所需 Python/Conda 环境已经安装依赖。

公开发布包不包含作者机器上的绝对路径。安装后请填写以下两个路径：

```text
%CONDA_ROOT%\envs\zotero-pdf2zh-next-venv\python.exe
%PDF2ZH_ROOT%\server\server.py
```

上面的变量只是路径占位符；首选项中应填写解析后的完整绝对路径，无需重新打包扩展。

## 安装

1. 从 [Releases](https://github.com/aaAarJimedes/zotero-pdf2zh-companion/releases) 下载最新的 `.xpi` 文件。
2. 在 Zotero 中打开“工具 → 插件”。
3. 点击右上角齿轮按钮，选择“从文件安装插件”。
4. 选择下载的 `.xpi`，确认安装并重启 Zotero。
5. 确认原版 PDF2zh 也已启用。

### 配置 Python 与 Server 路径

在 Zotero 中打开“编辑 → 设置 → 高级 → 配置编辑器”，查找并设置：

| 首选项 | 类型 | 说明 |
| --- | --- | --- |
| `extensions.zotero.pdf2zh.companion.serverPython` | 字符串 | Conda 环境中的 `python.exe` 完整路径 |
| `extensions.zotero.pdf2zh.companion.serverScript` | 字符串 | PDF2zh Server 的 `server.py` 完整路径 |
| `extensions.zotero.pdf2zh.companion.serverWaitMs` | 整数 | 等待 Server 就绪的超时时间，默认 `45000` 毫秒 |
| `extensions.zotero.pdf2zh.companion.autoCompareOpenReaders` | 布尔 | 是否自动识别已打开的原文/译文并弹出对照窗口 |
| `extensions.zotero.pdf2zh.companion.stopServerOnDisable` | 布尔 | 禁用扩展时，是否停止由本扩展启动的 Server |

Server 地址沿用 PDF2zh 的
`extensions.zotero.pdf2zh.new_serverip`，因此应与 Server 实际监听地址和端口一致。

## 使用

### 一键启动并翻译

1. 在 Zotero 条目列表中选择 PDF 附件，或选择含 PDF 的父条目。
2. 点击工具栏中的翻译图标。
3. 扩展先访问 PDF2zh Server 的 `/health`；若服务未运行，则用配置的 Conda Python 启动它。
4. Server 就绪后，扩展将当前选择交给原版 PDF2zh。后续翻译、生成文件和附件导入均在 PDF2zh 界面中完成。

扩展启动 Server 时会关闭 Server 自己的二次虚拟环境跳转，并启用 UTF-8 输出，以避免 Windows 控制台编码问题。

### 左右对照阅读

有两种打开方式：

- 选择同时包含原文和译文的父条目，然后点击工具栏中的分栏图标；
- 同时选择同一父条目下的原文、译文两个 PDF，再点击分栏图标。

扩展优先把文件名或标题中包含 `mono`、`dual`、`translated`、`translation`、`pdf2zh`、`译文` 等标识的附件识别为译文。对照窗口支持同步上一页/下一页、单侧翻页、交换左右窗格，以及分别打开完整阅读器。

启用 `autoCompareOpenReaders` 后，如果在 Zotero 中分别打开同一父条目下的原文和译文，扩展会为该附件组合自动打开一次对照窗口。

## 诊断与排错

Zotero 运行时可在浏览器访问：

```text
http://127.0.0.1:23119/pdf2zh-companion/status
```

返回的 JSON 会显示扩展版本、PDF2zh 是否可用、Server 地址与健康状态、配置的 Python/脚本路径、阅读器数量和工具栏按钮状态。

常见问题：

- “找不到 Python”或“找不到 Server 脚本”：检查两个路径首选项是否为绝对路径。
- Server 启动后提前退出：在 Zotero 的“帮助 → 调试输出日志”中查找 `[PDF2zh Server stderr]`。
- 翻译按钮提示未检测到 PDF2zh：确认原版 PDF2zh 已启用并与当前 Zotero 版本兼容。
- 没有找到译文：先确认译文已作为 PDF 附件挂在原父条目下；必要时同时选中原文和译文。
- 端口不一致：检查 PDF2zh 的 `new_serverip` 与 Server 监听端口。

## 从源码构建

要求 PowerShell 5.1+ 和 Node.js 18+：

```powershell
node .\tests\smoke.js
.\build.ps1
```

构建产物位于 `dist\pdf2zh-companion-1.2.2.xpi`。XPI 本质上是以 `.xpi` 为扩展名的 ZIP，根目录直接包含 `manifest.json`、`bootstrap.js`、`prefs.js` 和 `content`。

构建还会生成 `dist\updates.json`，其中包括该 XPI 的 SHA-256 校验值。发布时须将 XPI 和此清单一起上传到对应版本的 GitHub Release，并将正式版本标记为 Latest。构建脚本检查必要安装字段及版本一致性；自动测试不替代真实 Zotero 安装、重启验证。

源码检出可以额外创建被 Git 和构建脚本排除的
`src\local-config.json`，用于保存开发机路径：

```json
{
  "serverPython": "<Python 可执行文件的绝对路径>",
  "serverScript": "<server.py 的绝对路径>"
}
```

## 卸载

在 Zotero 的“工具 → 插件”中找到“PDF2zh 本地伴侣”，选择移除并重启 Zotero。卸载不会删除：

- 原版 PDF2zh；
- Conda 环境或 PDF2zh Server；
- 已生成或已导入 Zotero 的 PDF；
- 用户在配置编辑器中设置的首选项。

如需完全清理，可在配置编辑器中重置所有以
`extensions.zotero.pdf2zh.companion.` 开头的首选项。

## 隐私

伴侣扩展只访问本机 Zotero 与配置的 PDF2zh Server 地址，不额外上传文献。PDF2zh 使用的翻译服务是否会接收 PDF 内容，取决于你在 PDF2zh 中选择的翻译引擎和服务商。

## 许可证

[MIT](LICENSE)
