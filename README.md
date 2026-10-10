# PDF2zh 本地伴侣

当前版本 **2.0.2**。在 Zotero 工具栏提供一个 Server 按钮，启动或复用本机服务，再用 Zotero 内置查看器打开服务页面。翻译与附件导入仍由 PDF2zh 主插件处理。

## 翻译历史清空修复

旧页面只删除浏览器缓存，刷新又将 Server 的历史合并回来。新版保存本机页面的清空时间，并在历史合并时过滤旧记录；清空之后完成的任务正常保留，包括清空时仍在翻译的任务。确认操作改为页面内对话框，避免内置查看器不显示原生 confirm 的情况。取消不会删除记录。

清空仅作用于当前服务地址的本机页面历史列表，不删除原文/译文、不停止任务，也不清空 Server 内存或其他浏览器的存储。更换服务地址会使用另一个页面存储。

插件打开服务页面前会对所配置 Server 目录中的 `index.html` 应用相同修复。只处理已知历史模块；不匹配的页面拒绝覆盖，已修复页面重复打开不会重写。更新页面不需要重启 Server，已有页面刷新后生效。

已安装旧子插件而希望只修复页面，可在仓库目录运行：

```powershell
node .\server-fix\install-history.cjs 'D:\softwares\zotero-pdf2zh\server'
```

## 安装与构建

从当前发布楼下载 `pdf2zh-companion-2.0.2.xpi`，通过 Zotero 插件管理器安装。首次配置继续使用主插件的回环服务地址，以及 `extensions.zotero.pdf2zh.companion.serverPython` / `serverScript`。不要在源码填写本机路径、密钥或用户偏好。

```powershell
node .\tests\smoke.js
node .\tests\environment.js
node .\tests\history.js
python .\tests\windows-native.py
.\build.ps1
.\tests\release.ps1
```

构建输出在 `dist/`：XPI 与包含版本、下载地址和 SHA-256 的 `updates.json`。CI 只测试和生成构建产物，不并发修改发布楼。仓库保持私有；GitHub 下载和更新清单需要有权限的认证，不能保证 Zotero 的匿名自动更新。手动安装 XPI 不依赖匿名更新。

唯一主源码在 `src/`。`tests/local-runtime.cjs` 为维护电脑的实际官方 Python 路径回归，不提交翻译、不调用模型；其他机器应使用通用测试或配置自己的环境。原生后台进度修复见 `server-fix/README.md`，更新历史页面无需重新安装该执行器补丁。

本版同时保留此前本机 2.0.1 的环境修复：读取所选 Python 的真实 `sys.prefix` / `sys.base_prefix`，支持官方 venv 与标准/自定义 Conda，并合并 Windows 的 Path/PATH。验证结果及尚未验证的真实界面范围见 `VERIFICATION.md`。
