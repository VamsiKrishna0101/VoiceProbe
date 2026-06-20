class BasePersona:
    def __init__(self, name, goal, tone_style, system_prompt):
        self.name = name
        self.goal = goal
        self.tone_style = tone_style
        self.system_prompt = system_prompt