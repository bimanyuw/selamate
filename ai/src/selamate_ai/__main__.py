import json
from selamate_ai.registry import get_status

if __name__ == "__main__":
    print(json.dumps(get_status(), indent=2))
