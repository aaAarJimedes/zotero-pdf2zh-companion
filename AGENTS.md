# PDF2zh 子插件维护

在 D:/Agent Workspaces 工作区内工作时，先读取工作区与 remote-access 父规则。此组件唯一主源码为 src/，对应既有私有仓库 aaAarJimedes/zotero-pdf2zh-companion；不复制用户偏好、凭据、运行数据库或整套 Server。

- 保持一个工具栏按钮、回环服务地址及 Zotero 内置查看器。不得因更新重启/结束在途翻译或自行提交文献。
- 启动环境从 Python 的 sys.prefix/base_prefix 构造；Windows Path/PATH 大小写合并、路径去重，environmentAppend=false。
- history-patch.js 只替换已知历史模块；清空以本机页面的结束时间过滤旧记录，完成于清空之后的任务保留。使用页面内确认对话框；拒绝覆盖不兼容页面，重复安装幂等。
- 变更后运行 tests/smoke.js、tests/environment.js、tests/history.js、tests/windows-native.py，按需运行本机 tests/local-runtime.cjs。build.ps1 构建后运行 tests/release.ps1。真实 UI 验证与代码测试分别记录，不把进度完成等同于功能验收。
- 本机运行、回退与发行包归 Delivery/remote-access/PDF2zh。更新静态历史页面无需重启 Server；更新插件不能打断在途队列，必要时保留待重新加载状态。
- GitHub 使用本机 git/gh。沿用 main 和单页发布楼，历史正文/标签/真实附件保全，上传与删除串行、下载摘要核验后才移除旧页。私有可见性不改变；匿名自动更新限制必须如实说明。
