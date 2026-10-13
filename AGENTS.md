# PDF2zh 子插件维护

在 D:/Agent Workspaces 工作区内工作时，先读取工作区与 remote-access 父规则。此组件唯一主源码为 src/，对应既有私有仓库 aaAarJimedes/zotero-pdf2zh-companion；不复制用户偏好、凭据、运行数据库或整套 Server。

- 保持一个工具栏按钮、回环服务地址及 Zotero 内置查看器。不得因更新重启/结束在途翻译或自行提交文献。
- 启动环境从 Python 的 sys.prefix/base_prefix 构造；Windows Path/PATH 大小写合并、路径去重，environmentAppend=false。
- history-patch.js 只替换已知历史模块；清空以本机页面的结束时间过滤旧记录，完成于清空之后的任务保留。使用页面内确认对话框；拒绝覆盖不兼容页面，重复安装幂等。
- src/quality 为质量增强的唯一主源码；默认开关由现有按钮右键菜单控制，关闭恢复原生命令，只影响后续任务。安装器只改匹配的公共执行入口并部署自身运行文件，不镜像整套 Server；首次加载入口须等待任务结束后重启。引擎锁在 pdf2zh-next 2.9.0 / BabelDOC 0.6.2 的 OpenAI 兼容服务，保留原生凭据、工作数及术语设置，不恢复暂停队列。正文与结构候选检查不算语义验收，目录放不下时保留原列。
- 质量改动同时运行 tests/quality_guard.py（--offline 为无引擎 CI）、quality_hook.py；本机原生环境追加 quality_pdf.py 和 quality_engine.py，对合成资料测试，不自行提交用户文献。运行临时文件归本项目 Temp；增强报告只含非敏感摘要、计数、页码和坐标。
- 变更后运行 tests/smoke.js、tests/environment.js、tests/history.js、tests/windows-native.py，按需运行本机 tests/local-runtime.cjs。build.ps1 构建后运行 tests/release.ps1。真实 UI 验证与代码测试分别记录，不把进度完成等同于功能验收。
- 本机运行、回退与发行包归 Delivery/remote-access/PDF2zh。更新静态历史页面无需重启 Server；更新插件不能打断在途队列，必要时保留待重新加载状态。
- GitHub 使用本机 git/gh。沿用 main 和单页发布楼，历史正文/标签/真实附件保全，上传与删除串行、下载摘要核验后才移除旧页。私有可见性不改变；匿名自动更新限制必须如实说明。
