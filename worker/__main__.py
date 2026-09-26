"""Background worker: polls negotiation_jobs and runs Dara's negotiation logic.

Runs in the same Railway deploy as the API (`python -m worker`) or as a second
service sharing DATABASE_URL. Stub only.
"""

import sys


def main() -> int:
    print("worker: not implemented", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
