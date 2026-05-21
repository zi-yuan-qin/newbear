# ai_comp 流程理解备忘

源项目路径：`C:\Users\23342\Desktop\4.5\ai_comp`

目标项目路径：`C:\Users\23342\Desktop\project\newbear`

## 一句话理解

`ai_comp` 是一个“场景包驱动的公司模拟器”：PPT 地图和物品目录先被解析成 `ScenarioPackage`，后端 `CompanyWorld` 消费这个契约推进公司世界，原生 HTTP 服务对前端暴露状态、推进、会议、茶水间、采访和报告接口，前端通过 SSE 拉取变化并切换世界/会议/茶水间视图。

## 启动链路

1. `run_project.py` 检查 `frontend/assets/scenario_package.json` 和 `frontend/assets/map.json` 是否需要重建。
2. 如需重建，运行 `frontend/content/parser.py`：
   `map1.pptx + item_catalog.example.json -> map.json + scenario_package.json`
3. 设置 `AI_COMP_SCENARIO_PATH`，启动 `backend/server/native_server.py`。
4. `native_server.py` 同时服务：
   - 静态页面：`frontend/web`
   - 静态资产：`frontend/assets`
   - JSON API 和 SSE：`/api/*`

## 核心后端结构

`CompanyWorld` 是 mixin 组合入口：

```text
CompanyWorld
  StepOrchestratorMixin      时间步生命周期、世界状态、角色行动
  PromptEngineMixin          提示词构建和模型调用
  ParserMixin                LLM 输出解析
  RuleResolutionMixin        规则结算、资产、移动、消耗、事件
  ActorMemoryMixin           角色记忆
  WorldLawMixin              硬约束校验
  CompanyPolicyMixin         公司制度/软约束
```

关键状态模型在 `backend/src/core/contracts/models.py`：

- `ActorState`：角色位置、状态、记忆、待办、分数、移动意图。
- `AssetState`：物品归属、位置、消耗属性、能力。
- `DialogueEvent`：角色对话事件。
- `PendingRequest`：请求/协作事项。

## 时间步流程

最小运行单元是 `CompanyWorld.run_step(new_affair)`：

1. `prepare_step(new_affair)`
   - 同步渲染位置和日常开销。
   - 把用户/公司事务写入各角色记忆。
   - 检测角色相遇，决定是否生成对话。
   - 并发调用各角色模型，得到行动声明。
   - 解析声明，生成 preview 和 `pending_step_data`。
2. `settle_step()`
   - 校验世界法则。
   - 统一结算移动、资产行为、身体状态、压力、对话、事件。
   - 生成 `settlement`，推进时间步。
   - 写日志、现金曲线，并预取下一步对话门控。

HTTP 层实际不直接只调用 `run_step`，而是经由 `_run_next_step(session)` 做门控：

```text
输入/事务 -> step_enter
  -> 如果茶水间 active：优先继续茶水间
  -> 如果会议 active：优先继续会议/收束会议
  -> 如果突发事件 pending：阻塞等待用户
  -> prepare_step
  -> gate_prepared_timestep 检查是否触发会议/事件/报告
  -> settle_step
  -> commit_step_result + state_changed
```

## 会话层

`native_server.py` 维护 `SessionState`：

- `world`：当前 `CompanyWorld`
- `config`：模型 provider、角色/公司配置等
- `daily_objective`：每日目标卡
- `pending_user_inputs`：用户输入队列
- `pending_incident`：旧突发事件系统
- `discussion_state`：会议系统
- `pantry_state`：茶水间系统
- `report_card`：阶段报告
- `subscribers`：SSE 订阅者

`SessionStore` 用 `session_id` 管多个会话；前端在 localStorage 保存 `native_session_id`。

## API 分组

初始化和同步：

- `GET /api/bootstrap`
- `GET /api/state`
- `GET /api/events`

世界推进：

- `POST /api/world/reset`
- `POST /api/config/update`
- `POST /api/step/next`
- `POST /api/input/submit`
- `POST /api/auto/start`
- `POST /api/auto/stop`

人物和事件：

- `POST /api/interview/open|refresh|close`
- `POST /api/incidents/commit`

会议：

- `POST /api/discussion/start`
- `POST /api/discussion/respond`
- `POST /api/discussion/resolve`
- `POST /api/discussion/continue`

茶水间：

- `POST /api/pantry/respond`
- `POST /api/pantry/end`
- `POST /api/pantry/continue`

报告和调试：

- `POST /api/report/close`
- `GET /api/debug/logs|logs.csv|logs.json|map-viewer`

## 前端流程

入口：`frontend/web/src/main.js`

1. 创建 API client、布局、store。
2. `bootstrap()` 获取 `session_id`、初始 `state`、动画库、模型选项。
3. 连接 `/api/events`，收到 SSE 后重新拉 `/api/state`。
4. 根据 state 路由：
   - 普通世界：`#/world`
   - 会议中：`#/meeting`
   - 茶水间中：`#/pantry`
5. 普通世界渲染地图、人物、采访、事件、事务输入、公司侧栏、时间线、报告卡。

## 重构到 newbear 的边界建议

优先保留的核心契约：

- `ScenarioPackage` 作为后端唯一场景输入。
- `SessionState -> serialize_world_state -> frontend state` 的状态快照边界。
- `prepare_step -> gate -> settle_step` 的两阶段时间步模型。
- SSE 只通知变化，前端再拉完整 state。

优先拆清的模块：

- 把 `native_server.py` 中会议、茶水间、报告、事件逻辑拆出服务模块。
- 把 HTTP 路由层和业务状态机分离。
- 把 parser 产物和手工资产目录明确区分。
- 保留 `CompanyWorld` 的 mixin 思路，但给每个领域更清晰的包边界。

需要小心的历史包袱：

- 旧 `incident` 流程和新 `discussion` 流程并存。
- `native_server.py` 文件过大，承担了会话、路由、状态机、业务规则和序列化。
- 前端很多 UI 直接依赖完整 `state` 字段名，重构接口时要兼容或同步改。
