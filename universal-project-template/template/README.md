# {{项目名称}}

{{一句话说明目标用户与核心价值}}

## 核心能力

{{已实现与规划中的能力分别标注}}

## 技术与运行

技术方案见 [AGENTS.md](AGENTS.md)，需求见 [init.md](init.md)。
启动与测试以 AGENTS 的运行契约为准；尚未验证的命令不得宣称可用。

## 项目文档

- [协作约定](AGENTS.md)
- [任务与进展](TASKS.md)
- [历史索引](MEMORY.md)
- [阶段看板](ROADMAP.md)
- [数据模型](DATABASE.md)
- [验收清单](docs/RELEASE-QA-CHECKLIST.md)

## 协作入口

导入流程会把操作说明安装至 `docs/workflows/`。
导入后可告诉 AI：「请按 docs/workflows/memory-check.md 检查记录遗漏」。
需要再次合并模板时，使用 `docs/workflows/import-project.md` 并提供模板包实际路径。
