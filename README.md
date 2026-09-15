# PDF2zh 本地伴侣：单按钮版

版本 **2.0.0**。只做一件事：点击 Zotero 工具栏的 **PDF2zh Server** 按钮，按需启动本机 Server，并用 Zotero 自带网页查看器打开 Server 页面。页面在 Zotero 应用内的独立窗口中显示，不是系统浏览器，也不是文献阅读标签页。重复点击会聚焦已有窗口。

不需要选择条目。不会提交翻译、上传论文、导入附件、配对 PDF、打开对照阅读器、轮询阅读标签页或增加诊断接口。翻译与附件管理继续使用原版 [Zotero PDF2zh](https://github.com/guaguastandup/zotero-pdf2zh)；Server 页面的操作由 Server 自身提供。**不能保证从 Server 网页上传的 PDF 会自动挂回 Zotero 条目**；需要自动回挂时请使用原版 PDF2zh 的翻译入口。

## 安装与设置

Windows 10/11、Zotero 9、已配置好的 PDF2zh Server 和 Python/Conda 环境。

1. 从 [Releases](https://github.com/aaAarJimedes/zotero-pdf2zh-companion/releases/latest) 下载 XPI。
2. Zotero → 工具 → 插件 → 齿轮 → 从文件安装，选择 XPI，然后重启 Zotero。
3. 在设置 → 高级 → 配置编辑器设置字符串：
   - `extensions.zotero.pdf2zh.companion.serverPython`：Conda 环境的 `python.exe` 完整路径。
   - `extensions.zotero.pdf2zh.companion.serverScript`：Server 的 `server.py` 完整路径。
4. Server 地址沿用 `extensions.zotero.pdf2zh.new_serverip`，默认 `http://127.0.0.1:8890`，仅接受本机 HTTP 地址。
5. 点击 **PDF2zh Server** 按钮。服务已运行则直接打开；尚未运行则等待启动后打开。

旧版已配置的 Python/Server 路径会保留。旧的自动对照等首选项不再使用，无需手动清理。若旧服务仍在运行，升级不会替换该进程；需要应用启动环境修复时，先停止旧服务或重启电脑。

## 边界与排错

- Windows 后台任务成功但一直显示“初始化”：安装 [Server 输出流进度补丁](server-fix/README.md)，不需要更换 2.0.0 XPI。

- Server 页面是现有服务的原页面，不增加翻译逻辑，也不修改服务商/API 密钥。
- 服务未运行且路径缺失时显示具体错误；默认等待 45 秒，可用 `extensions.zotero.pdf2zh.companion.serverWaitMs` 调整。
- 保留经过原生 Windows 测试的 Conda 路径规范化，避免重复 `Path`/`PATH`。
- 关闭网页或禁用插件不会主动终止 Server，以免打断任务。服务器也可能随系统关闭；需要时再次点击按钮。
- 打开服务页成功不代表外部翻译供应商可用；限流、HTTP 500 等应由 PDF2zh/翻译服务排查。
- 卸载不会删除服务、Python 环境、配置或任何文献。

## 开发与验证

```powershell
node tests/smoke.js
node tests/environment.js
python tests/windows-native.py
./build.ps1
./tests/release.ps1
```

Windows 原生测试需要 Python 3.12+。构建生成 `dist/pdf2zh-companion-2.0.0.xpi` 与带 SHA-256 的 `dist/updates.json`，两者一起上传 Release。测试涵盖单按钮、点击防重入、启动/复用、内置查看器调用、配置错误与环境变量。真实 Zotero 页面显示仍需要安装后验收，不能以模拟测试代替。

历史 1.x 的真实翻译测试记录保留在 [VERIFICATION.md](VERIFICATION.md)，不作为 2.0 的翻译功能承诺。MIT 许可证。
