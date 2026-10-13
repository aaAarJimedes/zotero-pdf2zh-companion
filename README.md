# PDF2zh 本地伴侣

当前版本 **2.2.0**。在 Zotero 工具栏提供一个 Server 按钮，启动或复用本机服务，再用 Zotero 内置查看器打开服务页面。翻译与附件导入仍由官方 PDF2zh 主插件处理。

2026-10-13 已核对[官方发行版](https://github.com/guaguastandup/zotero-pdf2zh/releases/tag/v4.1.7)：最新版本仍为 **4.1.7**，本机主插件与官方 XPI 摘要一致。官方主分支此后只有 README 更新，没有需要替换的程序更新。本项目不维护上游分叉，也不分发主插件或整套 Python 环境。

另一台 Windows 电脑安装官方主插件、本伴侣、下述 Python/Server 环境，并填写自己的 API 配置后，即可使用相同增强。启动环境修复、后台进度、历史清空、图表保护和质量检查都由伴侣部署，不需要手改 Server 或 `site-packages`。

## 默认译文与排版增强

默认开启，右键现有 Server 按钮可取消勾选“译文与排版增强”。也可使用偏好 `extensions.zotero.pdf2zh.companion.qualityEnabled`。开关只影响后续任务，关闭后恢复原生引擎命令和保存的原生排版选项，不停止在途任务。

子插件在配置的 Server 中安装一个受保护执行入口及自己的运行文件，复用所选 Python、模型、API 配置、工作数、限速和术语设置，不另建翻译服务。首次安装入口后，已运行的 Server 需要在任务结束后重启一次；安装器会提示，不自行结束任务。Server 升级覆盖入口后再次打开按钮会检查并重装，未知执行器源码拒绝修改。卸载子插件前先关闭增强开关。

图表保护现在随增强进程临时加载，不改写 BabelDOC 安装文件。一个开关控制全部译文与排版增强，关闭后恢复原生引擎处理；启动、后台进度和历史页面修复继续保留。此前手动装过本机图表补丁的环境，升级时需先确认没有翻译引擎运行，再用原补丁维护工具按已知摘要恢复官方文件；不要将旧补丁复制到新电脑。

- 正文与批量回复先核对格式、编号、公式占位符、引文编号、明显未译和模型自述；无效缓存不直接复用，每次请求最多三次尝试。失败的批量仍允许原引擎单段回退，保留原文不代表翻译成功。
- 根据源文件结构和原生布局分类保护图表内部文字、参考文献与页脚。可靠目录只翻译标题，保留章节号、页码和目标链接；某列翻译失败或放不下时保留原列并记录候选问题，不猜测正文的裁切边界。
- 每任务关闭富文本重排与表格内部翻译，以重现已认可的试验版行为，不修改用户原生保存值。自动术语抽取仍遵从主插件设置，伴侣不替用户关闭它。
- 原生生成后完成目录重建、参考文献/页脚矢量恢复和版面候选检查，再以原生文件名交给主插件回挂。旁边的 `*.quality-checks.json` 只记录计数、页码、坐标及摘要，不保存正文、提示或凭据。

当前适配 Server 4.1.7 的已知公共执行入口、pdf2zh-next 2.9.0 / BabelDOC 0.6.2 和 OpenAI 兼容服务。原版 1.x 与独立 exe 保持原生流程；使用其他 2.x 服务或不同引擎版本时关闭增强后使用原生流程。支持不分段的整篇 mono、LR、译文优先与交替页面；指定页码、仅保留译页及分段翻译会在模型请求前停止并提示关闭增强，复杂 OCR 尚未验收。没有全页重新流排或视觉模型自动修图，固定段落区域的大留白仍可能存在；检查报告不等于语义验收。

## 翻译历史清空修复

旧页面只删除浏览器缓存，刷新又将 Server 的历史合并回来。新版保存本机页面的清空时间，并在历史合并时过滤旧记录；清空之后完成的任务正常保留，包括清空时仍在翻译的任务。确认操作改为页面内对话框，避免内置查看器不显示原生 confirm 的情况。取消不会删除记录。

清空仅作用于当前服务地址的本机页面历史列表，不删除原文/译文、不停止任务，也不清空 Server 内存或其他浏览器的存储。更换服务地址会使用另一个页面存储。

插件打开服务页面前会对所配置 Server 目录中的 `index.html` 应用相同修复。只处理已知历史模块；不匹配的页面拒绝覆盖，已修复页面重复打开不会重写。更新页面不需要重启 Server，已有页面刷新后生效。

维护旧版本时可单独修复页面；2.2.0 正常安装不需要此步骤：

```powershell
node .\server-fix\install-history.cjs 'C:\PDF2zh\server'
```

## 新电脑安装（Windows）

本轮验证使用 Windows、PSF 官方 **Python 3.13.16 64 位**、Zotero **10.0.6**、官方 Server/主插件 4.1.7 和独立 venv。其他系统和 Python 版本尚未完成同样的安装验收。`requirements-runtime.txt` 是此次干净环境实际解析并验证过的完整版本清单，严格固定 `pdf2zh-next==2.9.0`、`BabelDOC==0.6.2` 等依赖，不包含本机路径、私有下载地址或凭据。

1. 安装 [PSF 官方 Python](https://www.python.org/downloads/windows/) 3.13 64 位和 Zotero。从[官方 4.1.7 发布页](https://github.com/guaguastandup/zotero-pdf2zh/releases/tag/v4.1.7)取得 `server.zip`、`zotero-pdf-2-zh.xpi`；从有权限访问的伴侣发布页取得本版 XPI 与 `requirements-runtime.txt`。
2. 新建一个自己的安装目录，将 `server.zip` 和 `requirements-runtime.txt` 放进去。以下以 `C:\PDF2zh` 为例，在 PowerShell 中创建独立环境，不需要执行激活脚本：

```powershell
Set-Location 'C:\PDF2zh'
Expand-Archive -LiteralPath '.\server.zip' -DestinationPath '.'
py -3.13 -m venv .venv
$runtimePython = Join-Path (Get-Location) '.venv\Scripts\python.exe'
& $runtimePython -m pip install --index-url https://pypi.org/simple -r .\requirements-runtime.txt
& $runtimePython -m pip check
```

3. 在 Zotero 插件管理器安装官方主插件和伴侣 XPI，按 Zotero 提示重新启动。主插件的 Python Server IP 使用 `http://127.0.0.1:8890`，通过主插件的 LLM API 配置填写自己的服务、模型和密钥。选择 OpenAI 兼容服务以使用质量增强；其他翻译选项、线程/限速与术语抽取继续在主插件设置。
4. 第一次点击工具栏 **PDF2zh Server**，依次选择 `C:\PDF2zh\server\server.py` 和 `C:\PDF2zh\.venv\Scripts\python.exe`。伴侣检查兼容依赖，自动部署后台进度、历史页面与全部质量增强，然后启动服务。以后直接点击即可；修改安装位置时右键按钮选择“配置本机服务…”。取消选择不会启动服务或提交文献。
5. 使用主插件原来的条目翻译入口。第一次使用引擎可能需要下载原生模型/字体资源；首次资源准备耗时与翻译耗时应分开判断。原文与现有译文由用户保留，不因安装自动续译、补译或重新生成。

伴侣启动时将选定 Python 同时作为 Server 与翻译环境，不启用 Server 的额外自动建环境功能。不要只选择装有 Flask 的基础 Python；应选择安装过本清单的 venv。已有 uv/Conda 环境可继续使用，但要满足同样版本要求。不同目录的 Server 已占用相同端口时，伴侣会提示，避免打开错误服务；请等待原任务结束后再停旧服务或选择另一空闲本机端口。

仓库保持私有，GitHub 下载和更新清单需要有权限的认证，不能保证 Zotero 的匿名自动更新。通过有权限的账号取得 XPI 后手动安装，不依赖匿名更新。包内不保存用户的路径、模型密钥或 Zotero 数据库。

## 构建与验证

```powershell
node .\tests\smoke.js
node .\tests\environment.js
node .\tests\history.js
python .\tests\windows-native.py
python .\tests\quality_guard.py --offline
python .\tests\figure_guard.py --offline
python .\tests\quality_hook.py
.\build.ps1
.\tests\release.ps1
```

构建输出在 `dist/`：XPI 与包含版本、下载地址和 SHA-256 的 `updates.json`。CI 只运行无用户资料的检查并生成构建产物，不下载完整 Server 或并发修改发布楼。

唯一主源码在 `src/`，后台进度适配器也随 XPI 部署；`server-fix/` 仅保留旧环境维护入口。`tests/local-runtime.cjs` 为维护电脑的实际 Python 路径回归，不提交翻译、不调用模型；其他机器应使用通用测试或配置自己的环境。完整环境还需运行 `quality_guard.py`、`figure_guard.py`、`quality_pdf.py`、`quality_engine.py` 和针对原版 Server 的 `pipe-progress.py`；测试参数见各脚本和 `VERIFICATION.md`。

本轮已从官方源独立安装环境，核验 pdf2zh-next/BabelDOC 共 225 份源码与安装记录摘要相符，未复制本机修改过的 `site-packages`。在全新 Zotero 配置、文献库、Server 和 venv 中，实际用文件选择器配置含中文和空格的路径，完成按钮启动、两页合成 PDF 的条目右键翻译、单语与 LR 双语自动回挂；回挂文件与 Server 输出的 SHA-256 一致，原文不变。翻译后 225 份引擎源码仍为官方原字节。

独立引擎测试发出 27 次本机合成请求；另一轮 Zotero 界面测试发出 17 次请求并命中 10 次缓存，两者分开统计。后台进度已通过原版 TaskManager 实时核对；增强关闭状态在重启后仍保留，再开启后运行设置恢复为开启。回挂 LR 已在 Zotero 原生阅读器打开，两页正常识别，首页十行中英文目录位置正常。历史清空确认框的取消操作通过真实界面验证；没有在真实界面执行历史删除，清空行为由代码回归验证。完整证据与验收边界见 `VERIFICATION.md`。这些验证不调用用户真实模型额度，也未重启暂停的论文批量任务；已有原文与译文保留。

本版保留所选 Python 的真实 `sys.prefix` / `sys.base_prefix` 探测及 Windows Path/PATH 合并。机器检查不能替代论文语义验收，合成测试也不证明所有复杂论文排版正确。
