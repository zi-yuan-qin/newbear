from src.core.world.serializer import serialize_world_state
from src.core.world.step_engine import run_one_step
from src.core.world.world_factory import create_initial_world_state


world = create_initial_world_state()
world = run_one_step(world, affair="今天必须完成 Demo 初版")

state = serialize_world_state(world)

print(state["company"])

for actor in state["actors"]:
    print(
        actor["actor_id"],
        actor["display_name"],
        actor["location"],
        actor["stress"],
        actor["energy"],
        actor["current_task"],
    )
