"""Read-only checks for this import's draft or installed documents."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

parser = argparse.ArgumentParser()
parser.add_argument('--target', choices=['draft', 'root'], required=True)
args = parser.parse_args()
draft = Path(__file__).resolve().parent
root = draft.parent
manifest = json.loads((draft / 'manifest.json').read_text())
snapshot = json.loads((draft / 'source-snapshot.json').read_text())
base = draft if args.target == 'draft' else root
errors = []
checks = []

def require(condition, message):
    if not condition:
        errors.append(message)

docs = {}
for name in manifest['files']:
    p = base / name
    require(p.is_file(), f'missing document: {name}')
    if p.is_file():
        docs[name] = p.read_text()
require(len(docs) == 13, 'expected 13 delivery documents')
checks.append(f'{len(docs)} delivery documents exist')

link_count = 0
for name, content in docs.items():
    if name != 'docs/MEMORY-ENTRY-TEMPLATE.md':
        require(not re.search(r'\{\{[^}]+\}\}', content), f'unresolved project field: {name}')
    require(content.count('```') % 2 == 0, f'unclosed code fence: {name}')
    for target in re.findall(r'\[[^\]\n]+\]\(([^)]+)\)', content):
        target = target.strip().strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or not parsed.path:
            continue
        logical = (root / Path(name).parent / unquote(parsed.path)).resolve()
        require(logical.is_relative_to(root), f'link escapes project: {name}: {target}')
        if not logical.is_relative_to(root):
            continue
        relative = str(logical.relative_to(root))
        actual = base / relative if relative in manifest['files'] else logical
        require(actual.exists(), f'broken link: {name}: {target}')
        link_count += 1
checks.append(f'{link_count} relative links resolve; project fields filled; fences paired')

tasks = docs.get('TASKS.md', '')
blocks = re.findall(r'^#### (F\d+) · ([^\n]+)\n(.*?)(?=^#### |^### |^## |\Z)', tasks, re.M | re.S)
ids = [item[0] for item in blocks]
require(len(ids) == len(set(ids)) and ids == ['F01', 'F02'], 'task IDs must be unique F01/F02')
counts = Counter()
statuses = {}
for task_id, title, block in blocks:
    for field in ['行为', '验证', '状态', '进展', '证据']:
        values = re.findall(r'^- \*\*' + field + r'\*\*：(.+)$', block, re.M)
        require(len(values) == 1 and bool(values[0].strip()), f'{task_id}: missing or repeated {field}')
    match = re.search(r'^- \*\*状态\*\*：(todo|doing|blocked|done)$', block, re.M)
    require(bool(match), f'{task_id}: invalid status')
    if match:
        statuses[task_id] = match[1]
        counts[match[1]] += 1
require(counts['doing'] <= 1, 'WIP exceeds 1')
for status in ['todo', 'doing', 'blocked', 'done']:
    require(f'- {status}：{counts[status]}\n' in tasks, f'{status} count mismatch')
total = sum(counts.values())
denominator = counts['doing'] + counts['blocked'] + counts['done']
require(f'- 总数：{total}\n' in tasks, 'total mismatch')
require(f'- 已启动或受阻数 = doing + blocked + done：{denominator}\n' in tasks, 'denominator mismatch')
expected_ratio = 'N/A（分母为 0）' if not denominator else f"{counts['done'] / denominator:.0%}（{counts['done']} / {denominator}）"
require(f'- 收尾比例 = done / (doing + blocked + done)：{expected_ratio}\n' in tasks, 'ratio mismatch')
require(statuses.get('F02') == 'todo', 'F02 must remain unstarted')
checks.append('task five fields, unique IDs, WIP and counts match: ' + json.dumps(dict(counts), ensure_ascii=False))

logs = [name for name in manifest['files'] if name.startswith('memory/') and name != 'memory/README.md']
for name in logs:
    log = docs.get(name, '')
    require(log.startswith('---\n'), f'{name}: missing front matter')
    for field in ['date', 'type', 'tasks', 'modules']:
        require(bool(re.search(r'^' + field + r': .+', log, re.M)), f'{name}: missing {field}')
    require('tasks: [F01]' in log, f'{name}: task association mismatch')
    for heading in ['背景', '改动', '验证', '后续']:
        require(f'## {heading}\n' in log, f'{name}: missing section {heading}')
    require(name in docs.get('MEMORY.md', ''), f'{name}: orphan log')
roadmap = docs.get('ROADMAP.md', '')
for task_id in ['F01', 'F02']:
    require(task_id in roadmap, f'roadmap missing {task_id}')
require('| F02；后续任务进入时细化 | todo |' in roadmap, 'future stage must remain todo')
if statuses.get('F01') == 'done':
    require('| F01 | done |' in roadmap, 'F01 stage not completed')
    require('通过' in docs.get(logs[0], ''), 'done F01 missing validation log')
checks.append('log fields, four sections, index and roadmap match tasks')

original_readme = root / manifest['backup'] / 'README.md' if args.target == 'root' else root / 'README.md'
require(original_readme.is_file(), 'original README/backup missing')
if original_readme.is_file():
    original = original_readme.read_bytes()
    require(hashlib.sha256(original).hexdigest() == snapshot['README.md']['sha256'], 'original README changed')
    require((base / 'README.md').read_bytes().startswith(original), 'README original text not retained verbatim')
for name, before in snapshot.items():
    if name == 'README.md' and args.target == 'root':
        continue
    p = root / name
    require(p.exists() == before['exists'], f'original existence/deletion changed: {name}')
    if before['sha256'] is not None and p.is_file():
        require(hashlib.sha256(p.read_bytes()).hexdigest() == before['sha256'], f'original content changed: {name}')
current_status = set(subprocess.check_output(['git', 'status', '--short'], cwd=root).decode().splitlines())
for line in (draft / 'source-git-status.txt').read_text().splitlines():
    require(line in current_status, f'original git status changed: {line}')
if args.target == 'draft':
    for name in manifest['created']:
        require(not (root / name).exists(), f'new destination already exists: {name}')
else:
    for name in manifest['files']:
        require((root / name).read_bytes() == (draft / name).read_bytes(), f'installed file differs from reviewed draft: {name}')
checks.append(f"{len(snapshot)} original paths preserved, including deletions; README original text retained")

result = {'target': args.target, 'passed': not errors, 'checks': checks, 'errors': errors}
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if not errors else 1)
