# newbear Phase 1 任务分配文档：参数化种子系统

## 1. 项目定位

| Item | Value |
|---|---|
| 项目名称 | newbear（熊心壮职）|
| 当前阶段 | v0.1 原型 |
| 目标版本/里程碑 | v0.2 — 参数化种子系统，实现可复玩 |
| 目标用户 | 同一用户可反复游玩，每局体验不同 |
| 成功标准 | 同一用户连续玩3局，每局公司初始状态、触发事件、NPC对话主题存在可感知差异 |

## 2. 当前状态总结

| 领域 | 当前状态 | 差距 | 确认人 |
|---|---|---|---|
| 代码仓库 | ✅ GitHub: zi-yuan-qin/newbear | — | 方坤 |
| 数据库 | ✅ SQLite，仅 world_state + users 表 | 缺 user_profiles / session_records 表 | 方坤 |
| 后端核心 | ✅ HTTP server + 14个 world 模块 | 所有配置写死，无法参数化 | A / C |
| 后端人格报告 | ⚠️ 报告生成有，但无跨session聚合分析 | 无用户画像、无趋势数据 | D |
| 前端 | ✅ 原生 JS SPA，地图+角色+会议+茶水间 | 无历史记录页、无复玩入口 | B |
| 测试 | ❌ 仅 test_seed_loader.py | 核心链路无自动化覆盖 | C |
| 文档 | ✅ 产品说明书 + 公司背景参数化设计文档 + Phase1设计文档 | — | 方坤 |

## 3. 范围与非范围

### 本期范围

| 模块 | 目的 | 独立性 | 负责人 |
|---|---|---|---|
| 数据库扩展 | user_profiles + session_records 表，建表 + CRUD 封装 | 独立，前置依赖 | 方坤 |
| 种子参数化引擎 | 每局生成不同的公司/角色/事件初始参数 | 独立模块 | C |
| 内容池系统 | 事件/会议/茶水间/报告从固定剧本 → 多条目池 | 独立模块 | C |
| 配置层重写 | company_profile / incidents / meeting / pantry / report 重写 | 依赖种子引擎和内容池接口 | A / C |
| 跨session用户画像存储 | 存储每局人格数据，影响下局种子 | 依赖 DB 扩展 | 方坤 |
| 人格画像分析引擎 | 多session人格聚合、趋势计算、报告增强 | 独立模块 | D |
| 新API路由 | sessions 历史、replay、profile、trend | 依赖种子引擎 + 画像引擎 | 方坤 |
| 前端历史页 + 复玩流程 | session 历史展示、再来一局、进度感知 | 依赖新API | B |

### 不在本期范围（P2 / Phase 2）

| 项目 | 原因 |
|---|---|
| 角色扩展（产品经理→运营专员→...） | Phase 2 |
| NPC化机制（前轮用户角色变智能体） | Phase 2 |
| 公司团队规模动态增长 | Phase 2 |
| 移动端适配 | 等核心链路稳定 |
| Qdrant 向量记忆 | 过度设计，SQLite 够用 |
| SSE 推送 | 当前 hashchange+fetch 够用 |

## 4. 旧代码处置

| 处置 | 文件/目录 | 原因 |
|---|---|---|
| 保留 | `backend/server.py` | 仅增量添加6个路由，不重写 |
| 保留 | `backend/src/core/world/step_engine.py` | 时间步核心不变 |
| 保留 | `backend/src/core/world/actor_reactions.py` | LLM调用逻辑不变 |
| 保留 | `backend/src/core/world/meeting_engine.py` | 会议状态机不变 |
| 保留 | `backend/src/core/world/pantry_engine.py` | 茶水间状态机不变 |
| 保留 | `backend/src/core/world/report_engine.py` | 报告触发不变 |
| 保留 | `backend/src/core/world/incident_engine.py` | 事件触发时间点不变 |
| 保留 | `backend/src/core/world/dialogue_engine.py` | 对话生成不变 |
| 保留 | `backend/src/core/world/encounter_engine.py` | 相遇检测不变 |
| 保留 | `backend/src/core/world/memory_engine.py` | 记忆系统不变 |
| 保留 | `backend/src/core/world/memory_retriever.py` | 记忆检索不变 |
| 保留 | `backend/src/core/world/reflection_engine.py` | 反思调度不变 |
| 保留 | `backend/src/core/world/prompt_context.py` | prompt上下文不变 |
| 保留 | `backend/src/core/world/meeting_discussion_engine.py` | 会议讨论不变 |
| 保留 | `backend/src/core/world/pantry_discussion_engine.py` | 茶水间讨论不变 |
| 保留 | `backend/src/core/world/runtime_state.py` | 数据类不变 |
| 保留 | `backend/src/core/llm/ark_client.py` | LLM客户端不变 |
| 保留 | `backend/src/core/map/*` | 地图加载不变 |
| 保留 | `backend/src/core/auth/*` | 认证不变 |
| 保留 | `backend/src/core/config/character_profiles.py` | 基础角色设定保留，仅 world_factory 应用 modifier |
| 保留 | `backend/src/core/config/job_profiles.py` | 岗位设定保留 |
| 保留 | `frontend/web/assets/*` | 美术资产不变 |
| 重写 | `backend/src/core/config/company_profile.py` | 固定值 → 参数化模板函数（A）|
| 重写 | `backend/src/core/config/incidents.py` | 固定列表 → 调用 content_pool（C）|
| 重写 | `backend/src/core/config/meeting_events.py` | 固定列表 → 调用 content_pool（C）|
| 重写 | `backend/src/core/config/pantry_events.py` | 固定列表 → 调用 content_pool（C）|
| 重写 | `backend/src/core/config/report_events.py` | 固定列表 → 调用 content_pool（C）|
| 重写 | `backend/src/core/world/seed_loader.py` | 读固定文件 → 调用 seed_generator（A）|
| 重写 | `backend/src/core/world/world_factory.py` | 固定参数 → 接受参数化种子（A）|
| 重写 | `backend/src/core/db/database.py` | 新增建表（方坤）|
| 重写 | `frontend/web/main.js` | 新增历史/复玩逻辑（B）|
| 重写 | `frontend/web/index.html` | 新增 UI 元素（B）|
| 重写 | `frontend/web/styles.css` | 新增样式（B）|
| 新增 | `backend/src/core/config/seed_generator.py` | 种子生成引擎（C）|
| 新增 | `backend/src/core/config/content_pool.py` | 内容池管理器（C）|
| 新增 | `backend/src/core/config/content_pool/__init__.py` | —（C）|
| 新增 | `backend/src/core/config/content_pool/incidents/*.json` | 事件内容池数据（C）|
| 新增 | `backend/src/core/config/content_pool/meetings/*.json` | 会议内容池数据（C）|
| 新增 | `backend/src/core/config/content_pool/pantry/*.json` | 茶水间内容池数据（C）|
| 新增 | `backend/src/core/config/content_pool/reports/*.json` | 报告内容池数据（C）|
| 新增 | `backend/src/core/db/user_profile.py` | 用户画像 DB 操作（方坤）|
| 新增 | `backend/src/core/db/session_store.py` | 会话记录 DB 操作（方坤）|
| 新增 | `backend/src/core/world/personality_analyzer.py` | 人格分析引擎（D）|
| 新增 | `backend/test_seed_generator.py` | 种子生成器测试（C）|
| 新增 | `backend/test_content_pool.py` | 内容池测试（C）|
| 新增 | `backend/test_personality_analyzer.py` | 人格分析测试（D）|

## 5. 数据库变更

| 表 | 操作 | 备注 |
|---|---|---|
| `user_profiles` | 新建 | 跨session用户人格画像 |
| `session_records` | 新建 | 单局session元数据 |
| `world_state` | 修改 | 新增 `seed_id` 字段 |
| `users` | 保留 | 不变 |
| `user_messages` | 保留 | 不变 |
| `reports` | 保留 | 不变 |

### 建表 SQL（方坤负责）

```sql
-- user_profiles: 跨session用户人格画像
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    personality_data TEXT NOT NULL DEFAULT '{}',
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_playtime_seconds INTEGER NOT NULL DEFAULT 0,
    preferred_decision_style TEXT,
    preferred_conflict_style TEXT,
    avg_input_length REAL,
    relationship_scores TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- session_records: 单局session记录
CREATE TABLE IF NOT EXISTS session_records (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    seed_id TEXT NOT NULL,
    seed_summary TEXT NOT NULL DEFAULT '{}',
    day_completed INTEGER NOT NULL DEFAULT 0,
    final_clock TEXT,
    report_id TEXT,
    report_scores TEXT NOT NULL DEFAULT '{}',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- world_state 新增字段
ALTER TABLE world_state ADD COLUMN seed_id TEXT;
```

## 6. 团队分工总览

| 成员 | 角色 | 技术栈 | 主要职责 | 最终产出 |
|---|---|---|---|---|
| 方坤（队长）| 后端 + 架构 | Python | DB扩展、接口契约定义、API路由集成、全链路联调验收 | 数据库就绪、API全链路打通、3局差异验证通过 |
| A | 后端 | Python | company_profile 参数化模板、seed_loader + world_factory 重写 | 参数化配置层 + 世界工厂适配 |
| B | 前端 | HTML/CSS/JS | 历史页、复玩流程、UI适配 | 用户可见的历史记录页和复玩入口 |
| C | 后端 | Python | 种子生成器、内容池及数据、config层重写(incidents/meetings/pantry/report)、测试 | 种子引擎+内容池+单元测试 |
| D | 后端-人格报告 | Python | 人格分析引擎、profile/trend API数据层、报告增强 | 人格画像分析模块+跨session趋势 |

## 7. 依赖地图

```
Week 1 ────────────────────────────────────────────────────────────
│
├─ P0-001 [方坤] 数据库建表 + CRUD 封装
│     │
│     ├──▶ P0-002 [方坤] Shared层接口定义（seed dataclass, content_pool 协议）
│     │         │
│     │         ├──▶ BE-001 [C] 种子生成器
│     │         ├──▶ BE-002 [C] 内容池管理器
│     │         ├──▶ BE-003 [C] 内容池数据编写
│     │         └──▶ BE-005 [A] company_profile 参数化模板
│     │
│     └──▶ BE-007 [D] 人格分析引擎（需 user_profile CRUD 就绪）
│
Week 2 ────────────────────────────────────────────────────────────
│
├─ BE-001 [C] + BE-002 [C] + BE-003 [C] 完成
│     │
│     └──▶ BE-004 [C] config 层重写（incidents/meetings/pantry/report）
│
├─ BE-005 [A] 完成 → BE-006 [A] seed_loader + world_factory 重写
│
├─ BE-007 [D] 完成 → BE-008 [D] profile/trend API 数据层
│
├─ 后端模块齐备 → BE-009 [方坤] server.py 新增6个API路由
│
Week 3 ────────────────────────────────────────────────────────────
│
├─ BE-009 [方坤] API就绪 → FE-001 [B] 前端历史页
├─ BE-009 [方坤] API就绪 → FE-002 [B] 前端复玩流程
├─ FE-001 + FE-002 → FE-003 [B] 报告页底部复玩入口
│
└─ 全部模块就绪 → INT-001 [方坤] 全链路联调
                         │
                         └──▶ QA-001 [方坤] 3局差异验收
```

## 8. 时间估算

| 阶段 | 周次 | 负责人 | 任务 |
|---|---|---|---|
| Phase 1a: 队长前置 | Week 1 前半 | 方坤 | P0-001, P0-002 |
| Phase 1b: 后端并行 | Week 1 后半 ~ Week 2 | 方坤, A, C, D | BE-001 ~ BE-009 |
| Phase 1c: 前端 | Week 2 后半 ~ Week 3 前半 | B | FE-001, FE-002, FE-003 |
| Phase 1d: 联调验收 | Week 3 后半 | 方坤 | INT-001, QA-001 |

## 9. 队长前置任务（方坤）

### P0-001: 数据库扩展

- **目标**: 新建 user_profiles 和 session_records 表，提供 CRUD 封装
- **负责人**: 方坤
- **状态**: 🔴 Not Started
- **前置依赖**: 无
- **时间**: Week 1 前半
- **影响模块**: database
- **允许编辑路径**:
  ```
  backend/src/core/db/database.py
  backend/src/core/db/user_profile.py
  backend/src/core/db/session_store.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/db/__init__.py
  backend/src/core/auth/auth_service.py  (user_id 格式参考)
  ```
- **新增文件**:
  ```
  backend/src/core/db/user_profile.py
  backend/src/core/db/session_store.py
  ```
- **修改文件**:
  ```
  backend/src/core/db/database.py
  ```
- **删除文件**: 无
- **API/数据契约**:

  `user_profile.py` 对外暴露：
  ```python
  def init_user_profile(user_id: str) -> dict
  def get_user_profile(user_id: str) -> dict | None
  def update_user_profile(user_id: str, personality_data: dict) -> dict
  def increment_session_count(user_id: str) -> int
  ```

  `session_store.py` 对外暴露：
  ```python
  def create_session_record(user_id: str, seed_id: str, seed_summary: dict) -> str
  def get_session_record(session_id: str) -> dict | None
  def list_user_sessions(user_id: str, limit: int = 20) -> list[dict]
  def complete_session(session_id: str, report_id: str, scores: dict) -> None
  def abandon_session(session_id: str) -> None
  ```

- **验收标准**:
  - [ ] `init_db()` 执行后两张新表自动创建
  - [ ] user_profile CRUD 四个函数均可调用，返回预期结构
  - [ ] session_store 六个函数均可调用，返回预期结构
  - [ ] 现有 world_state / users 表不受影响
- **必需测试**:
  - [ ] 测试场景1：新建用户 → init_user_profile → get_user_profile 返回非空
  - [ ] 测试场景2：update_user_profile 写入人格数据 → 再次读取验证字段一致
  - [ ] 测试场景3：create_session_record → complete_session → status 变为 completed
  - [ ] 测试场景4：list_user_sessions 按时间倒序返回，limit 生效
  - [ ] 测试场景5：同一 user 创建 3 个 session → increment_session_count → total_sessions=3
- **前后端集成检查**: 纯后端，无前端依赖
- **队长验收**: 自验
- **交付物**: `user_profile.py`, `session_store.py`, 修改后的 `database.py`
- **移交备注**: A、C、D 可以通过 import 直接使用这些函数

---

### P0-002: Shared层接口定义

- **目标**: 定义种子数据结构、内容池协议、参数化模板接口，作为方坤/A/C/D 四方并行开发的契约
- **负责人**: 方坤
- **状态**: 🔴 Not Started
- **前置依赖**: 无（可与 P0-001 并行）
- **时间**: Week 1 前半
- **影响模块**: config, world
- **允许编辑路径**:
  ```
  backend/src/core/world/seed_loader.py     (仅定义 SessionSeed dataclass + 接口签名)
  ```
- **只读参考路径**:
  ```
  backend/src/core/world/runtime_state.py    (现有数据类定义)
  backend/src/core/config/company_profile.py (现有结构参考)
  docs/phase1-design.md                      (种子参数结构设计)
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/src/core/world/seed_loader.py       (追加 SessionSeed dataclass + load_world_seed 接口签名)
  ```
- **删除文件**: 无
- **API/数据契约**:

  在 `seed_loader.py` 中定义 `SessionSeed` dataclass（A、C、D 依赖此结构）:
  ```python
  @dataclass
  class SessionSeed:
      seed_id: str
      company_params: dict    # { cash, day_start, runway_days, ... }
      character_modifiers: dict[str, dict]  # actor_id → { stress_base, ... }
      incident_pool_ids: list[str]
      meeting_topic_ids: list[str]
      pantry_topic_ids: list[str]
      report_template_ids: list[str]
  ```

  定义接口签名（具体实现在后续任务）：
  ```python
  def load_world_seed(user_id: str | None = None) -> dict
  # 调用 seed_generator.generate(user_id) → 返回 seed 的 dict 形式

  def build_company_profile(params: dict) -> dict
  # 输入：seed.company_params，输出：参数化后的公司描述 dict

  def create_initial_world_state(seed: SessionSeed | None = None) -> WorldRuntimeState
  # 接受 SessionSeed，返回 WorldRuntimeState
  ```

- **验收标准**:
  - [ ] `SessionSeed` dataclass 定义完成，A/C/D 可 import
  - [ ] 接口签名清晰，每个函数的输入输出类型明确
  - [ ] 现有 `python backend/server.py` 仍可启动（接口签名不破坏现有调用）
- **必需测试**:
  - [ ] 测试场景1：`from src.core.world.seed_loader import SessionSeed` 可正常 import
  - [ ] 测试场景2：`SessionSeed(...)` 可正常实例化，字段默认值合理
- **前后端集成检查**: 纯后端，无前端依赖
- **队长验收**: 自验
- **交付物**: 修改后的 `seed_loader.py`（仅 dataclass + 接口签名部分）
- **移交备注**: 此任务产出是 A、C、D 的接口契约——
  - C 的 seed_generator 返回 SessionSeed
  - A 的 company_profile / world_factory 消费 SessionSeed
  - D 的 personality_analyzer 消费 user_profile

---

## 10. 并行成员任务

---

### A（队员-后端）—— 参数化配置层 + 世界工厂

#### BE-005: company_profile 参数化模板

- **目标**: 将固定 COMPANY_PROFILE dict 改为参数化函数
- **负责人**: A
- **状态**: 🔴 Not Started
- **前置依赖**: P0-002（SessionSeed dataclass + build_company_profile 接口签名就绪）
- **时间**: Week 1 后半
- **影响模块**: config
- **允许编辑路径**:
  ```
  backend/src/core/config/company_profile.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/world/seed_loader.py       (SessionSeed dataclass, build_company_profile 接口)
  docs/phase1-design.md                       (种子参数结构设计)
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/src/core/config/company_profile.py
  ```
- **API/数据契约**:

  `company_profile.py` 对外暴露：
  ```python
  def build_company_profile(params: dict) -> dict
  # 输入：seed.company_params
  # 输出：与现有 COMPANY_PROFILE 相同结构的 dict，但值是参数化后的
  ```

- **参数化模板规则**:
  - `cash` → 描述文案中"账上现金仅能支撑约 X 天运营"，X 由 `runway_days` 参数决定
  - `strategy_consensus` > 60 → "团队方向基本一致"；< 40 → "团队在战略方向上存在明显分歧"
  - `team_morale` > 70 → "团队士气不错"；< 40 → "团队士气有些低落"
  - `resource_scarcity` > 70 → "资源极度紧张，每个人都在超负荷运转"
  - 各字段有对应的文案模板，参数值决定选用哪个文案变体

- **验收标准**:
  - [ ] `build_company_profile(params)` 根据 cash/runway_days/strategy_consensus 等参数动态生成公司描述
  - [ ] 公司描述文案中关键数字和状态词随参数变化
  - [ ] 保留 fallback：无参数时返回与当前版本一致的默认描述
- **必需测试**:
  - [ ] 测试场景1：高现金(8000) vs 低现金(2000) → 描述文案中现金流措辞不同
  - [ ] 测试场景2：strategy_consensus=80 vs 20 → 团队状态描述明显不同
  - [ ] 测试场景3：无参数调用 → 返回与当前版本一致的默认描述
  - [ ] 测试场景4：所有参数取极端值 → 不报错，文案完整
- **前后端集成检查**: 纯后端，方坤在 BE-006 中与本模块对接
- **队长验收**: 需要方坤验收
- **交付物**: 重写后的 `company_profile.py`
- **移交备注**: 完成后通知方坤，方坤会在 BE-006（world_factory）中与本模块联调

---

#### BE-006: seed_loader + world_factory 重写

- **目标**: 实现 load_world_seed 和 create_initial_world_state 的完整逻辑，对接种子生成器和参数化公司模板
- **负责人**: A
- **状态**: 🔴 Not Started
- **前置依赖**: BE-005（company_profile 模板就绪）, BE-001（C的种子生成器就绪）
- **时间**: Week 2 前半
- **影响模块**: world
- **允许编辑路径**:
  ```
  backend/src/core/world/seed_loader.py
  backend/src/core/world/world_factory.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/config/seed_generator.py     (generate 函数)
  backend/src/core/config/company_profile.py    (build_company_profile 函数)
  backend/src/core/config/character_profiles.py (角色基本设定)
  backend/src/core/world/runtime_state.py       (WorldRuntimeState 等数据类)
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/src/core/world/seed_loader.py
  backend/src/core/world/world_factory.py
  ```
- **API/数据契约**:

  `seed_loader.py` 实现：
  ```python
  def load_world_seed(user_id: str | None = None) -> dict
  # 调用 seed_generator.generate(user_id) → 返回 seed 的 dict 形式
  # 如果 seed_generator 不可用（向后兼容），返回默认种子 dict
  ```

  `world_factory.py` 实现：
  ```python
  def create_initial_world_state(seed: SessionSeed | None = None) -> WorldRuntimeState
  # seed 为 None 时使用默认种子（向后兼容）
  # seed 非 None 时：company_params → build_company_profile → CompanyRuntimeState
  #                character_modifiers → ActorRuntimeState 的初始值调整
  ```

- **验收标准**:
  - [ ] `load_world_seed(user_id)` 返回完整的 seed dict（调用 seed_generator）
  - [ ] `create_initial_world_state(seed)` 角色初始属性反映 character_modifiers
  - [ ] 公司初始状态（cash/day/clock/name）反映 company_params
  - [ ] 向后兼容：不传 seed 时使用默认种子，行为与当前版本一致
  - [ ] 现有 `python backend/server.py` 可启动运行
- **必需测试**:
  - [ ] 测试场景1：传入 seed → WorldRuntimeState 各字段反映 seed 参数
  - [ ] 测试场景2：两次 load_world_seed → 产生不同 seed（验证随机性）
  - [ ] 测试场景3：传入相同 seed_id → 产生相同 WorldRuntimeState（确定性）
  - [ ] 测试场景4：seed=None → 行为与当前 main 分支版本一致
- **前后端集成检查**: 纯后端，方坤在 BE-009 server.py 中通过 load_world_seed 调用
- **队长验收**: 需要方坤验收
- **交付物**: 重写后的 `seed_loader.py`, `world_factory.py`
- **移交备注**: 这是后端参数化链路的关键集成点，完成后立即通知方坤联调

---

### B（前端）—— 历史页 + 复玩流程

#### FE-001: Session 历史页

- **目标**: 新增 `#/history` 路由，展示用户历次游玩记录
- **负责人**: B
- **状态**: 🔴 Not Started
- **前置依赖**: BE-009（方坤的 API 就绪）
- **时间**: Week 2 后半 ~ Week 3 前半
- **影响模块**: 前端
- **允许编辑路径**:
  ```
  frontend/web/main.js
  frontend/web/index.html
  frontend/web/styles.css
  ```
- **只读参考路径**:
  ```
  frontend/web/assets/*  (美术资产，只读引用)
  ```
- **新增文件**: 无（所有前端代码在现有3个文件中）
- **修改文件**:
  ```
  frontend/web/main.js
  frontend/web/index.html
  frontend/web/styles.css
  ```
- **API/数据契约**:
  - `GET /api/sessions` 返回：
    ```json
    {
      "sessions": [
        {
          "session_id": "...",
          "seed_id": "...",
          "seed_summary": { "cash_pressure": "紧张", "team_morale": "一般" },
          "day_completed": 1,
          "final_clock": "18:00",
          "report_scores": { "openness": 72 },
          "started_at": "2026-05-21T09:00:00",
          "status": "completed"
        }
      ]
    }
    ```

- **UI 设计要点**:
  - 页面路由 `#/history`，顶部导航可切换回游戏
  - 每局显示为一张卡片：日期、时长、人格标签、关键事件数
  - 简单的 SVG 折线图展示人格维度变化趋势（横轴=session序号，纵轴=分数）
  - 最新的 session 在最上面
  - 空状态：当无历史时显示引导文案"还没有职场记录，开始你的第一天吧"

- **验收标准**:
  - [ ] 从 `#/` 可导航到 `#/history`
  - [ ] 历史列表按时间倒序展示
  - [ ] 人格趋势折线图正确绘制（至少展示 openness / extraversion 两条线）
  - [ ] 无历史数据时显示空状态引导
  - [ ] 卡片点击可展开详情（触发的事件、最终报告摘要）
- **必需测试**:
  - [ ] 测试场景1：0条历史 → 空状态引导文案
  - [ ] 测试场景2：1条历史 → 1张卡片，趋势图提示"至少2局才能看到趋势"
  - [ ] 测试场景3：3条历史 → 3张卡片，趋势图3个数据点连线
  - [ ] 测试场景4：10+条历史 → 分页或滚动加载（至少展示最近10条）
- **前后端集成检查**: 依赖 BE-009 的 GET /api/sessions 和 GET /api/profile/trend
- **队长验收**: 需要方坤验收（检查 UI 与设计稿一致、数据渲染正确）
- **交付物**: 修改后的 `main.js`, `index.html`, `styles.css`
- **移交备注**: 完成后截图给方坤确认

---

#### FE-002: 复玩流程

- **目标**: 实现"再来一局"完整流程，从触发到进入新游戏
- **负责人**: B
- **状态**: 🔴 Not Started
- **前置依赖**: FE-001（历史页就绪）, BE-009（POST /api/sessions/replay 就绪）
- **时间**: Week 3 前半
- **影响模块**: 前端
- **允许编辑路径**:
  ```
  frontend/web/main.js
  frontend/web/index.html
  frontend/web/styles.css
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  frontend/web/main.js
  frontend/web/index.html
  frontend/web/styles.css
  ```
- **API/数据契约**:
  - `POST /api/sessions/replay` 请求体 `{}`（空），返回：
    ```json
    {
      "ok": true,
      "state": { },
      "seed_summary": { "hint": "今天公司现金流格外紧张，团队士气也有些低落..." }
    }
    ```

- **UI 设计要点**:
  - 触发入口有三处（复用同一逻辑）：
    1. 报告页底部 [再来一局] 按钮
    2. 历史页顶部 [开始新的一局] 按钮
    3. 登录后主页（有历史时）展示"继续上次 / 开始新局"选择
  - 点击后展示简单的种子预览提示（1-2句话描述本局特点）
  - 确认后 POST /api/sessions/replay → 进入新游戏（复用现有 renderState）

- **验收标准**:
  - [ ] 三个入口均可正常触发复玩
  - [ ] 种子预览提示文案与后端 seed_summary 一致
  - [ ] 确认后成功进入新游戏，公司初始状态与上局不同
  - [ ] 中途可以取消回到历史页
- **必需测试**:
  - [ ] 测试场景1：完整走完一局→报告页点[再来一局]→新游戏启动，cash/clock/day 正确
  - [ ] 测试场景2：在历史页点[开始新的一局]→同上
  - [ ] 测试场景3：连续复玩3次 → 3次种子预览文案各不相同
- **前后端集成检查**: 依赖 BE-009 的 POST /api/sessions/replay
- **队长验收**: 需要方坤验收
- **交付物**: 修改后的 `main.js`, `index.html`, `styles.css`
- **移交备注**: 与 FE-001 同批交付

---

#### FE-003: 报告页底部复玩入口

- **目标**: 在报告页底部增加内容进度提示和复玩引导
- **负责人**: B
- **状态**: 🔴 Not Started
- **前置依赖**: FE-002（复玩逻辑就绪）
- **时间**: Week 3 前半（可与 FE-002 并行）
- **影响模块**: 前端
- **允许编辑路径**:
  ```
  frontend/web/main.js
  frontend/web/styles.css
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  frontend/web/main.js
  frontend/web/styles.css
  ```
- **UI 设计要点**:
  - 在报告关闭按钮下方增加：
    - "你今天经历了 X/Y 个事件"（根据 session_record 的 seed_summary）
    - "再来一局 —— 不同的开局条件，不同的故事走向"
    - [再来一局] 按钮

- **验收标准**:
  - [ ] 报告底部正确展示事件进度
  - [ ] [再来一局] 按钮可点击，行为与 FE-002 一致
- **必需测试**:
  - [ ] 测试场景1：报告页展示事件计数与实际触发事件数一致
- **前后端集成检查**: 依赖 FE-002 的复玩函数
- **队长验收**: 需要方坤验收
- **交付物**: 修改后的 `main.js`, `styles.css`

---

### C（后端）—— 种子引擎 + 内容池

#### BE-001: 种子生成器

- **目标**: 实现 SessionSeed 生成逻辑——随机采样参数、内容池选择、用户画像加权
- **负责人**: C
- **状态**: 🔴 Not Started
- **前置依赖**: P0-002（SessionSeed dataclass 定义就绪）
- **时间**: Week 1 后半 ~ Week 2 前半
- **影响模块**: config
- **允许编辑路径**:
  ```
  backend/src/core/config/seed_generator.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/db/user_profile.py         (get_user_profile 接口，方坤的 P0-001)
  backend/src/core/world/seed_loader.py       (SessionSeed dataclass，方坤的 P0-002)
  docs/phase1-design.md                       (种子参数结构设计)
  ```
- **新增文件**:
  ```
  backend/src/core/config/seed_generator.py
  ```
- **修改文件**: 无
- **删除文件**: 无
- **API/数据契约**:

  `seed_generator.py` 对外暴露：
  ```python
  def generate(user_id: str | None = None) -> SessionSeed
  # 1. 查询 user_profile（如果有）
  # 2. 根据用户画像调整参数权重
  # 3. 随机采样 company_params
  # 4. 随机采样 character_modifiers
  # 5. 条件筛选 content_pool ids
  # 6. 组装并返回 SessionSeed

  def preview(user_id: str | None = None) -> dict
  # 返回种子的人类可读摘要，供前端展示
  ```

- **参数采样规则**:
  - `cash` 范围 [2000, 8000]，默认 5000，步长 500
  - `runway_days` 范围 [5, 15]，默认 10
  - `strategy_consensus` 范围 [20, 80]，默认 50
  - `team_morale` 范围 [30, 90]，默认 60
  - 每个 character 的 stress_base 偏移 ±10，energy_base 偏移 ±10

- **用户画像加权规则**（初版）:
  - 用户 `openness > 70` → 高变体事件权重 +30%
  - 用户 `conflict_style = "avoid"` → 团队冲突事件概率 -50%
  - 用户 `closest_ally` → 该角色初始好感度 +10

- **验收标准**:
  - [ ] `generate()` 返回完整的 SessionSeed，所有字段非空
  - [ ] 连续调用 10 次 `generate()`，至少产生 8 种不同的 seed
  - [ ] 传入相同 user_id 时，user_profile 影响种子参数（可通过权重验证）
  - [ ] `preview()` 返回人类可读的中文摘要
  - [ ] seed_id 格式为 `"seed-{YYYYMMDD}-{4位随机hex}"`
- **必需测试**:
  - [ ] 测试场景1：无 user_id 调用 generate → 返回默认随机种子
  - [ ] 测试场景2：连续 10 次 generate → cash/runway_days/strategy_consensus 存在方差
  - [ ] 测试场景3：用户画像 openness=90 → 事件池选择偏向高开放性标签
  - [ ] 测试场景4：相同 user_id + 相同 seed_id 前缀 → 确定性生成
  - [ ] 测试场景5：preview() 返回的中文摘要与 seed 字段一致
- **前后端集成检查**: 纯后端，A 在 BE-006 中消费 SessionSeed
- **队长验收**: 需要方坤验收
- **交付物**: `seed_generator.py` + `test_seed_generator.py`
- **移交备注**: 完成后通知 A，A 的 BE-006（seed_loader）依赖此模块

---

#### BE-002: 内容池管理器

- **目标**: 实现内容池加载、条件筛选、条目选取
- **负责人**: C
- **状态**: 🔴 Not Started
- **前置依赖**: P0-002（内容池协议定义）
- **时间**: Week 1 后半 ~ Week 2 前半（与 BE-001 并行）
- **影响模块**: config
- **允许编辑路径**:
  ```
  backend/src/core/config/content_pool.py
  ```
- **只读参考路径**:
  ```
  docs/phase1-design.md  (内容池结构设计)
  ```
- **新增文件**:
  ```
  backend/src/core/config/content_pool.py
  ```
- **修改文件**: 无
- **删除文件**: 无
- **API/数据契约**:

  `content_pool.py` 对外暴露：
  ```python
  def load_pool(category: str) -> list[dict]
  # category: "incidents" | "meetings" | "pantry" | "reports"
  # 从 content_pool/{category}/*.json 加载全部条目

  def select_items(
      category: str,
      pool_ids: list[str],
      count: int,
      seed_id: str,
  ) -> list[dict]
  # 从指定 pool_ids 中确定性选取 count 条（使用 seed_id 作为随机种子）

  def filter_by_conditions(
      items: list[dict],
      conditions: dict,
  ) -> list[dict]
  # 根据 param_conditions 过滤（如 {"cash_pressure": {"min": 70}}）
  ```

- **验收标准**:
  - [ ] 4 个 category 的 JSON 文件均可正确加载
  - [ ] `select_items` 相同 seed_id 返回相同结果（确定性）
  - [ ] `filter_by_conditions` 正确过滤不符合条件的条目
  - [ ] 内容池为空时返回空列表不报错
- **必需测试**:
  - [ ] 测试场景1：加载 incidents 池 → 返回至少 5 条事件条目
  - [ ] 测试场景2：select_items 用相同 seed_id 调2次 → 结果一致
  - [ ] 测试场景3：select_items 用不同 seed_id 调2次 → 结果不同（大概率）
  - [ ] 测试场景4：filter_by_conditions cash_pressure>=70 → 只返回高压力事件
  - [ ] 测试场景5：select_items 需3条但池子只有2条 → 返回2条不报错
- **前后端集成检查**: 纯后端，C 自己在 BE-004 中消费
- **队长验收**: 需要方坤验收
- **交付物**: `content_pool.py` + `test_content_pool.py`
- **移交备注**: 与 BE-003 内容数据结合使用

---

#### BE-003: 内容池数据编写

- **目标**: 为 4 个类别编写足够的内容条目（每类至少 6 条变体），确保多局体验差异
- **负责人**: C
- **状态**: 🔴 Not Started
- **前置依赖**: 无（可与 BE-001/BE-002 并行）
- **时间**: Week 1 后半 ~ Week 2 前半
- **影响模块**: config 数据
- **允许编辑路径**:
  ```
  backend/src/core/config/content_pool/
  ```
- **新增文件**:
  ```
  backend/src/core/config/content_pool/__init__.py
  backend/src/core/config/content_pool/incidents/market_pressure.json
  backend/src/core/config/content_pool/incidents/funding_crisis.json
  backend/src/core/config/content_pool/incidents/team_friction.json
  backend/src/core/config/content_pool/incidents/user_growth.json
  backend/src/core/config/content_pool/incidents/competitor_move.json
  backend/src/core/config/content_pool/meetings/morning_standup.json
  backend/src/core/config/content_pool/meetings/afternoon_review.json
  backend/src/core/config/content_pool/pantry/afterwork_chat.json
  backend/src/core/config/content_pool/reports/daily_letter.json
  ```
- **修改文件**: 无
- **删除文件**: 无

- **内容条目 JSON 格式规范**:
  ```json
  {
    "pool_id": "incident_market_001",
    "category": "incident",
    "items": [
      {
        "item_id": "incident_market_001_v1",
        "time": "10:00",
        "title": "竞品发布新版本",
        "content": "竞品「职探」刚刚发布了v2.0版本，新增了AI实时对话功能...",
        "tags": ["high_pressure", "competitive"],
        "param_conditions": {
          "market_threat_level": { "min": 50 }
        },
        "user_personality_weight": {
          "openness": 0.3,
          "conscientiousness": 0.2,
          "extraversion": -0.1,
          "agreeableness": 0.1,
          "neuroticism": 0.2
        }
      }
    ]
  }
  ```

- **验收标准**:
  - [ ] incidents 至少 8 个变体条目，覆盖高/低压力的场景
  - [ ] meetings 至少 6 个变体条目（晨会+部门例会各3）
  - [ ] pantry 至少 6 个变体条目
  - [ ] reports 至少 4 个变体模板
  - [ ] 每个条目填写 tags 和 param_conditions
  - [ ] JSON 格式合法，content_pool.py 能正确加载
- **必需测试**:
  - [ ] 测试场景1：全部 JSON 文件通过 `python -m json.tool` 格式校验
  - [ ] 测试场景2：content_pool.load_pool 加载所有 category 不报错
  - [ ] 测试场景3：高压力种子(所有压力参数>70)能匹配到至少3条事件
  - [ ] 测试场景4：低压力种子(所有压力参数<30)的事件选择与高压力有明显差异
- **前后端集成检查**: 纯数据，无前端依赖
- **队长验收**: 需要方坤验收（check 内容质量和触发逻辑合理性）
- **交付物**: 全部内容池 JSON 文件 + `__init__.py`
- **移交备注**: 与 BE-002 一起交付，C 自己可以在 BE-004 中使用

---

#### BE-004: config 层重写（incidents / meetings / pantry / report）

- **目标**: 将 4 个配置模块从固定列表改为调用 content_pool
- **负责人**: C
- **状态**: 🔴 Not Started
- **前置依赖**: BE-002, BE-003（内容池就绪）
- **时间**: Week 2 前半
- **影响模块**: config
- **允许编辑路径**:
  ```
  backend/src/core/config/incidents.py
  backend/src/core/config/meeting_events.py
  backend/src/core/config/pantry_events.py
  backend/src/core/config/report_events.py
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/src/core/config/incidents.py
  backend/src/core/config/meeting_events.py
  backend/src/core/config/pantry_events.py
  backend/src/core/config/report_events.py
  ```
- **删除文件**: 无

- **重写方式**:
  每个模块当前是固定 dict/list，改为：
  ```python
  # incidents.py (新)
  from src.core.config.content_pool import load_pool, filter_by_conditions, select_items

  def get_incidents_for_seed(seed: SessionSeed) -> list[dict]:
      pool = load_pool("incidents")
      items = [item for pool_id in seed.incident_pool_ids
               for item in pool if item.get("pool_id") == pool_id]
      return items

  def get_incidents_for_clock(seed: SessionSeed, clock: str) -> list[dict]:
      items = get_incidents_for_seed(seed)
      return [item for item in items if item.get("time") == clock]
  ```

- **验收标准**:
  - [ ] 4 个模块的函数签名与旧版兼容（现有 incident_engine / meeting_engine 调用不报错）
  - [ ] 不同种子传入 → 返回不同的事件/会议/茶水间/报告列表
  - [ ] 现有 `trigger_*_for_clock` 函数行为不变（只是数据来源变了）
- **必需测试**:
  - [ ] 测试场景1：种子A和种子B的 incidents 列表至少有1条不同
  - [ ] 测试场景2：种子A和种子B的 meeting_topics 至少有1条不同
  - [ ] 测试场景3：get_*_for_clock 正确过滤时间匹配的条目
  - [ ] 测试场景4：传入空池子 → 返回空列表不报错
- **前后端集成检查**: 纯后端，方坤在 BE-009 中集成
- **队长验收**: 需要方坤验收
- **交付物**: 4 个重写后的 config 文件

---

### D（后端-人格报告）—— 画像分析引擎

#### BE-007: 人格分析引擎

- **目标**: 实现跨session用户人格画像计算——行为数据→人格维度→趋势追踪
- **负责人**: D
- **状态**: 🔴 Not Started
- **前置依赖**: P0-001（方坤的 user_profile CRUD 就绪）
- **时间**: Week 1 后半 ~ Week 2
- **影响模块**: world
- **允许编辑路径**:
  ```
  backend/src/core/world/personality_analyzer.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/db/user_profile.py         (get/update user_profile，方坤的 P0-001)
  backend/src/core/db/session_store.py        (list_user_sessions，方坤的 P0-001)
  backend/src/core/world/runtime_state.py     (ActiveReportState 等数据结构)
  backend/src/core/config/report_events.py    (报告模板)
  docs/phase1-design.md                       (SessionBehaviorData / UserProfile 结构)
  ```
- **新增文件**:
  ```
  backend/src/core/world/personality_analyzer.py
  ```
- **修改文件**: 无
- **删除文件**: 无

- **API/数据契约**:

  `personality_analyzer.py` 对外暴露：
  ```python
  def analyze_session(session_id: str, report: dict, user_inputs: list[dict]) -> SessionBehaviorData
  # 从单局数据中提取行为特征

  def update_user_profile(user_id: str, behavior: SessionBehaviorData) -> dict
  # 将本局行为数据合并到用户画像中（加权平均）

  def get_trend(user_id: str) -> dict
  # 返回多session人格维度变化趋势
  # 格式: { "openness": [65, 72, 68], "extraversion": [55, 58, 60], "labels": ["第1局", "第2局", "第3局"] }
  ```

- **人格维度计算规则**（初版规则引擎）:

  | 维度 | 正相关行为 | 负相关行为 |
  |---|---|---|
  | openness（开放性）| 输入词汇多样性高、探索不同场景 | 固定模式输入、只待一个场景 |
  | conscientiousness（尽责性）| 任务选择"稳妥推进"、会议发言多 | 选择"暂时搁置"、空输入多 |
  | extraversion（外向性）| 茶水间发言多、主动与NPC交互 | 沉默、避免会议发言 |
  | agreeableness（宜人性）| 选择"协作沟通"、赞同NPC | 冲突中选择对抗 |
  | neuroticism（情绪稳定性）| 压力事件后仍冷静发言 | 压力事件后输入变短或情绪化 |

- **验收标准**:
  - [ ] `analyze_session()` 从单局数据正确提取所有行为特征字段
  - [ ] `update_user_profile()` 首次调用创建画像，再次调用加权更新
  - [ ] `get_trend()` 返回正确的多维趋势数据
  - [ ] 人格维度值在 0-100 范围内
- **必需测试**:
  - [ ] 测试场景1：高开放性行为数据 → openness > 70
  - [ ] 测试场景2：低尽责性行为数据 → conscientiousness < 40
  - [ ] 测试场景3：首次 session → update 创建新记录
  - [ ] 测试场景4：3个 session 数据 → get_trend 返回 3 个数据点
  - [ ] 测试场景5：行为数据全空/缺失 → 返回合理默认值不报错
- **前后端集成检查**: 纯后端，方坤在 BE-009 的 profile API 中消费
- **队长验收**: 需要方坤验收
- **交付物**: `personality_analyzer.py` + `test_personality_analyzer.py`
- **移交备注**: 完成后通知方坤，方坤会在 BE-009 中集成 profile/trend API

---

#### BE-008: profile / trend API 数据层

- **目标**: 封装 profile 和 trend 的业务逻辑，供方坤在 server.py 中直接调用
- **负责人**: D
- **状态**: 🔴 Not Started
- **前置依赖**: BE-007（personality_analyzer 就绪）
- **时间**: Week 2 后半
- **影响模块**: world
- **允许编辑路径**:
  ```
  backend/src/core/world/personality_analyzer.py  (追加函数)
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/src/core/world/personality_analyzer.py
  ```
- **API/数据契约**:

  追加函数：
  ```python
  def get_profile_response(user_id: str) -> dict
  # 返回前端 GET /api/profile 所需的完整响应结构
  # { "user_id": "...", "personality": { ... }, "stats": { ... } }

  def get_trend_response(user_id: str) -> dict
  # 返回前端 GET /api/profile/trend 所需的趋势数据
  ```

- **验收标准**:
  - [ ] `get_profile_response()` 返回结构符合前端 FE-001 的数据需求
  - [ ] `get_trend_response()` 返回结构可直接用于前端 SVG 折线图
  - [ ] 无历史数据时返回合理空结构
- **必需测试**:
  - [ ] 测试场景1：有历史 → get_profile_response 包含完整人格维度
  - [ ] 测试场景2：无历史 → get_profile_response 返回默认空结构
  - [ ] 测试场景3：3局趋势 → labels 为 ["第1局", "第2局", "第3局"]
- **前后端集成检查**: 前端 B 依赖此数据结构
- **队长验收**: 需要方坤验收
- **交付物**: 更新后的 `personality_analyzer.py`

---

### 方坤（队长）—— API 集成 + 联调验收

#### BE-009: server.py 新增API路由

- **目标**: 在 server.py 中新增 6 个 API 路由，集成种子引擎、画像引擎
- **负责人**: 方坤
- **状态**: 🔴 Not Started
- **前置依赖**: BE-001~BE-008 全部完成
- **时间**: Week 2 后半
- **影响模块**: HTTP API
- **允许编辑路径**:
  ```
  backend/server.py
  ```
- **只读参考路径**:
  ```
  backend/src/core/db/user_profile.py
  backend/src/core/db/session_store.py
  backend/src/core/config/seed_generator.py
  backend/src/core/world/seed_loader.py
  backend/src/core/world/world_factory.py
  backend/src/core/world/personality_analyzer.py
  ```
- **新增文件**: 无
- **修改文件**:
  ```
  backend/server.py
  ```
- **新增路由详情**:

| Method | Path | 处理逻辑 |
|---|---|---|
| GET | `/api/sessions` | 调用 session_store.list_user_sessions，返回历史列表 |
| GET | `/api/sessions/<session_id>` | 调用 session_store.get_session_record，返回单条详情 |
| POST | `/api/sessions/replay` | 调用 seed_generator 生成新种子 → world_factory 创建新世界 → 返回新 state |
| GET | `/api/profile` | 调用 personality_analyzer.get_profile_response，返回人格画像 |
| GET | `/api/profile/trend` | 调用 personality_analyzer.get_trend_response，返回多session趋势 |
| POST | `/api/seed/preview` | 调用 seed_generator.preview，返回种子参数（调试用）|

- **现有路由修改**:
  - `POST /api/reset` → 内部改用 `load_world_seed(user.session_id)` 获取新种子
  - `POST /api/report/close` → 增加 user_profile 更新 + session_record 写入

- **验收标准**:
  - [ ] 6 个新路由均可正常响应
  - [ ] POST /api/sessions/replay 返回完整新 state，前端可直接 renderState
  - [ ] POST /api/reset 每次调用生成不同初始状态
  - [ ] POST /api/report/close 关闭报告后 user_profile 和 session_record 正确写入
  - [ ] 所有路由在未登录时返回 401
- **必需测试**:
  - [ ] 测试场景1：完整流程——注册 → 玩游戏 → 关闭报告 → GET /api/sessions 有记录
  - [ ] 测试场景2：GET /api/profile 在无历史数据时返回空结构（不报错）
  - [ ] 测试场景3：POST /api/sessions/replay 连续调用3次产生3个不同 seed_id
  - [ ] 测试场景4：GET /api/profile/trend 有3个session时返回3个数据点
- **前后端集成检查**: 前端 B 依赖这些 API（FE-001/002/003 的前置条件）
- **队长验收**: 自验
- **交付物**: 修改后的 `server.py`
- **移交备注**: API 就绪后立即通知 B 开始前端开发

---

## 11. 联调与验收

### INT-001: 全链路联调

- **目标**: 端到端验证注册→游戏→报告→复玩→历史 完整链路
- **负责人**: 方坤
- **状态**: 🔴 Not Started
- **前置依赖**: BE-009, FE-001, FE-002, FE-003 全部完成
- **时间**: Week 3 后半
- **验收标准**:
  - [ ] 完整链路：注册→登录→玩一局→关闭报告→查看历史页→点再来一局→新游戏启动
  - [ ] 第二局的公司初始状态（cash/day/描述）与第一局不同
  - [ ] 第三局触发的事件与第一局至少有 2 条不同
  - [ ] GET /api/profile/trend 返回3个数据点
  - [ ] 前端不报 JS 错误，后端不报 500
- **必需测试**:
  - [ ] 测试场景1：方坤手动跑通3局完整链路
  - [ ] 测试场景2：B 在前端验收 UI 表现
  - [ ] 测试场景3：C 确认种子生成器在联调中参数变化符合预期
  - [ ] 测试场景4：D 确认人格画像数据跨session正确累积
- **队长验收**: 方坤最终签字
- **交付物**: 联调通过确认 + bug 列表（如有）

---

### QA-001: 3局差异验收

- **目标**: 定量验证3局体验存在可感知差异
- **负责人**: 方坤
- **状态**: 🔴 Not Started
- **前置依赖**: INT-001
- **时间**: Week 3 后半
- **验收标准**（必须全部通过）:
  - [ ] 3局的 `company_params.cash` 不全相同
  - [ ] 3局的 `company_params.runway_days` 不全相同
  - [ ] 3局触发的 incident 中至少有 1/3 不同
  - [ ] 3局的 meeting 主题至少有 1/3 不同
  - [ ] 3局的 pantry 主题至少有 1/3 不同
  - [ ] 3局的 seed_summary 文案各不相同
  - [ ] 用户人格趋势在3局后有可观测变化（至少1个维度变化>5分）
- **必需测试**: 跑自动化脚本对比3局种子差异
- **队长验收**: 方坤最终签字
- **交付物**: 验收报告 + 差异对比截图

## 12. API 端点总览

| 模块 | Method | Path | 负责人 | 新增/修改 |
|---|---|---|---|---|
| Auth | POST | `/api/auth/register` | 方坤 | 修改（新增 user_profile 初始化）|
| Auth | POST | `/api/auth/login` | 方坤 | 保留 |
| Auth | POST | `/api/auth/logout` | 方坤 | 保留 |
| Auth | GET | `/api/auth/me` | 方坤 | 保留 |
| State | GET | `/api/state` | 方坤 | 修改（响应新增 seed_id）|
| World | POST | `/api/step` | 方坤 | 保留 |
| World | POST | `/api/reset` | 方坤 | 修改（使用新种子）|
| Meeting | POST | `/api/meeting/*` | 方坤 | 保留 |
| Pantry | POST | `/api/pantry/*` | 方坤 | 保留 |
| Report | POST | `/api/report/close` | 方坤 | 修改（写入 user_profile + session_record）|
| Session | GET | `/api/sessions` | 方坤 | **新增** |
| Session | GET | `/api/sessions/{id}` | 方坤 | **新增** |
| Session | POST | `/api/sessions/replay` | 方坤 | **新增** |
| Profile | GET | `/api/profile` | 方坤（调用D的模块）| **新增** |
| Profile | GET | `/api/profile/trend` | 方坤（调用D的模块）| **新增** |
| Debug | POST | `/api/seed/preview` | 方坤（调用C的模块）| **新增** |

## 13. 测试与验收计划

| 层级 | 负责人 | 测试场景数 | 命令 | 通过标准 |
|---|---|---|---|---|
| 单元测试-种子引擎 | C | 5 | `python backend/test_seed_generator.py` | 全部通过 |
| 单元测试-内容池 | C | 5 | `python backend/test_content_pool.py` | 全部通过 |
| 单元测试-人格分析 | D | 5 | `python backend/test_personality_analyzer.py` | 全部通过 |
| 单元测试-DB层 | 方坤 | 5 | 集成在 P0-001 中 | 全部通过 |
| 集成测试 | 方坤 | 4 | `python backend/test_seed_loader.py` (重写) | 全部通过 |
| 前端验收 | B | 见 FE-001/002/003 | 浏览器手动验证 | 无 JS 报错、UI 正确 |
| 最终验收 | 方坤 | 7 | 手动全链路 + 3局差异 | 全部通过 |

## 14. 进度管理

### 状态词汇

- 🔴 Not Started — 未开始
- 🔵 In Progress — 进行中
- ⛔ Blocked — 阻塞
- ✅ Done — 完成

### 阻塞定义

任务在以下情况标记 ⛔：
- 前置任务未完成
- 外部依赖（API/人/决策）超过 24 小时不可用

阻塞时负责人必须立即通知方坤：阻塞原因、需要什么来解除、可以并行做什么。

### 每日更新格式

```
- 昨日完成：
- 今日计划：
- 阻塞项（如有）：
- 分支/PR 链接：
- 测试结果：
```

### 完成定义

- 代码完成
- 测试通过（单元测试 + 必要的手动验证）
- 文档/移交备注已更新
- 审查者无需猜测即可验证

## 15. PR 与合入规则

- 分支命名：`feature/{task-id}-{简短描述}`，如 `feature/BE-001-seed-generator`
- PR 标题包含任务ID和模块名
- PR 描述列出变更范围、测试运行结果、截图（如有UI变更）
- **不得编辑其他成员的所属路径**，需要改动共享文件时必须先通知方坤
- 共享文件（`server.py`, `database.py`, `runtime_state.py`）只有方坤有编辑权限
- 合入顺序遵循依赖地图：P0 → BE/FE → INT → QA

## 16. 即时下一步行动

1. 方坤将本任务分配文档发给 A / B / C / D
2. 方坤开始 P0-001（数据库建表 + CRUD）
3. 方坤同步开始 P0-002（SessionSeed dataclass + 接口契约）
4. C 在 P0-002 就绪后立即开始 BE-001（种子生成器）
5. A 在 P0-002 就绪后立即开始 BE-005（company_profile 参数化模板）
6. D 在 P0-001 就绪后立即开始 BE-007（人格分析引擎）
7. 全体在 Week 1 结束前开一次同步会，确认接口契约和内容池数据格式
