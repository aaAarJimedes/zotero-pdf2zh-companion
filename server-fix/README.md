# Windows 后台进度修复

适用于 PDF2zh Server 4.1.7：后台启动没有控制台缓冲区，原版 Windows 监视器无法读到进度，任务实际运行但页面停在“初始化”。

安装（先等待翻译任务结束）：

```powershell
./server-fix/install.ps1 -ServerDirectory 'D:\softwares\zotero-pdf2zh\server'
```

然后停止旧 Server，再点击现有 2.0.0 子插件按钮。无需重新安装 XPI。

补丁只修改执行器的 Windows 分支并增加一个辅助模块：真实控制台继续走原版路径；后台方式合并读取 stdout/stderr，按回车/换行逐条送入原版进度解析器，保留跨块 UTF-8 和未完成行，并继续转发日志。不伪造百分比，不改变翻译服务、配置或文件导入。

Server 自身升级可能覆盖补丁，需要重新检查安装；脚本遇到不匹配的执行器会拒绝修改。回退时将 Windows 分支恢复为 `_execute_with_inherit(final_cmd, final_env, task_id, cols)` 并删除 `utils/companion_pipe_progress.py`，重启 Server。

## 验证

```powershell
python tests/pipe-progress.py 'D:\softwares\zotero-pdf2zh\server'
```

2026-09-15 在 Windows 本机已安装的 Server 4.1.7 执行器上通过：真实 Rich 输出 → 后台输出流 → 原版解析器 → 原版 TaskManager，任务未退出时可观察到 25%、50%、75%，最终 100%；覆盖回车刷新、分块输出、标准错误及非零退出传播。测试不上传论文、不调用翻译 API；完整论文的页面进度仍应由下一次正常翻译验收。
