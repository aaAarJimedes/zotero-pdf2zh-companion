# Windows 后台进度与旧环境维护

伴侣 **2.2.0** 已将后台进度修复纳入 XPI 的自动安装流程。新电脑按仓库 README 安装官方 PDF2zh 4.1.7、伴侣和兼容 Python 环境，再在按钮中选择 Server/Python 即可，不需要单独运行这里的脚本。

PDF2zh Server 4.1.7 的原版 Windows 监视器依赖控制台缓冲区。Zotero 在后台启动 Server 时没有这个缓冲区，任务可能实际运行而页面停在“初始化”。适配器检测后台方式后合并读取 stdout/stderr，按回车和换行送入原版进度解析器，处理跨块 UTF-8 与未完成行；有真实控制台时继续走官方路径。不伪造百分比，不改变服务商或附件导入。

唯一适配器源码为 `src/quality/companion_pipe_progress.py`。统一安装器 `src/quality/install_quality.py` 将其与质量运行文件一起部署；`server-fix/` 不保存第二份实现。Server 更新覆盖已知入口后再次打开按钮会检查安装，未知入口拒绝修改。首次改动执行器后应等当前翻译完成，再由用户重启服务，插件不结束活动任务。

## 维护旧版本

仍使用旧子插件且只需要后台进度时，可在仓库根目录运行以下脚本；先确认没有翻译引擎运行，路径改为自己的安装目录：

```powershell
.\server-fix\install.ps1 -ServerDirectory 'C:\PDF2zh\server'
```

脚本复用上述唯一辅助源码，只适配已知执行器。结束旧服务并重新打开后生效。旧脚本不代替 2.2.0 的完整安装，也不部署译文与排版增强。

历史页面的独立维护入口仍为 `install-history.cjs`。2.2.0 打开服务页面时自动处理，无需手工执行；清空仅过滤当前页面旧历史，不删除 PDF 或终止任务。

## 验证

完整测试需要原版 Server 源码与已安装兼容依赖的 Python，因此 CI 不另行下载 Server：

```powershell
python .\tests\pipe-progress.py 'C:\PDF2zh\server'
```

测试通过真实 Rich 输出、后台输出流、原版解析器与 TaskManager 核对 25%、50%、75% 和 100%，并覆盖回车刷新、分块输出、标准错误、非零退出传播。它使用合成进度，不上传论文或调用翻译 API。

2026-10-13 在干净原版 Server 与独立 venv 中，已重新核对原版 TaskManager 在任务运行中记录 0%、25%、50%、75% 与 100%。Zotero 10.0.6 的全新配置另已通过按钮启动和两页合成 PDF 右键翻译，单语/LR 双语自动回挂且与 Server 输出摘要一致。使用本机合成模型响应，没有提交用户论文；具体测试范围见仓库 `VERIFICATION.md`，不以旧的 2026-09-15 记录替代本轮结果。
