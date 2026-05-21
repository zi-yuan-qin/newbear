# newbear Phase 1 系统设计文档：参数化种子系统

## 1. 项目定位

| Item | Value |
|---|---|
| 项目名称 | newbear（熊心壮职）|
| 当前阶段 | v0.1 原型 → v0.2 可复玩 |
| 目标版本 | v0.2 — 参数化种子系统 |
| 目标用户 | 同一位用户可反复游玩，每局体验不同 |
| 成功标准 | 同一用户连续玩3局，每局公司初始状态、触发事件、NPC对话主题存在可感知差异 |

## 2. 当前状态总结

| 领域 | 状态 | 差距 | 确认人 |
|---|---|---|---|
| 代码仓库 | ✅ 已创建 GitHub repo | — | A |
| 数据库 | ✅ SQLite，仅存 world_state + user 表 | 缺少跨session用户画像表、session历史表 | A |
| 后端 | ✅ 单文件 HTTP server + 14个world模块 | 所有配置写死，seed_loader 读固定文件 | A |
| 前端 | ✅ 原生 JS SPA，地图+角色+会议+茶水间 | 无历史记录页、无复玩入口、无进度展示 | B |
| 测试 | ❌ 仅有 test_seed_loader.py | 缺少核心链路的自动化测试 | C |
| 文档 | ✅ 产品说明书 + 公司背景参数化设计文档 | 缺少技术设计文档 | A |

### 当前代码状态 —— 哪些保留、哪些重写、哪些删除

| 处置 | 文件/目录 | 原因 |
|---|---|---|
| 保留 | `backend/server.py` | 核心HTTP服务，仅新增路由 |
| 重写 | `backend/src/core/config/company_profile.py` | 从固定值改为参数化模板 |
| 重写 | `backend/src/core/config/incidents.py` | 从固定列表改为内容池+动态选取 |
| 重写 | `backend/src/core/config/meeting_events.py` | 同上 |
| 重写 | `backend/src/core/config/pantry_events.py` | 同上 |
| 重写 | `backend/src/core/config/report_events.py` | 同上 |
| 重写 | `backend/src/core/world/seed_loader.py` | 从读固定文件改为调用种子生成器 |
| 重写 | `backend/src/core/world/world_factory.py` | 接受参数化种子 |
| 保留 | `backend/src/core/world/step_engine.py` | 时间步核心逻辑不变 |
| 保留 | `backend/src/core/world/actor_reactions.py` | LLM调用逻辑不变 |
| 保留 | `backend/src/core/world/meeting_engine.py` | 会议状态机不变 |
| 保留 | `backend/src/core/world/pantry_engine.py` | 茶水间状态机不变 |
| 保留 | `backend/src/core/world/report_engine.py` | 报告触发逻辑不变 |
| 保留 | `backend/src/core/world/incident_engine.py` | 事件触发时间点不变 |
| 保留 | `backend/src/core/llm/ark_client.py` | LLM客户端不变 |
| 保留 | `backend/src/core/map/*` | 地图加载不变 |
| 保留 | `backend/src/core/auth/*` | 登录注册不变 |
| 新增 | `backend/src/core/config/seed_generator.py` | 参数化种子生成器 |
| 新增 | `backend/src/core/config/content_pool.py` | 内容池管理器 |
| 新增 | `backend/src/core/db/user_profile.py` | 用户跨session画像存储 |
| 新增 | `backend/src/core/db/session_store.py` | session历史元数据存储 |
| 重写 | `frontend/web/main.js` | 新增历史页、复玩流程 |
| 重写 | `frontend/web/index.html` | 新增UI元素 |
| 重写 | `frontend/web/styles.css` | 新增样式 |

## 3. 范围与非范围

### 本期范围

| 模块 | 目的 | 独立性 | 负责人 |
|---|---|---|---|
| 种子参数化引擎 | 每局生成不同的公司/角色/事件初始参数 | 独立模块，被 world_factory 调用 | C |
| 内容池系统 | 事件/会议/茶水间/报告从固定剧本改为多条目池 | 独立模块，被各 engine 调用 | C |
| 跨session用户画像 | 存储用户每局的人格数据，影响下局参数 | 依赖种子引擎 | A |
| 数据库扩展 | user_profiles 表 + session_records 表 | 前置依赖 | A |
| 用户画像分析报告 | 基于用户行为数据生成人格画像（D的专长领域） | 独立模块 | D |
| 新增API | session历史、复玩、画像查询 | 依赖数据库扩展 | C |
| 前端历史页 | 展示历史session、人格变化趋势 | 依赖新增API | B |
| 前端复玩流程 | "再来一局"入口、开局差异提示 | 依赖新增API | B |

### 不在本期范围（P2+）

| 项目 | 原因 |
|---|---|
| 角色扩展（产品经理→运营专员→...） | Phase 2 内容 |
| NPC化机制（前轮用户角色变智能体） | Phase 2 内容 |
| 公司团队规模动态增长 | Phase 2 内容 |
| 岗位选择系统 | Phase 2 内容 |
| 移动端适配 | 等核心复玩链路稳定后再做 |
| Qdrant向量记忆 | 当前SQLite足够，向量检索是过度设计 |
| SSE推送改为轮询 | 当前hashchange+fetch够用，P2再优化 |

## 4. 架构设计

### 整体数据流

```
用户点击"再来一局"
        │
        ▼
┌──────────────────┐
│  seed_generator  │ ◄── user_profile (上局人格数据)
│  参数化种子生成   │ ◄── session_history (防止重复种子)
└──────┬───────────┘
       │ seed = { company_params, character_modifiers, event_pool_selection }
       ▼
┌──────────────────┐
│  seed_loader     │  适配层：把 seed 转为 world_factory 能消费的格式
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  world_factory   │  用参数化种子创建 WorldRuntimeState
└──────┬───────────┘
       │
       ▼
    正常游戏循环（step_engine / meeting / pantry / report 不变）
       │
       ▼
  游戏结束 → report_engine 产出人格数据
       │
       ▼
┌──────────────────┐
│  user_profile    │  存储本局人格数据，供下局种子生成使用
│  session_store   │  存储本局元数据（时间、参数摘要、事件触发记录）
└──────────────────┘
```

### 种子参数结构

```python
@dataclass
class SessionSeed:
    seed_id: str                    # 唯一标识，如 "seed-20260521-a3f2"
    
    # Layer 1: 环境参数（来自 ENV_*）
    industry_heat: float            # 行业热度 0-100，影响融资难度和竞争烈度
    resource_scarcity: float        # 资源紧张度 0-100，影响任务冲突概率
    strategy_consensus: float       # 团队战略共识度 0-100，影响分歧讨论频率
    market_threat_level: float      # 竞品威胁度 0-100
    role_boundary_clarity: float    # 角色边界清晰度 0-100
    
    # Layer 2: 目标参数（来自 GOAL_*）
    cash_pressure: float            # 现金流压力 0-100，影响 NPC 焦虑度
    okr_overall_pressure: float     # OKR整体压力 0-100
    funding_runway_days: int        # 剩余资金可撑天数（替代固定的10天）
    
    # Layer 3: 组织参数（来自 ORG_*）
    team_morale: float              # 团队士气 0-100
    info_transparency: float        # 信息透明度 0-100
    boss_control_tendency: float    # 老板控制欲强度 0-100
    
    # Layer 4: 角色修饰器
    character_modifiers: dict[str, CharacterModifier]  # actor_id → 参数偏移
    
    # Layer 5: 内容选择
    incident_pool_ids: list[str]    # 本轮激活的事件ID列表
    meeting_topic_ids: list[str]    # 本轮激活的会议主题ID列表
    pantry_topic_ids: list[str]     # 本轮激活的茶水间主题ID列表

@dataclass
class CharacterModifier:
    stress_base: int                # 初始压力偏移（默认30±10）
    energy_base: int                # 初始精力偏移（默认70±10）
    mood_variant: str               # 初始情绪变体
    personal_urgency: float         # 个人OKR紧迫感乘数 0.5-1.5
    relationship_tension: dict[str, float]  # 对其他角色的关系张力偏移
```

### 内容池结构

```
content_pool/
├── incidents/
│   ├── market_competitor_launch.json   # 竞品发布事件（3个变体）
│   ├── funding_crisis.json             # 资金危机事件（3个变体）
│   ├── team_conflict.json              # 团队摩擦事件（4个变体）
│   ├── user_growth_spike.json          # 用户增长事件（2个变体）
│   └── investor_meeting.json           # 投资人约谈事件（2个变体）
├── meetings/
│   ├── morning_standup.json            # 晨会主题（6个变体）
│   └── afternoon_review.json           # 部门例会主题（5个变体）
├── pantry/
│   └── afterwork_chat.json             # 茶水间闲谈主题（8个变体）
└── reports/
    └── daily_letter.json               # 日报信件模板（4个变体）
```

每个内容条目标注：
- `tags`: 激活条件标签，如 `["high_pressure", "low_cash"]`
- `param_conditions`: 参数条件，如 `{"cash_pressure": {"min": 70}}`
- `user_personality_match`: 用户画像匹配权重（跨session生效）

## 5. 数据库变更

### 新表：user_profiles

```sql
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    -- 人格画像数据（JSON格式，由D定义具体结构）
    personality_data TEXT NOT NULL DEFAULT '{}',
    -- 关键行为统计
    total_sessions INTEGER NOT NULL DEFAULT 0,
    total_playtime_seconds INTEGER NOT NULL DEFAULT 0,
    -- 偏好统计
    preferred_decision_style TEXT,       -- cautious / balanced / decisive
    preferred_conflict_style TEXT,       -- avoid / confront / mediate
    avg_input_length REAL,               -- 平均输入长度
    -- 角色关系倾向
    relationship_scores TEXT NOT NULL DEFAULT '{}',  -- {actor_id: score}
    -- 时间戳
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### 新表：session_records

```sql
CREATE TABLE session_records (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    seed_id TEXT NOT NULL,
    -- 种子快照（轻量摘要，供前端展示）
    seed_summary TEXT NOT NULL DEFAULT '{}',
    -- 游戏结果
    day_completed INTEGER NOT NULL DEFAULT 0,
    final_clock TEXT,
    report_id TEXT,
    report_scores TEXT NOT NULL DEFAULT '{}',
    -- 元数据
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active / completed / abandoned
    FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);
```

### 现有表变更

`world_state` 表新增字段 `seed_id TEXT`，用于关联种子。

## 6. API 变更

### 新增接口

| 模块 | Method | Path | 说明 | 负责人 |
|---|---|---|---|---|
| Session | GET | `/api/sessions` | 获取当前用户的所有历史session列表 | C |
| Session | GET | `/api/sessions/{session_id}` | 获取单个session详情 | C |
| Session | POST | `/api/sessions/replay` | 使用新种子开始新一轮游戏 | C |
| Profile | GET | `/api/profile` | 获取当前用户的跨session人格画像 | D |
| Profile | GET | `/api/profile/trend` | 获取人格变化趋势数据（多session对比） | D |
| Admin | POST | `/api/seed/preview` | 预览下一局种子参数（调试用） | C |

### 修改现有接口

| 接口 | 变更 |
|---|---|
| `POST /api/auth/register` | 注册时初始化 user_profile 记录 |
| `POST /api/reset` | 重置时使用新种子，而非固定初始状态 |
| `GET /api/state` | 响应中新增 `seed_id` 和 `seed_summary` 字段 |
| `POST /api/report/close` | 关闭报告时触发 user_profile 更新和 session_record 写入 |

## 7. 文件级变更清单

### 新增文件

```
backend/src/core/config/seed_generator.py          # 种子生成器
backend/src/core/config/content_pool.py            # 内容池管理器
backend/src/core/config/content_pool/              # 内容池数据目录
backend/src/core/config/content_pool/__init__.py
backend/src/core/config/content_pool/incidents/     # 事件内容池
backend/src/core/config/content_pool/meetings/      # 会议内容池
backend/src/core/config/content_pool/pantry/        # 茶水间内容池
backend/src/core/config/content_pool/reports/       # 报告内容池
backend/src/core/db/user_profile.py                 # 用户画像DB操作
backend/src/core/db/session_store.py                # session记录DB操作
backend/src/core/world/personality_analyzer.py      # 人格分析引擎（D的主模块）
backend/test_seed_generator.py                      # 种子生成器测试
backend/test_content_pool.py                        # 内容池测试
backend/test_personality_analyzer.py                # 人格分析测试
```

### 重写文件

```
backend/src/core/config/company_profile.py          # 固定值 → 参数化模板
backend/src/core/config/incidents.py                # 固定列表 → 内容池调用
backend/src/core/config/meeting_events.py            # 固定列表 → 内容池调用
backend/src/core/config/pantry_events.py             # 固定列表 → 内容池调用
backend/src/core/config/report_events.py             # 固定列表 → 内容池调用
backend/src/core/world/seed_loader.py               # 固定文件 → 调用生成器
backend/src/core/world/world_factory.py             # 接受参数化种子
backend/src/core/db/database.py                     # 新增建表语句
frontend/web/main.js                                # 新增历史页/复玩流程
frontend/web/index.html                             # 新增UI元素
frontend/web/styles.css                             # 新增样式
```

### 修改文件（增量改动）

```
backend/server.py                                   # 新增6个路由
```

## 8. 人格分析引擎设计（D的专属模块）

D负责的 `personality_analyzer.py` 是整个复玩系统的数据闭环终点，同时也是Phase 2 NPC化的数据基础。

### 输入数据

每局游戏结束时，从 `WorldRuntimeState` 中提取：

```python
@dataclass
class SessionBehaviorData:
    session_id: str
    user_id: str
    
    # 输入特征
    total_inputs: int                    # 总发言次数
    avg_input_length: float              # 平均输入长度
    empty_input_ratio: float             # 空输入比例
    input_diversity_score: float         # 输入词汇多样性
    
    # 决策特征
    task_decisions: list[str]            # 任务处理方式选择序列
    meeting_speak_count: int             # 会议中发言次数
    pantry_speak_count: int              # 茶水间发言次数
    
    # 人际关系特征
    actor_interaction_count: dict[str, int]  # 与每个NPC的交互次数
    actor_agreement_tendency: dict[str, float]  # 对每个NPC的赞同倾向
    
    # 行为模式
    scene_dwell_time: dict[str, float]   # 各场景停留时间比例
    initiative_score: float              # 主动性评分
    conflict_response_pattern: str       # 冲突应对模式
    
    # LLM评估（由报告引擎产出的定性数据）
    trait_summary: str                   # 人格特质摘要
    scores: dict[str, int]               # 维度评分
    evidence: list[str]                  # 行为证据
```

### 输出数据

```python
@dataclass
class UserProfile:
    user_id: str
    
    # 大五人格简化维度（0-100）
    openness: float          # 开放性
    conscientiousness: float # 尽责性
    extraversion: float      # 外向性
    agreeableness: float     # 宜人性
    neuroticism: float       # 情绪稳定性
    
    # 职场行为倾向
    decision_style: str      # cautious / balanced / decisive
    conflict_style: str      # avoid / confront / mediate
    communication_style: str # direct / diplomatic / analytical
    
    # 关系网络
    closest_ally: str        # actor_id
    frequent_target: str     # actor_id（最常互动的角色）
    
    # 成长轨迹
    session_count: int
    trait_trends: dict[str, list[float]]  # 各维度历史值
```

### 跨session人格变化联动种子生成

```
用户第N轮人格数据
        │
        ▼
┌─────────────────────────┐
│ seed_generator 权重计算  │
│                         │
│ 例：                    │
│ openness > 70 → 增加     │
│   探索性事件的权重       │
│ conflict_style=avoid →   │
│   降低团队冲突事件的概率  │
│ closest_ally=熊技术 →    │
│   该角色初始好感度+10    │
└─────────────────────────┘
```

## 9. 前端变更设计（B的模块）

### 新增页面：Session 历史

路由 `#/history`，展示：
- 历次游玩卡片（日期、时长、关键事件数、人格标签）
- 人格变化趋势简单折线图（用SVG手绘，不引入图表库）
- "再来一局"按钮

### 修改流程：报告页底部

在日报关闭后，展示：
- "你今天解锁了 X/Y 个事件"（内容进度）
- "再来一局 —— 不同的初始条件，不同的故事走向"
- [再来一局] 按钮 → POST /api/sessions/replay → 进入新游戏

### 修改流程：登录后

如果用户有历史session，展示：
- 上次游玩摘要卡片
- [继续上次]（如果有未完成session）/ [开始新的一局]

## 10. 参数化对NPC行为的影响路径

```
种子参数 ──→ prompt_context.py 注入 ──→ actor_reactions.py LLM调用 ──→ 角色行为变化
    
具体注入点：

1. company_profile 参数 → 公司描述 prompt
   "熊起东方，天使轮末期，现金仅够撑 {runway_days} 天，行业热度 {heat}/100"
   
2. character_modifiers → 角色设定 prompt  
   "熊老板今天的情绪基调偏焦虑，控制欲比平时更强"
   
3. content_pool selection → 事件触发内容
   不同种子激活不同的事件子集，同一天触发不同内容

4. strategy_consensus → 对话主题种子
   共识度低时，NPC更倾向在会议中发起战略分歧讨论
```

## 11. 技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 种子随机性来源 | Python `random` + seed_id 作为确定性种子 | 可复现、可调试、可预览 |
| 内容池格式 | JSON 文件（非数据库） | 内容池是静态设计资产，非运行时数据；方便非开发人员编辑 |
| 跨session数据存储 | SQLite（user_profiles + session_records表） | 与现有DB一致，v0.2不需要Redis |
| 用户画像计算 | 规则引擎 + LLM辅助（D的模块） | 核心维度用规则保证稳定性，定性描述用LLM |
| 前端图表 | 手绘SVG（不引入第三方库） | 保持零依赖，与项目风格一致 |
| 种子预览接口 | POST /api/seed/preview | 开发调试用，正式版可以加权限 |

## 12. 时间估算

| 阶段 | 周次 | 负责人 | 内容 |
|---|---|---|---|
| Phase 1a: 队长前置 | Week 1 | A | 数据库扩展、种子生成器接口定义、内容池格式标准 |
| Phase 1b: 后端并行 | Week 1-2 | A, C, D | 种子引擎(C)、内容池(C)、画像分析(D)、API集成(A) |
| Phase 1c: 前端 | Week 2-3 | B | 历史页、复玩流程、UI适配 |
| Phase 1d: 联调验收 | Week 3 | A | 全链路联调、3局差异验证、bug修复 |
