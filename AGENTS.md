# PDF2zh 子插件维护

在 D:/Agent Workspaces 工作区内工作时，先读取工作区与 remote-access 父规则。此组件唯一主源码为 src/，对应既有公开仓库 aaAarJimedes/zotero-pdf2zh-companion；不复制用户偏好、凭据、运行数据库或整套 Server。

- 保持一个工具栏按钮、回环服务地址及 Zotero 内置查看器。不得因更新重启/结束在途翻译或自行提交文献。
- 启动环境从 Python 的 sys.prefix/base_prefix 构造；Windows Path/PATH 大小写合并、路径去重，environmentAppend=false。
- 2.2.0 首次配置用两个文件选择器指定官方 Server 和已安装兼容依赖的 Python，不写入机器固定路径。配置与开关串行保存；运行服务须核对 health.outputDir 对应所选 Server，不能仅凭端口健康复用另一套服务。
- history-patch.js 只替换已知历史模块；清空以本机页面的结束时间过滤旧记录，完成于清空之后的任务保留。使用页面内确认对话框；拒绝覆盖不兼容页面，重复安装幂等。
- src/quality 为质量增强和后台进度的唯一主源码；默认开关由现有按钮右键菜单控制，关闭全部译文/排版增强后恢复原生命令，只影响后续任务，后台进度与历史修复仍保留。figure_guard.py 只安装进程内挂钩，不改 BabelDOC 文件；迁移旧本机补丁须在无活动引擎时按已知摘要恢复，不能将旧补丁当新机依赖。安装器只改匹配的公共执行入口并部署自身运行文件，不镜像整套 Server；首次加载入口须等待任务结束后重启。引擎锁在 pdf2zh-next 2.9.0 / BabelDOC 0.6.2 的 OpenAI 兼容服务，保留原生凭据、工作数及术语设置，不恢复暂停队列。正文与结构候选检查不算语义验收，目录放不下时保留原列。
- requirements-runtime.txt 来自实际干净 Windows Python 3.13 环境的 pip freeze，排除打包工具本身，不包含本地路径、editable、direct URL 或私人源；变更依赖后须在独立环境复验，不凭安装成功认定业务功能通过。官方主插件/Server 保持原版，不维护 fork，不捆绑整个环境或私有配置。
- 质量改动同时运行 tests/quality_guard.py、figure_guard.py（--offline 为无引擎 CI）和 quality_hook.py；完整环境追加 quality_pdf.py、quality_engine.py 及针对原版 Server 的 pipe-progress.py，对合成资料测试，不自行提交用户文献。运行临时文件归本项目 Temp；增强报告只含非敏感摘要、计数、页码和坐标。
- 变更后运行 tests/smoke.js、tests/environment.js、tests/history.js、tests/windows-native.py，按需运行本机 tests/local-runtime.cjs。build.ps1 构建后运行 tests/release.ps1。真实 UI 验证与代码测试分别记录，不把进度完成等同于功能验收。
- 2.2.0 新安装验收已覆盖 Windows / PSF Python 3.13.16 / Zotero 10.0.6 的独立配置、文献库、Server 与 venv：实际文件选择、启动、合成两页右键翻译及单语/LR 自动回挂，摘要与输出相符，225 份引擎源码未改写；增强关闭状态跨重启保留，恢复开启已读回，回挂 LR 的原生阅读器显示与首页目录位置已查看。界面历史验证只确认取消保留记录，实际删除由代码测试覆盖；其他系统、复杂 OCR 和真实论文语义不据此宣称通过，细节见 VERIFICATION.md。保留既有原文/译文与暂停批量边界。
- 本机运行、回退与发行包归 Delivery/remote-access/PDF2zh。更新静态历史页面无需重启 Server；更新插件不能打断在途队列，必要时保留待重新加载状态。
- GitHub 使用本机 git/gh。沿用 main 和单页发布楼，历史正文/标签/真实附件保全，上传与删除串行、下载摘要核验后才移除旧页。用户已于 2026-10-15 明确要求公开仓库，仅所有者保留写入与发布权限；不添加其他写入协作者。公开发行下载和更新清单须可匿名访问，实际界面更新是否验收另行如实说明。
