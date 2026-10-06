#!/usr/bin/env python3
"""Plot idle-poll backoff vs fixed poll for the operator docs.

Defaults mirror the code and `.env.example`. When those change, update LOOPS
below and re-run this script to refresh `docs/idle-poll/*.png`. See
`docs/dev/idle-poll.md`.

  python3 -m venv .venv-plot && .venv-plot/bin/pip install matplotlib
  .venv-plot/bin/python docs/dev/plot-idle-poll.py

Sources for the defaults:
  apps/api/src/modules/agents/chat/service.ts   AGENT_CHAT_CLAIM_POLL_*
  apps/api/src/modules/agents/core/run-queue.ts AGENT_RUN_POLL_INTERVAL_*
  apps/worker/src/config.ts                     WEBHOOK_POLL_INTERVAL_*
  apps/worker/src/import-worker.ts              IMPORT_POLL_INTERVAL_*
  apps/worker/src/agent-worker.ts               AGENT_RUN_POLL_INTERVAL_*
  packages/runner/src/config.ts                 ITSAPLAN_POLL_INTERVAL_*
  apps/*/idle-poll.ts / shared/idle-poll.ts     nextIdlePollMs
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

try:
    import matplotlib.pyplot as plt
except ImportError as err:
    raise SystemExit(
        "matplotlib is required. Create a venv and install it:\n"
        "  python3 -m venv .venv-plot && .venv-plot/bin/pip install matplotlib\n"
        "  .venv-plot/bin/python docs/dev/plot-idle-poll.py"
    ) from err

# title, base ms, cap ms, claim window ms.
# A window resets the empty streak the way claimNextMessage does: one HTTP claim
# waits at most AGENT_CHAT_CLAIM_WAIT_MS (25s) and the next claim starts again at
# the base. The other loops keep their streak across ticks, so their window is 0.
CHAT_CLAIM_WAIT_MS = 25_000
# title, base ms, cap ms, claim window ms, horizon ms (0 = the figure horizon).
# The first panel is the chat claim over 5 minutes, so the 25 s reset is visible.
# The second is that same loop over the full horizon.
LOOPS: list[tuple[str, int, int, int, int]] = [
    (
        "agent-chat-claim, 5 min\nresets every 25 s",
        500,
        5_000,
        CHAT_CLAIM_WAIT_MS,
        5 * 60_000,
    ),
    (
        "agent-chat-claim\nbase 500 ms · cap 5 s\nresets every 25 s",
        500,
        5_000,
        CHAT_CLAIM_WAIT_MS,
        0,
    ),
    ("background/agent-runs\nbase 2 s · cap 60 s", 2_000, 60_000, 0, 0),
    ("worker / agent-worker\nbase 2 s · cap 60 s", 2_000, 60_000, 0, 0),
    ("import-worker\nbase 3 s · cap 60 s", 3_000, 60_000, 0, 0),
    ("runner runs\nbase 3 s · cap 60 s", 3_000, 60_000, 0, 0),
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "docs" / "idle-poll"


def next_idle_poll_ms(empty_streak: int, base_ms: int, cap_ms: int) -> int:
    """Same rule as nextIdlePollMs in the TypeScript helpers."""
    base = max(1, base_ms)
    cap = max(base, cap_ms)
    exp = min(max(0, empty_streak), 20)
    return min(cap, base * 2**exp)


def simulate(
    base_ms: int, cap_ms: int, horizon_ms: int, window_ms: int = 0
) -> tuple[list[int], list[int], list[int], list[int], int, int]:
    if window_ms > 0:
        return simulate_claims(base_ms, cap_ms, window_ms, horizon_ms)

    back_t: list[int] = [0]
    back_n: list[int] = [0]
    t = streak = 0
    while t < horizon_ms:
        delay = next_idle_poll_ms(streak, base_ms, cap_ms)
        t += delay
        streak += 1
        back_t.append(min(t, horizon_ms))
        back_n.append(streak)

    flat_count = horizon_ms // base_ms
    flat_t: list[int] = [0]
    flat_n: list[int] = [0]
    step = max(1, flat_count // 500)
    for i in range(step, flat_count + 1, step):
        flat_t.append(i * base_ms)
        flat_n.append(i)
    if flat_t[-1] != flat_count * base_ms:
        flat_t.append(flat_count * base_ms)
        flat_n.append(flat_count)
    return back_t, back_n, flat_t, flat_n, streak, flat_count


def looks_in_claim(base_ms: int, cap_ms: int, window_ms: int) -> list[int]:
    """Database look times inside one claim, matching claimNextMessage."""
    now = streak = 0
    times = [0]
    while now < window_ms:
        delay = next_idle_poll_ms(streak, base_ms, cap_ms)
        now += min(delay, window_ms - now)
        streak += 1
        times.append(now)
    return times


def simulate_claims(
    base_ms: int, cap_ms: int, window_ms: int, horizon_ms: int
) -> tuple[list[int], list[int], list[int], list[int], int, int]:
    """Back-to-back empty claims. Each claim resets the streak; fixed poll uses the base as its cap."""
    back_steps = looks_in_claim(base_ms, cap_ms, window_ms)
    flat_steps = looks_in_claim(base_ms, base_ms, window_ms)

    def repeat(steps: list[int]) -> tuple[list[int], list[int], int]:
        # Each claim includes the look at 0 and the look at the deadline. Back-to-back
        # claims therefore count both, which is what claimNextMessage does.
        times = [0]
        counts = [0]
        t = n = 0
        while t < horizon_ms:
            span = min(window_ms, horizon_ms - t)
            for step in steps:
                if step > span:
                    break
                n += 1
                times.append(t + step)
                counts.append(n)
            t += span
        return times, counts, n

    back_t, back_n, end_b = repeat(back_steps)
    flat_t, flat_n, end_f = repeat(flat_steps)
    return back_t, back_n, flat_t, flat_n, end_b, end_f


def plot(out_dir: Path, horizon_ms: int, log_y: bool) -> Path:
    fig, axes = plt.subplots(2, 3, figsize=(12.5, 7.8), dpi=140)
    axes_flat = axes.flatten()
    for ax in axes_flat[len(LOOPS) :]:
        ax.set_visible(False)

    rows: list[tuple[str, int, int, int]] = []
    for ax, (title, base, cap, window_ms, panel_horizon_ms) in zip(axes_flat, LOOPS):
        span_ms = panel_horizon_ms or horizon_ms
        bt, bn, ft, fn, end_b, end_f = simulate(base, cap, span_ms, window_ms)
        cut = round((1 - end_b / end_f) * 100)
        rows.append((title.split("\n", 1)[0], end_b, end_f, cut))
        ax.plot([t / 60_000 for t in ft], fn, color="#2563eb", lw=2.0, label="Fixed poll")
        ax.plot([t / 60_000 for t in bt], bn, color="#ea580c", lw=2.2, label="With backoff")
        if log_y:
            ax.set_yscale("log")
        else:
            ax.set_ylim(bottom=0)
        ax.set_xlim(0, span_ms / 60_000)
        ax.set_title(title, fontsize=10, pad=6)
        ax.grid(True, which="major", ls="-", lw=0.5, alpha=0.35)
        if log_y:
            ax.grid(True, which="minor", ls=":", lw=0.4, alpha=0.25)
        ax.set_xlabel("time (min)", fontsize=9)
        ax.set_ylabel("cumulative ops", fontsize=9)
        ax.tick_params(labelsize=8)
        ax.text(
            0.97,
            0.06,
            f"{end_b} vs {end_f}\n−{cut}%",
            transform=ax.transAxes,
            ha="right",
            va="bottom",
            fontsize=9,
            color="#1e293b",
            bbox=dict(boxstyle="round,pad=0.28", fc="white", ec="#cbd5e1", alpha=0.92),
        )

    handles, labels = axes_flat[0].get_legend_handles_labels()
    fig.legend(
        handles,
        labels,
        loc="upper center",
        ncol=2,
        frameon=False,
        fontsize=10,
        bbox_to_anchor=(0.5, 0.995),
    )
    scale = "log Y" if log_y else "linear Y"
    fig.suptitle(
        f"Cumulative ops ({scale}) — backoff vs fixed poll",
        fontsize=13,
        y=1.02,
    )
    fig.tight_layout(rect=[0, 0, 1, 0.96])

    out_dir.mkdir(parents=True, exist_ok=True)
    hours = horizon_ms / 3_600_000
    name = "cumulative-1h-log.png" if log_y else "cumulative-1h-linear.png"
    if abs(hours - 1) > 1e-9:
        name = f"cumulative-{hours:g}h-{'log' if log_y else 'linear'}.png"
    path = out_dir / name
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    print(f"wrote {path.relative_to(REPO_ROOT)}")
    for label, end_b, end_f, cut in rows:
        print(f"  {label}: {end_b} vs {end_f} (−{cut}%)")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT,
        help=f"directory for the PNGs (default: {DEFAULT_OUT.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "--horizon-hours",
        type=float,
        default=1.0,
        help="idle window to simulate (default: 1)",
    )
    parser.add_argument(
        "--only",
        choices=("linear", "log", "both"),
        default="both",
        help="which chart(s) to write (default: both)",
    )
    args = parser.parse_args()
    if args.horizon_hours <= 0:
        raise SystemExit("--horizon-hours must be positive")
    if not math.isfinite(args.horizon_hours):
        raise SystemExit("--horizon-hours must be finite")

    horizon_ms = int(args.horizon_hours * 3_600_000)
    out_dir = args.out_dir if args.out_dir.is_absolute() else REPO_ROOT / args.out_dir
    if args.only in ("linear", "both"):
        plot(out_dir, horizon_ms, log_y=False)
    if args.only in ("log", "both"):
        plot(out_dir, horizon_ms, log_y=True)


if __name__ == "__main__":
    main()
