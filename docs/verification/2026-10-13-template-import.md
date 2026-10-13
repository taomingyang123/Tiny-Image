# 2026-10-13—14 协作文档接入验收

- 任务：F01；模式：已有项目；范围：仅协作文档。
- 用户确认：已有项目；整理为可复用模板，准备验收与交付；本次仅接入协作文档。
- 日期：2026-10-13 开始，2026-10-14 完成（Asia/Shanghai）。
- 环境：项目根目录，Python 3 标准库；Git HEAD `a4c6489`，保留已有工作区差异。

## 第 1 层：文档静态验收

草稿、落地及完成状态检查均实际执行且退出码为 0。命令：

```bash
python3 .template-import-draft-20261013-01/verify_import.py --target draft
python3 .template-import-draft-20261013-01/verify_import.py --target root
```

最终检查结果：

- 13 delivery documents exist。
- 27 relative links resolve; project fields filled; fences paired。
- task five fields, unique IDs, WIP and counts match: {"done": 1, "todo": 1}。
- log fields, four sections, index and roadmap match tasks。
- 64 original paths preserved, including deletions; README original text retained。


- README 完整原文作为前缀保留，追加协作导航；唯一原文件备份为 `.template-import-backup-20261013-01/README.md`，恢复方式见该目录 `RESTORE.md`。
- `docs/workflows/import-project.md` 已补充从用户指定模板包定位源文件的说明，当前包为 `universal-project-template/`；流程入口不指向临时草稿。
- `docs/MEMORY-ENTRY-TEMPLATE.md` 的占位字段作为可复用日志模板保留，其余项目文档无未替换字段。
- 任务状态：F01 done、F02 todo、doing 0；总数 2，已启动或受阻 1，收尾比例 100%（1/1），不等于模板产品完成率。
- 尚无数据库需求，DATABASE 省略且无死链；无原任务和历史，仅记录本次接入事实。

## 第 2、3 层

- 第 2 层：N/A，F01 仅文档接入，没有应用运行行为变更。
- 第 3 层：N/A，F01 不包含业务端到端交付。
- 业务运行基线：未验证。未执行依赖安装、build、SEO、预览、deploy 或真实 IndexNow 提交；不将工具版本或既有产物作为运行成功证据。

## 证据与交接

- 本次暂存目录 `.template-import-draft-20261013-01/` 保存变更清单、文件清单、导入前 Git 状态、原文件 SHA-256/存在性、检查程序及 draft/installed/final-validation.json。
- 恢复只针对本次 README 合并与新增文档；先检查后续修改，不能恢复 Git HEAD 或触碰原业务文件及模板包。
- 下一任务 F02 为 todo，等待后续指令启动基线核验；最终交付形式和目标站点资料待确认。
- 重复导入只补实质差异，根目录 TASKS 和 MEMORY 作为后续事实源，暂存目录只保留本次快照。
